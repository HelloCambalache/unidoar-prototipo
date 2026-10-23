import "server-only";
import { cache } from "react";
import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { auditoria, instituciones, planes as tablaDePlanes, planesCondiciones, usuarios } from "@/db/schema";
import { CATALOGO_POR_DEFECTO, catalogoDesdeLaBase, crearPlanes, type CatalogoDePlanes, type Planes } from "@/lib/planes";
import type { Ejecutor } from "@/lib/queries/pipeline";

/*
 * Los planes salen de la base (los edita el equipo en /backoffice/planes) y, si no responde o le falta algo, de los valores de
 * lanzamiento de src/lib/planes.ts: una falla acá nunca deja a la app sin precios. Cada pedido lee una sola vez (`cache`).
 */

/** Lee el catálogo sin memorizarlo: lo usa quien acaba de guardar y necesita ver lo que quedó. */
export async function leerCatalogoDePlanes(ejecutor: Ejecutor = getDb()): Promise<CatalogoDePlanes> {
  const [filas, [condiciones]] = await Promise.all([
    ejecutor.select().from(tablaDePlanes),
    ejecutor.select().from(planesCondiciones).limit(1),
  ]);
  return catalogoDesdeLaBase(
    filas.map((f) => ({ clave: f.clave, etiqueta: f.etiqueta, precio: f.precio, precioMinimo: f.precioMinimo, resumen: f.resumen, detalle: f.detalle, vigente: f.vigente })),
    condiciones
      ? {
          sedesMultisede: condiciones.sedesMultisede,
          descuentoSedeExtra: condiciones.descuentoSedeExtra,
          puntualVigenciaDias: condiciones.puntualVigenciaDias,
          puntualBusquedasAbiertas: condiciones.puntualBusquedasAbiertas,
          puntualIncluyeCursos: condiciones.puntualIncluyeCursos,
          puntualIncluyeBuscador: condiciones.puntualIncluyeBuscador,
          referidoMesesMensual: condiciones.referidoMesesMensual,
          packMeses: condiciones.packMeses,
          packMesesPagos: condiciones.packMesesPagos,
          packMesesReferido: condiciones.packMesesReferido,
          tiposColegio: condiciones.tiposColegio,
        }
      : null,
  );
}

/** El catálogo de planes vigente, leído una vez por pedido. Ante cualquier falla de la base, los valores de lanzamiento. */
export const catalogoDePlanes = cache(async (): Promise<CatalogoDePlanes> => {
  try {
    return await leerCatalogoDePlanes();
  } catch (error) {
    console.error("No se pudieron leer los planes de la base: se usan los valores de lanzamiento", error);
    return CATALOGO_POR_DEFECTO;
  }
});

/** Las reglas de planes ya atadas al catálogo vigente: `const P = await planes(); P.precioDePlan(clave)`. */
export async function planes(): Promise<Planes> {
  return crearPlanes(await catalogoDePlanes());
}

/** Cuántas instituciones tiene cada plan (para mostrar el alcance de un cambio de precio). */
export async function institucionesPorPlan(): Promise<Map<string, number>> {
  const filas = await getDb()
    .select({ plan: instituciones.plan, n: sql<number>`count(*)`.mapWith(Number) })
    .from(instituciones)
    .groupBy(instituciones.plan);
  return new Map(filas.map((f) => [f.plan, f.n] as const));
}

export const ACCION_EDITAR_PLANES = "planes.editar";

export type CambioRegistrado = { cuando: Date; quien: string | null; detalle: Record<string, unknown> | null };

/** Los últimos cambios que hizo el equipo a los planes, el más reciente primero. */
export async function cambiosRecientesDePlanes(limite = 8): Promise<CambioRegistrado[]> {
  const filas = await getDb()
    .select({ cuando: auditoria.creadoEn, quien: usuarios.email, detalle: auditoria.detalle })
    .from(auditoria)
    .leftJoin(usuarios, eq(usuarios.id, auditoria.usuarioId))
    .where(and(eq(auditoria.entidad, "planes"), eq(auditoria.accion, ACCION_EDITAR_PLANES)))
    .orderBy(desc(auditoria.creadoEn))
    .limit(limite);
  return filas.map((f) => ({ cuando: f.cuando, quien: f.quien, detalle: f.detalle }));
}
