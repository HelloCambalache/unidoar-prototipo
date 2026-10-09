import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { docenteDetalle } from "@/db/schema";

/**
 * Quiénes de estos profesionales todavía estudian y cuánto de la carrera tienen aprobado (`null` si no lo cargó). Es lo único
 * de `docente_detalle` que ven las instituciones: el resto (DNI, domicilio, documentos) nunca sale de ahí. Devuelve solo a los
 * que estudian: quien no figura en el mapa se recibió.
 */
export async function estudiantesEntre(docenteIds: string[]): Promise<Map<string, { porcentaje: number | null }>> {
  if (docenteIds.length === 0) return new Map();
  const filas = await getDb()
    .select({ docenteId: docenteDetalle.docenteId, porcentaje: docenteDetalle.porcentajeMaterias })
    .from(docenteDetalle)
    .where(and(inArray(docenteDetalle.docenteId, docenteIds), eq(docenteDetalle.situacionEstudio, "estudiante")));
  return new Map(filas.map((f) => [f.docenteId, { porcentaje: f.porcentaje }] as const));
}
