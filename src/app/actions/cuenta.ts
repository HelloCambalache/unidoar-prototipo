"use server";

import { revalidatePath } from "next/cache";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { getDb, transaccion } from "@/db";
import { usuarios } from "@/db/schema";
import { traducirErrorAuth } from "@/lib/acceso";
import { fallo, ok, parsear, type Resultado } from "@/lib/acciones";
import { registrarAuditoria } from "@/lib/auditoria";
import { requerirDocente, requerirUsuario } from "@/lib/auth";
import { avisarAAdmins } from "@/lib/queries/avisos";
import { ACCION_BAJA_RETIRADA, ACCION_BAJA_SOLICITADA, bajaDocenteSolicitadaEn, tieneContrasena } from "@/lib/queries/cuenta";
import { origenSitio, urlDeCallback } from "@/lib/sitio";
import { crearClienteServidor } from "@/lib/supabase/server";

/*
 * Acciones de "Mi cuenta" que valen para cualquier rol: contraseña y email de acceso. La baja de la institución está
 * en src/app/actions/institucion.ts; la del docente, al final de este archivo.
 */

const esLimite = (error: { code?: string }) => error.code === "over_request_rate_limit" || error.code === "over_email_send_rate_limit";

/* ───────────────────────────── Contraseña ───────────────────────────── */

const contrasenaSchema = z
  .object({
    actual: z.string().max(200).optional(),
    nueva: z.string().min(8, "Usá al menos 8 caracteres").max(72, "Usá hasta 72 caracteres"),
    confirmacion: z.string(),
  })
  .refine((v) => v.nueva === v.confirmacion, { path: ["confirmacion"], message: "Las contraseñas no coinciden" });

/**
 * Cambia la contraseña con la sesión abierta. Si la cuenta ya tiene contraseña se pide la actual y se verifica
 * contra Supabase Auth; una cuenta creada solo con Google puede crear una sin pedirla.
 */
export async function cambiarContrasenaCuenta(_previo: Resultado | null, formData: FormData): Promise<Resultado> {
  const usuario = await requerirUsuario();

  const r = parsear(contrasenaSchema, formData);
  if (!r.ok) return fallo(r.error, r.campos);
  const { actual, nueva } = r.data;

  const supabase = await crearClienteServidor();
  if (await tieneContrasena()) {
    if (!actual) return fallo("Revisá los campos marcados.", { actual: "Escribí tu contraseña actual" });
    const { error } = await supabase.auth.signInWithPassword({ email: usuario.email, password: actual });
    if (error) {
      return fallo(esLimite(error) ? traducirErrorAuth(error) : "Revisá los campos marcados.", {
        actual: esLimite(error) ? traducirErrorAuth(error) : "La contraseña actual no es correcta.",
      });
    }
    if (actual === nueva) {
      return fallo("Revisá los campos marcados.", { nueva: "La nueva contraseña tiene que ser distinta de la actual." });
    }
  }

  const { error } = await supabase.auth.updateUser({ password: nueva });
  if (error) return fallo(traducirErrorAuth(error), { nueva: traducirErrorAuth(error) });
  return ok();
}

/* ───────────────────────────── Email de acceso ───────────────────────────── */

const emailSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(200, "Revisá el email: es demasiado largo")
    .pipe(z.email("Revisá el email: no parece válido")),
  actual: z.string().max(200).optional(),
});

/**
 * Pide cambiar el email de acceso. No cambia nada todavía: Supabase manda un enlace de confirmación al email nuevo (y,
 * según su configuración, también al actual) y el cambio se aplica recién cuando se confirma. Pide la contraseña
 * actual, así que alguien con la sesión abierta en una computadora ajena no puede apropiarse de la cuenta. Las cuentas
 * que ingresan solo con Google no lo pueden cambiar: su email es el de Google. Cuando se confirma, la fila local
 * (`usuarios.email` y lo que copia) se pone al día sola (ver `sincronizarEmailDeCuenta`).
 */
