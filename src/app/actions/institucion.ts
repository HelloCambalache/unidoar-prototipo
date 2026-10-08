"use server";

import { revalidatePath } from "next/cache";
import { quitados } from "@/lib/archivos";
import { borrarArchivos } from "@/lib/queries/archivos";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { transaccion } from "@/db";
import { institucionMiembros, instituciones } from "@/db/schema";
import { fallo, ok, parsear, type Resultado } from "@/lib/acciones";
import { requerirInstitucion } from "@/lib/auth";
import { ROLES_CONTACTO, TIPOS_INSTITUCION } from "@/lib/catalogo";
import { esRolGestor } from "@/lib/equipo";
import { registrarAuditoria } from "@/lib/auditoria";
import {
  ACCION_BAJA_RETIRADA,
  ACCION_BAJA_SOLICITADA,
  bajaSolicitadaEn,
} from "@/lib/queries/cuenta";
import { avisarAAdmins } from "@/lib/queries/avisos";
import { rolEnInstitucion } from "@/lib/queries/equipo";
import { fotosDeInstitucion, guardarVitrina } from "@/lib/queries/vitrina";
import { esUrlPublicaPropia } from "@/lib/subidas";
import { camposDeError, vitrinaSchema, type VitrinaFotoVista, type VitrinaNovedadVista } from "@/lib/vitrina";

/*
 * Acciones de la institución sobre su propia cuenta: vitrina (perfil público), datos de quien administra y
 * pedido de baja (la contraseña y el email son de cualquier rol: src/app/actions/cuenta.ts). Todas parten de `requerirInstitucion()`: nunca se acepta el id de una institución
 * que venga del cliente.
 */

/* ───────────────────────────── Vitrina ───────────────────────────── */

export type VitrinaGuardada = { fotos: VitrinaFotoVista[]; novedades: VitrinaNovedadVista[] };

/**
 * "Guardar cambios" de Mi perfil: datos de la institución, valores, galería de instalaciones y novedades en una
 * sola transacción. Recibe el estado completo del formulario: las fotos y novedades que ya no vienen se borran,
 * las que traen `id` se actualizan (solo si son de esta institución) y las demás se crean. Devuelve las listas ya
 * con sus ids para que el formulario no duplique nada en el próximo guardado.
 */
export async function actualizarVitrina(entrada: unknown): Promise<Resultado<VitrinaGuardada>> {
  const { usuario, institucion } = await requerirInstitucion();
  if (!esRolGestor(await rolEnInstitucion(institucion, usuario.id))) {
    return fallo("Solo el dueño y los administradores pueden editar el perfil público.");
  }

  const r = vitrinaSchema.safeParse(entrada);
  if (!r.success) return fallo("Revisá los campos marcados.", camposDeError(r.error));
  const d = r.data;

  const campos: Record<string, string> = {};
  // El tipo y el rol de contacto son vocabularios cerrados; se tolera el valor que ya tenía guardado (cuentas viejas).
  if (d.tipo !== institucion.tipo && !(TIPOS_INSTITUCION as readonly string[]).includes(d.tipo)) {
    campos.tipo = "Elegí un tipo de la lista.";
  }
  if (d.contactoRol !== institucion.contactoRol && !(ROLES_CONTACTO as readonly string[]).includes(d.contactoRol)) {
    campos.contactoRol = "Elegí un rol de la lista.";
  }
  // Imágenes: la que ya estaba guardada o una que subió esta misma cuenta.
  if (d.logoUrl && d.logoUrl !== institucion.logoUrl && !esUrlPublicaPropia(d.logoUrl, usuario.id)) {
    campos.logoUrl = "Ese archivo no es válido. Subí el logo de nuevo.";
  }
  if (d.portadaUrl && d.portadaUrl !== institucion.portadaUrl && !esUrlPublicaPropia(d.portadaUrl, usuario.id)) {
    campos.portadaUrl = "Ese archivo no es válido. Subí la portada de nuevo.";
  }

  const porId = new Map((await fotosDeInstitucion(institucion.id)).map((f) => [f.id, f]));
  d.fotos.forEach((f, i) => {
    const actual = f.id ? porId.get(f.id) : undefined;
    if (actual?.url !== f.url && !esUrlPublicaPropia(f.url, usuario.id)) campos[`fotos.${i}.url`] = "Subí la foto de nuevo.";
  });
  if (Object.keys(campos).length > 0) return fallo("Revisá los campos marcados.", campos);

  const guardado = await guardarVitrina(institucion.id, d);

  // Lo que se reemplazó o se quitó (logo, portada, fotos de la galería) deja de ocupar lugar en Storage.
  await borrarArchivos(
    quitados(
      [institucion.logoUrl, institucion.portadaUrl, ...[...porId.values()].map((f) => f.url)],
      [d.logoUrl, d.portadaUrl, ...guardado.fotos.map((f) => f.url)],
    ),
  );

  // El nombre y el logo se ven en el menú de toda el área, y la vitrina en las dos páginas de perfil.
  revalidatePath("/institucion", "layout");
  revalidatePath(`/instituciones/${institucion.slug}`);
  revalidatePath(`/docente/instituciones/${institucion.slug}`);
  revalidatePath("/docente/instituciones");
  revalidatePath("/instituciones");
  return ok(guardado);
}

