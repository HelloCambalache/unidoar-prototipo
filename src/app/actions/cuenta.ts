"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { transaccion } from "@/db";
import { traducirErrorAuth } from "@/lib/acceso";
import { fallo, ok, parsear, type Resultado } from "@/lib/acciones";
import { registrarAuditoria } from "@/lib/auditoria";
import { requerirDocente, requerirUsuario } from "@/lib/auth";
import { encolarParaEquipo } from "@/lib/correo/cola";
import { avisarAAdmins } from "@/lib/queries/avisos";
import { fijarAvisosPorCorreo } from "@/lib/queries/correo";
import { ACCION_BAJA_RETIRADA, ACCION_BAJA_SOLICITADA, bajaDocenteSolicitadaEn, tieneContrasena } from "@/lib/queries/cuenta";
import { crearClienteServidor } from "@/lib/supabase/server";
import { DEMASIADOS_PEDIDOS, permitirPedidoAlEquipo } from "@/lib/pedidos";

/*
 * Acciones de "Mi cuenta" que valen para cualquier rol: contraseña y avisos por mail. El email de acceso NO se cambia desde la app. La baja de la institución está
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
  // Una contraseña nueva tiene que dejar afuera a quien tenga otra sesión abierta (una robada, o una computadora que quedó prendida).
  await supabase.auth.signOut({ scope: "others" }).catch(() => undefined);
  return ok();
}

/* ───────────────────────────── Avisos por mail ───────────────────────────── */

/**
 * Enciende o apaga los avisos por mail de búsquedas, postulaciones y entrevistas (los "opcionales", ver
 * src/lib/correo/plantillas.ts). Los de cuenta, verificación y facturación no dependen de esto. Solo toca la cuenta de la sesión.
 */
export async function cambiarAvisosPorCorreo(activos: boolean): Promise<Resultado> {
  const usuario = await requerirUsuario();
  if (typeof activos !== "boolean") return fallo("No entendimos el pedido.");
  if (!(await fijarAvisosPorCorreo(usuario.id, activos))) return fallo("No encontramos tu cuenta.");
  revalidatePath("/docente/cuenta");
  revalidatePath("/institucion/cuenta");
  return ok();
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
  if (!permitirPedidoAlEquipo(usuario.id)) return fallo(DEMASIADOS_PEDIDOS);

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
      await encolarParaEquipo(tx, "M62", { cuenta: nombre, tipo: "docente", ruta: `/backoffice/docentes/${docente.id}` });
    });
  }

  revalidatePath("/docente/cuenta");
  revalidatePath(`/backoffice/docentes/${docente.id}`);
  return ok();
}

/** Retira un pedido de baja que todavía no se procesó (la cuenta sigue exactamente como estaba). */
export async function retirarBajaDocente(): Promise<Resultado> {
  const { usuario, docente } = await requerirDocente();
  if (!permitirPedidoAlEquipo(usuario.id)) return fallo(DEMASIADOS_PEDIDOS);

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
