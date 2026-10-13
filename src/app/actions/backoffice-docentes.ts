"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { transaccion } from "@/db";
import { fallo, ok, parsear, type Resultado } from "@/lib/acciones";
import { registrarAuditoria } from "@/lib/auditoria";
import { requerirUsuario } from "@/lib/auth";
import { aplicarReactivacion, aplicarSuspension } from "@/lib/backoffice-docentes-escrituras";
import { esUuid } from "@/lib/busquedas";
import {
  ACCION_BAJA_INCOMPLETA,
  borrarArchivosDeLaCuenta,
  borrarDatosDelProfesional,
  borrarUsuarioDeAcceso,
} from "@/lib/queries/baja-docente";

/*
 * Suspender, reactivar y dar de baja la cuenta de un docente. Suspender y reactivar solo cambian el flag `docentes.suspendido`:
 * el bloqueo del acceso lo hace `requerirDocente` (src/lib/auth.ts). Cada cambio se audita en la misma
 * transacción y avisa al docente si tiene cuenta (src/lib/backoffice-docentes-escrituras.ts).
 */

const NO_ENCONTRADO = "No encontramos a ese profesional.";

function revalidarDocente(docenteId: string) {
  revalidatePath("/backoffice/docentes");
  revalidatePath(`/backoffice/docentes/${docenteId}`);
  revalidatePath("/backoffice/verificacion");
  revalidatePath("/backoffice/operacion");
}

const motivoSchema = z.object({
  motivo: z
    .string()
    .trim()
    .min(5, "Contá el motivo (mínimo 5 caracteres): queda en el registro y se le avisa al profesional.")
    .max(500, "El motivo puede tener hasta 500 caracteres."),
});

const notaSchema = z.object({
  nota: z
    .string()
    .trim()
    .max(500, "La nota puede tener hasta 500 caracteres.")
    .optional()
    .transform((v) => v || undefined),
});

/** Suspende la cuenta con un motivo (obligatorio). El docente deja de poder entrar y se lo avisa. */
export async function suspenderDocente(docenteId: string, entrada: { motivo: string }): Promise<Resultado> {
  const admin = await requerirUsuario("admin");
  if (!esUuid(docenteId)) return fallo(NO_ENCONTRADO);
  const datos = parsear(motivoSchema, entrada);
  if (!datos.ok) return fallo(datos.campos?.motivo ?? datos.error, datos.campos);

  const resultado = await transaccion(async (tx): Promise<Resultado> => {
    const r = await aplicarSuspension(tx, admin.id, docenteId, datos.data.motivo);
    if (!r.ok) return r;
    await registrarAuditoria(
      { usuarioId: admin.id, accion: "docente.suspender", entidad: "docente", entidadId: docenteId, detalle: r.data },
      tx,
    );
    return ok();
  });
  if (resultado.ok) revalidarDocente(docenteId);
  return resultado;
}

/** Reactiva la cuenta. La nota es opcional y queda en el registro. */
export async function reactivarDocente(docenteId: string, entrada: { nota?: string } = {}): Promise<Resultado> {
  const admin = await requerirUsuario("admin");
  if (!esUuid(docenteId)) return fallo(NO_ENCONTRADO);
  const datos = parsear(notaSchema, entrada);
  if (!datos.ok) return fallo(datos.campos?.nota ?? datos.error, datos.campos);

  const resultado = await transaccion(async (tx): Promise<Resultado> => {
    const r = await aplicarReactivacion(tx, docenteId, datos.data.nota);
    if (!r.ok) return r;
    await registrarAuditoria(
      { usuarioId: admin.id, accion: "docente.reactivar", entidad: "docente", entidadId: docenteId, detalle: r.data },
      tx,
    );
    return ok();
  });
  if (resultado.ok) revalidarDocente(docenteId);
  return resultado;
}

const bajaSchema = z.object({ confirmacion: z.string().trim().min(1, "Escribí el email de la cuenta para confirmar.") });

/**
 * Procesa la baja de un profesional: borra sus datos de verdad (perfil, documentos, postulaciones, usuario de acceso…) y no se
 * puede deshacer. Exige escribir el email de la cuenta. Primero la base (en una transacción, con la auditoría), después Storage
 * y el usuario de Supabase Auth: si alguno de esos dos falla, la base ya quedó limpia y se lo dice a quien la procesa para que
 * termine a mano. Ver src/lib/queries/baja-docente.ts.
 */
export async function procesarBajaDocente(docenteId: string, entrada: { confirmacion: string }): Promise<Resultado<{ pendientes: string[] }>> {
  const admin = await requerirUsuario("admin");
  if (!esUuid(docenteId)) return fallo(NO_ENCONTRADO);
  const datos = parsear(bajaSchema, typeof entrada === "object" && entrada !== null ? entrada : {});
  if (!datos.ok) return fallo(datos.campos?.confirmacion ?? datos.error, datos.campos);

  const hecho = await transaccion((tx) => borrarDatosDelProfesional(tx, admin.id, docenteId, datos.data.confirmacion));
  if (!hecho.ok) return hecho;
  const { usuarioId, archivosDeExamen } = hecho.data;

  // La base ya está limpia. Lo que sigue es Storage y el usuario de acceso: no se deshace lo anterior si algo falla.
  const archivos = await borrarArchivosDeLaCuenta(usuarioId, archivosDeExamen);
  const acceso = await borrarUsuarioDeAcceso(usuarioId);
  const pendientes: string[] = [];
  if (!archivos.completo) pendientes.push("No se pudieron borrar todos sus archivos de Storage: corré pnpm db:limpiar-archivos --borrar.");
  if (!acceso) pendientes.push("No se pudo borrar su usuario de acceso: borralo desde Supabase → Authentication → Users.");
  if (pendientes.length > 0) {
    await registrarAuditoria({
      usuarioId: admin.id,
      accion: ACCION_BAJA_INCOMPLETA,
      entidad: "docente",
      entidadId: docenteId,
      detalle: { archivosCompletos: archivos.completo, accesoBorrado: acceso, usuarioId },
    });
  }

  revalidarDocente(docenteId);
  return ok({ pendientes });
}
