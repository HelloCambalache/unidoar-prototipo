import "server-only";
import { eq, inArray } from "drizzle-orm";
import { acuerdosPrecio } from "@/db/schema";
import { paraCalcular } from "@/lib/acuerdos";
import type { AcuerdoDePrecio } from "@/lib/planes";
import type { Ejecutor } from "@/lib/queries/pipeline";

/*
 * Precio acordado con cada institución (ver `acuerdosPrecio` en src/db/schema.ts). Sin fila, la institución paga el precio de lista de su
 * plan. Todo lo que calcula lo que se cobra (facturas, débito automático, MRR, la pantalla de plan) lo pasa a `montoDePlan`.
 */

/** Los acuerdos de varias instituciones de una vez: id → acuerdo. Las que no tienen no aparecen. */
export async function acuerdosDePrecio(ejecutor: Ejecutor, institucionIds: string[]): Promise<Map<string, AcuerdoDePrecio>> {
  const acuerdos = new Map<string, AcuerdoDePrecio>();
  if (institucionIds.length === 0) return acuerdos;
  const filas = await ejecutor
    .select({ institucionId: acuerdosPrecio.institucionId, modalidad: acuerdosPrecio.modalidad, monto: acuerdosPrecio.monto })
    .from(acuerdosPrecio)
    .where(inArray(acuerdosPrecio.institucionId, institucionIds));
  for (const f of filas) {
    const acuerdo = paraCalcular(f);
    if (acuerdo) acuerdos.set(f.institucionId, acuerdo);
  }
  return acuerdos;
}

/** El acuerdo de una institución, o null si paga el de lista. */
export async function acuerdoDe(ejecutor: Ejecutor, institucionId: string): Promise<AcuerdoDePrecio | null> {
  return (await acuerdosDePrecio(ejecutor, [institucionId])).get(institucionId) ?? null;
}

/** El acuerdo con su nota y cuándo se cargó (lo ve solo el equipo, en la ficha de cobros). */
export async function acuerdoConNota(ejecutor: Ejecutor, institucionId: string) {
  const [fila] = await ejecutor.select().from(acuerdosPrecio).where(eq(acuerdosPrecio.institucionId, institucionId)).limit(1);
  const acuerdo = paraCalcular(fila);
  return fila && acuerdo ? { acuerdo, nota: fila.nota, actualizadoEn: fila.actualizadoEn } : null;
}
