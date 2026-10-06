import "server-only";
import { getDb } from "@/db";
import { auditoria } from "@/db/schema";

/** Acepta la base o una transacción (`tx`), para registrar dentro de la misma operación. */
type Ejecutor = Pick<ReturnType<typeof getDb>, "insert">;

/**
 * Deja constancia de una acción del equipo en el backoffice. Toda mutación del backoffice debe llamarla,
 * idealmente dentro de la misma transacción que el cambio.
 *
 *   await registrarAuditoria({ usuarioId: admin.id, accion: "docente.verificar", entidad: "docente", entidadId: id })
 */
export async function registrarAuditoria(
  e: { usuarioId: string | null; accion: string; entidad: string; entidadId: string; detalle?: Record<string, unknown> },
  ejecutor: Ejecutor = getDb(),
) {
  await ejecutor.insert(auditoria).values({
    usuarioId: e.usuarioId,
    accion: e.accion,
    entidad: e.entidad,
    entidadId: e.entidadId,
    detalle: e.detalle,
  });
}
