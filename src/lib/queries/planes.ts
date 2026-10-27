import "server-only";
import { cache } from "react";
import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { auditoria, instituciones, planes as tablaDePlanes, planesCondiciones, usuarios } from "@/db/schema";
import { resumenDeError } from "@/lib/errores";
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
          cuposFundador: condiciones.cuposFundador,
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
    console.error("No se pudieron leer los planes de la base: se usan los valores de lanzamiento", resumenDeError(error));
    return CATALOGO_POR_DEFECTO;
  }
});

/**
 * Las reglas de planes ya atadas al catálogo vigente: `const P = await planes(); P.precioDePlan(clave)`. Para MOSTRAR: si la base falla, usa los
 * valores de lanzamiento (una pantalla nunca queda sin precios). Para lo que MUEVE PLATA (facturar, registrar un pago, validar un precio acordado,
 * el débito automático) usar `planesParaCobrar`.
 */
export async function planes(): Promise<Planes> {
  return crearPlanes(await catalogoDePlanes());
}

/**
 * Las reglas de planes para lo que mueve plata: lee el catálogo de la base y, si no puede, LANZA en lugar de usar los valores de lanzamiento.
 * Facturar con un precio que no es el vigente (el equipo subió Colegios a $55.000 y el cron lee los de lanzamiento) deja facturas con el monto
 * equivocado, y como se crean una por mes y por institución, quedan así. Mejor que falle y se reintente (el cron corre todos los días y es idempotente).
 */
export async function planesParaCobrar(ejecutor: Ejecutor = getDb()): Promise<Planes> {
  return crearPlanes(await leerCatalogoDePlanes(ejecutor));
}

/** Lo que se le dice a quien pidió algo que mueve plata cuando no se pudieron leer los precios. */
export const SIN_PRECIOS = "No pudimos leer los precios vigentes. Probá de nuevo en un momento.";

/** `planesParaCobrar` para una acción del servidor: devuelve null (y deja el motivo en el log) en lugar de lanzar, así la acción responde con `SIN_PRECIOS`. */
export async function planesParaCobrarOFallar(): Promise<Planes | null> {
  try {
    return await planesParaCobrar();
  } catch (error) {
    console.error("No se pudieron leer los precios para cobrar", resumenDeError(error));
    return null;
  }
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