export async function cambiarEmail(
  _previo: Resultado<{ nuevo: string }> | null,
  formData: FormData,
): Promise<Resultado<{ nuevo: string }>> {
  const usuario = await requerirUsuario();

  const r = parsear(emailSchema, formData);
  if (!r.ok) return fallo(r.error, r.campos);
  const { email: nuevo, actual } = r.data;

  if (nuevo === usuario.email.toLowerCase()) {
    return fallo("Revisá los campos marcados.", { email: "Ese ya es el email de tu cuenta." });
  }
  if (!(await tieneContrasena())) {
    return fallo(
      "Tu cuenta ingresa con Google: su email es el de tu cuenta de Google y desde acá no se puede cambiar. Si querés usar otro, creá una cuenta nueva.",
    );
  }
  if (!actual) return fallo("Revisá los campos marcados.", { actual: "Escribí tu contraseña actual para confirmar el cambio." });

  const supabase = await crearClienteServidor();
  const { error: errorClave } = await supabase.auth.signInWithPassword({ email: usuario.email, password: actual });
  if (errorClave) {
    return fallo(esLimite(errorClave) ? traducirErrorAuth(errorClave) : "Revisá los campos marcados.", {
      actual: esLimite(errorClave) ? traducirErrorAuth(errorClave) : "La contraseña actual no es correcta.",
    });
  }

  const [enUso] = await getDb().select({ id: usuarios.id }).from(usuarios).where(sql`lower(${usuarios.email}) = ${nuevo}`).limit(1);
  if (enUso) return fallo("Revisá los campos marcados.", { email: "Ese email ya tiene una cuenta en UNIDOAR." });

  const area = usuario.rol === "docente" ? "/docente/cuenta" : usuario.rol === "institucion" ? "/institucion/cuenta" : "/inicio";
  const { error } = await supabase.auth.updateUser(
    { email: nuevo },
    { emailRedirectTo: urlDeCallback(await origenSitio(), `${area}?email=confirmado`) },
  );
  if (error) {
    const yaExiste = error.code === "email_exists" || error.code === "user_already_exists";
    const mensaje = yaExiste ? "Ese email ya tiene una cuenta en UNIDOAR." : traducirErrorAuth(error);
    return fallo(mensaje, { email: mensaje });
  }
  return ok({ nuevo });
}

/* ───────────────────────────── Baja del docente ───────────────────────────── */

const bajaSchema = z.object({ confirmacion: z.string().trim().min(1, "Escribí tu email para confirmar") });
const comparable = (t: string) => t.trim().replace(/\s+/g, " ").toLowerCase();

/**
 * Pedido de baja del docente. Igual que el de la institución, NO borra nada: deja constancia en `auditoria`
 * ("cuenta.baja_solicitada") y avisa a los admins, que se contactan por email para confirmarla y procesarla. Hay que
 * escribir el email de la cuenta para confirmar. Pedirla dos veces no duplica el registro.
 */
export async function solicitarBajaDocente(_previo: Resultado | null, formData: FormData): Promise<Resultado> {
  const { usuario, docente } = await requerirDocente();

  const r = parsear(bajaSchema, formData);
  if (!r.ok) return fallo(r.error, r.campos);
  if (comparable(r.data.confirmacion) !== comparable(usuario.email)) {
    return fallo("El email no coincide.", { confirmacion: `Escribí exactamente ${usuario.email} para confirmar.` });
  }

  if (!(await bajaDocenteSolicitadaEn(docente.id))) {
    const nombre = `${docente.nombre} ${docente.apellido}`.trim();
    await transaccion(async (tx) => {
      await registrarAuditoria(
        {
          usuarioId: usuario.id,
          accion: ACCION_BAJA_SOLICITADA,
          entidad: "docente",
          entidadId: docente.id,
          detalle: { docente: nombre, email: usuario.email },
        },
        tx,
      );
      await avisarAAdmins(tx, {
        titulo: nombre,
        texto: `pidió la baja de su cuenta. Hay que escribirle a ${usuario.email} para confirmarla.`,
        enlace: `/backoffice/docentes/${docente.id}`,
      });
    });
  }

  revalidatePath("/docente/cuenta");
  revalidatePath(`/backoffice/docentes/${docente.id}`);
  return ok();
}

/** Retira un pedido de baja que todavía no se procesó (la cuenta sigue exactamente como estaba). */
export async function retirarBajaDocente(): Promise<Resultado> {
  const { usuario, docente } = await requerirDocente();

  if (await bajaDocenteSolicitadaEn(docente.id)) {
    const nombre = `${docente.nombre} ${docente.apellido}`.trim();
    await transaccion(async (tx) => {
      await registrarAuditoria(
        { usuarioId: usuario.id, accion: ACCION_BAJA_RETIRADA, entidad: "docente", entidadId: docente.id, detalle: { docente: nombre } },
        tx,
      );
      await avisarAAdmins(tx, {
        titulo: nombre,
        texto: "retiró el pedido de baja: la cuenta sigue como estaba.",
        enlace: `/backoffice/docentes/${docente.id}`,
      });
    });
  }

  revalidatePath("/docente/cuenta");
  revalidatePath(`/backoffice/docentes/${docente.id}`);
  return ok();
}
