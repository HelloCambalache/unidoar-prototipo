import "server-only";
import { eq, inArray } from "drizzle-orm";
import { acuerdosPrecio } from "@/db/schema";
import { acuerdoRigeEn, paraCalcular } from "@/lib/acuerdos";
import { periodoActual } from "@/lib/cobros";
import type { AcuerdoDePrecio } from "@/lib/planes";
import type { Ejecutor } from "@/lib/queries/pipeline";

/*
 * Precio acordado con cada institución (ver `acuerdosPrecio` en src/db/schema.ts). Sin fila, la institución paga el precio de lista de su
 * plan. Todo lo que calcula lo que se cobra (facturas, débito automático, MRR, la pantalla de plan) lo pasa a `montoDePlan`.
 *
 * Un acuerdo con fecha de fin (`hasta`, el último mes en que rige) deja de contar apenas termina ese mes: estas lecturas devuelven solo los que
 * rigen en el período que se pregunta (por defecto, el mes en curso en Argentina), así que todo lo que calcula montos vuelve solo al precio de lista
 * sin que nadie tenga que acordarse de quitarlo. La fila queda guardada: el equipo la ve en la ficha (vencida) y puede acordar otro.
 */

/** Los acuerdos de varias instituciones de una vez: id → acuerdo. Las que no tienen uno vigente no aparecen. */
export async function acuerdosDePrecio(ejecutor: Ejecutor, institucionIds: string[], periodo: string = periodoActual()): Promise<Map<string, AcuerdoDePrecio>> {
  const acuerdos = new Map<string, AcuerdoDePrecio>();
  if (institucionIds.length === 0) return acuerdos;
  const filas = await ejecutor
    .select({
      institucionId: acuerdosPrecio.institucionId,
      modalidad: acuerdosPrecio.modalidad,
      monto: acuerdosPrecio.monto,
      plan: acuerdosPrecio.plan,
      hasta: acuerdosPrecio.hasta,
    })
    .from(acuerdosPrecio)
    .where(inArray(acuerdosPrecio.institucionId, institucionIds));
  for (const f of filas) {
    const acuerdo = paraCalcular(f, periodo);
    if (acuerdo) acuerdos.set(f.institucionId, acuerdo);
  }
  return acuerdos;
}

/** El acuerdo vigente de una institución, o null si paga el de lista (no tiene uno, o el que tenía ya terminó). */
export async function acuerdoDe(ejecutor: Ejecutor, institucionId: string, periodo?: string): Promise<AcuerdoDePrecio | null> {
  return (await acuerdosDePrecio(ejecutor, [institucionId], periodo)).get(institucionId) ?? null;
}

/**
 * El acuerdo con su nota y cuándo se cargó (lo ve solo el equipo, en la ficha de cobros). Devuelve también el que ya terminó (`vencido`): así el
 * equipo ve qué había y puede acordar otro; el que rige hoy es el que no está vencido.
 */
export async function acuerdoConNota(ejecutor: Ejecutor, institucionId: string, periodo: string = periodoActual()) {
  const [fila] = await ejecutor.select().from(acuerdosPrecio).where(eq(acuerdosPrecio.institucionId, institucionId)).limit(1);
  const acuerdo = paraCalcular(fila);
  return fila && acuerdo ? { acuerdo, vencido: !acuerdoRigeEn(fila.hasta, periodo), nota: fila.nota, actualizadoEn: fila.actualizadoEn } : null;
}
