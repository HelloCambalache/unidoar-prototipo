import { eq, sql } from "drizzle-orm";
import { busquedas, docentes, instituciones } from "@/db/schema";

/*
 * Qué se ve en las búsquedas y listados cuando el backoffice suspende una cuenta
 * (instituciones.suspendida / docentes.suspendido). Un solo lugar para que todos los
 * módulos filtren igual: sumar una condición nueva acá la aplica en todos.
 */

/** La institución no está suspendida. */
export const institucionVisible = eq(instituciones.suspendida, false);

/** El docente no está suspendido. */
export const docenteVisible = eq(docentes.suspendido, false);

/**
 * Para consultas sobre `busquedas` que no unen la tabla de instituciones:
 * la búsqueda no pertenece a una institución suspendida.
 */
export const busquedaDeInstitucionActiva = sql`not exists (
  select 1 from ${instituciones} i where i.id = ${busquedas.institucionId} and i.suspendida
)`;

/**
 * La búsqueda sigue recibiendo postulaciones: está activa y, si es una búsqueda rápida, todavía no venció su plazo. Nada cierra solo
 * las rápidas vencidas, así que todo listado y contador público de búsquedas abiertas tiene que filtrar por esto y no solo por `estado`.
 */
export const busquedaVigente = sql`(${busquedas.estado} = 'activa' and (${busquedas.rapida} = false or ${busquedas.venceEn} is null or ${busquedas.venceEn} > now()))`;
