"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { transaccion } from "@/db";
import { fallo, ok, parsear, type Resultado } from "@/lib/acciones";
import { registrarAuditoria } from "@/lib/auditoria";
import { requerirUsuario } from "@/lib/auth";
import { aplicarReactivacion, aplicarSuspension } from "@/lib/backoffice-docentes-escrituras";
import { esUuid } from "@/lib/busquedas";

/*
 * Suspender y reactivar la cuenta de un docente. Acá solo se cambia el flag `docentes.suspendido`:
 * el bloqueo del acceso lo hace `requerirDocente` (src/lib/auth.ts). Cada cambio se audita en la misma
 * transacción y avisa al docente si tiene cuenta (src/lib/backoffice-docentes-escrituras.ts).
 */

const NO_ENCONTRADO = "No encontramos a ese docente.";

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
    .min(5, "Contá el motivo (mínimo 5 caracteres): queda en el registro y se le avisa al docente.")
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
