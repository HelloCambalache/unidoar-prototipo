import "server-only";
import { and, eq, ne } from "drizzle-orm";
import { getDb } from "@/db";
import { facturas } from "@/db/schema";
import { hoyAR } from "@/lib/cobros";
import { moraDe, motivoDeLimite, SIN_MORA, type Mora } from "@/lib/mora";
import type { EjecutorBo } from "@/lib/queries/backoffice-instituciones";

/*
 * La mora de una institución (reglas y textos en src/lib/mora.ts). No se guarda nada: se calcula al mirar con las facturas impagas, así que cuando
 * el equipo registra el pago la limitación se levanta sola.
 */

/**
 * La mora de la institución hoy. Las de ejemplo nunca quedan limitadas (sus facturas son de prueba). Una cuenta sin facturas (la búsqueda puntual
 * no tiene) tampoco tiene mora.
 */
export async function moraDeInstitucion(institucion: { id: string; esDemo: boolean }, ejecutor: Pick<EjecutorBo, "select"> = getDb()): Promise<Mora> {
  if (institucion.esDemo) return SIN_MORA;
  const impagas = await ejecutor
    .select({ fechaCobro: facturas.fechaCobro })
    .from(facturas)
    .where(and(eq(facturas.institucionId, institucion.id), ne(facturas.estado, "pagada")));
  return moraDe(impagas, hoyAR());
}

/**
 * Para una ACCIÓN que una cuenta limitada no puede hacer (publicar una búsqueda, invitar a postularse, publicar un curso): el motivo para mostrarle,
 * o null si puede. No alcanza con esconder el botón: la acción se puede llamar directo, así que se exige acá.
 */
export async function motivoDeMora(institucion: { id: string; esDemo: boolean }): Promise<string | null> {
  return motivoDeLimite(await moraDeInstitucion(institucion));
}