/* ───────────────────────────── Mi cuenta ───────────────────────────── */

const cuentaSchema = z.object({
  nombre: z.string().trim().min(2, "Completá tu nombre").max(60, "Máximo 60 caracteres"),
  apellido: z.string().trim().max(80, "Máximo 80 caracteres"),
  telefono: z.string().trim().max(40, "Máximo 40 caracteres").optional(),
});

/**
 * Datos de quien administra la cuenta. El dueño edita nombre y teléfono de contacto de la institución; quien
 * entró por invitación edita su nombre en el equipo (no tiene teléfono propio). El email es el de acceso y no se toca.
 */
export async function actualizarCuenta(_previo: Resultado | null, formData: FormData): Promise<Resultado> {
  const { usuario, institucion } = await requerirInstitucion();
  const rol = await rolEnInstitucion(institucion, usuario.id);
  const esDueno = rol === "dueno";

  const r = parsear(cuentaSchema, formData);
  // El teléfono de contacto es obligatorio para el dueño: se avisa junto con los otros errores, no de a uno.
  const telefonoCorto = esDueno && String(formData.get("telefono") ?? "").trim().length < 6;
  if (!r.ok) {
    return fallo(r.error, {
      ...r.campos,
      ...(telefonoCorto && !r.campos?.telefono ? { telefono: "Poné un teléfono de contacto" } : {}),
    });
  }
  const { nombre, apellido, telefono } = r.data;
  if (telefonoCorto) return fallo("Revisá los campos marcados.", { telefono: "Poné un teléfono de contacto" });
  const completo = `${nombre} ${apellido}`.trim();

  await transaccion(async (tx) => {
    if (esDueno) {
      await tx
        .update(instituciones)
        .set({ contactoNombre: completo, telefono: telefono ?? null })
        .where(eq(instituciones.id, institucion.id));
    }
    await tx
      .update(institucionMiembros)
      .set({ nombre: completo })
      .where(and(eq(institucionMiembros.institucionId, institucion.id), eq(institucionMiembros.usuarioId, usuario.id)));
  });

  // El avatar del encabezado sale de estos datos.
  revalidatePath("/institucion", "layout");
  return ok();
}

/* ───────────────────────────── Baja de la cuenta ───────────────────────────── */

const bajaSchema = z.object({ confirmacion: z.string().trim().min(1, "Escribí el nombre de tu institución") });

const comparable = (t: string) => t.trim().replace(/\s+/g, " ").toLowerCase();

/**
 * Pedido de baja. NO borra nada ni despublica nada: deja constancia en `auditoria` ("cuenta.baja_solicitada")
 * para que el equipo de UNIDOAR se contacte y la procese. Solo la puede pedir el dueño de la cuenta, y hay que
 * escribir el nombre de la institución para confirmar. Pedirla dos veces no duplica el registro.
 */
export async function solicitarBajaCuenta(_previo: Resultado | null, formData: FormData): Promise<Resultado> {
  const { usuario, institucion } = await requerirInstitucion();
  if ((await rolEnInstitucion(institucion, usuario.id)) !== "dueno") {
    return fallo("Solo el dueño de la cuenta puede pedir la baja.");
  }

  const r = parsear(bajaSchema, formData);
  if (!r.ok) return fallo(r.error, r.campos);
  if (comparable(r.data.confirmacion) !== comparable(institucion.nombre)) {
    return fallo("El nombre no coincide.", { confirmacion: `Escribí exactamente «${institucion.nombre}» para confirmar.` });
  }

  if (!(await bajaSolicitadaEn(institucion.id))) {
    await transaccion(async (tx) => {
      await registrarAuditoria(
        {
          usuarioId: usuario.id,
          accion: ACCION_BAJA_SOLICITADA,
          entidad: "institucion",
          entidadId: institucion.id,
          detalle: { institucion: institucion.nombre, email: usuario.email, plan: institucion.plan },
        },
        tx,
      );
      await avisarAAdmins(tx, {
        titulo: institucion.nombre,
        texto: `pidió la baja de la cuenta. Hay que escribirle a ${usuario.email} para confirmarla.`,
        enlace: `/backoffice/instituciones/${institucion.id}`,
      });
    });
  }

  revalidatePath("/institucion/cuenta");
  return ok();
}

/** Retira un pedido de baja que todavía no se procesó (la cuenta sigue exactamente como estaba). */
export async function retirarBajaCuenta(): Promise<Resultado> {
  const { usuario, institucion } = await requerirInstitucion();
  if ((await rolEnInstitucion(institucion, usuario.id)) !== "dueno") {
    return fallo("Solo el dueño de la cuenta puede retirar el pedido de baja.");
  }

  if (await bajaSolicitadaEn(institucion.id)) {
    await transaccion(async (tx) => {
      await registrarAuditoria(
        {
          usuarioId: usuario.id,
          accion: ACCION_BAJA_RETIRADA,
          entidad: "institucion",
          entidadId: institucion.id,
          detalle: { institucion: institucion.nombre },
        },
        tx,
      );
      await avisarAAdmins(tx, {
        titulo: institucion.nombre,
        texto: "retiró el pedido de baja: la cuenta sigue como estaba.",
        enlace: `/backoffice/instituciones/${institucion.id}`,
      });
    });
  }

  revalidatePath("/institucion/cuenta");
  return ok();
}
