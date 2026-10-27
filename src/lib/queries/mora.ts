import "server-only";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { facturas } from "@/db/schema";
import { hoyAR } from "@/lib/cobros";
import { moraDe, SIN_MORA, type Mora } from "@/lib/mora";

/*
 * La mora de una institución (reglas y textos en src/lib/mora.ts). No se guarda nada: se calcula al mirar con las facturas impagas, así que cuando
 * el equipo registra el pago la limitación se levanta sola.
 */

/**
 * Estado y fecha de cobro de TODAS las facturas de la institución: de ahí salen la mora (las impagas) y si ya pagó alguna vez (`motivoDelPlan`,
 * src/lib/queries/plan-activo.ts). Una sola lectura por pedido (`cache` de React): el layout, la página y la acción que preguntan lo mismo no la repiten.
 */
export const facturasParaMora = cache(async (institucionId: string) =>
  getDb().select({ estado: facturas.estado, fechaCobro: facturas.fechaCobro }).from(facturas).where(eq(facturas.institucionId, institucionId)),
);

/**
 * La mora de la institución hoy. Las de ejemplo nunca quedan limitadas (sus facturas son de prueba). Una cuenta sin facturas (la búsqueda puntual
 * no tiene) tampoco tiene mora.
 */
export async function moraDeInstitucion(institucion: { id: string; esDemo: boolean }): Promise<Mora> {
  if (institucion.esDemo) return SIN_MORA;
  const filas = await facturasParaMora(institucion.id);
  return moraDe(
    filas.filter((f) => f.estado !== "pagada"),
    hoyAR(),
  );
}
