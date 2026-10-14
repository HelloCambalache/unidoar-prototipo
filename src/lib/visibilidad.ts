import { and, eq, sql, type SQL } from "drizzle-orm";
import { busquedas, docentes, instituciones } from "@/db/schema";
import { hayQueOcultarLosEjemplos } from "@/lib/datos-de-ejemplo";

/*
 * Qué se ve en las búsquedas y listados cuando el backoffice suspende una cuenta
 * (instituciones.suspendida / docentes.suspendido) y, con `OCULTAR_DATOS_DE_EJEMPLO`, cuando una cuenta es de ejemplo
 * (`es_demo`, ver src/lib/datos-de-ejemplo.ts). Un solo lugar para que todos los módulos filtren igual: sumar una condición
 * nueva acá la aplica en todos.
 *
 * La variable se lee una vez, al cargar el módulo: después de cambiarla en Vercel hay que volver a desplegar.
 */

/** ¿Se ocultan los datos de ejemplo en este entorno? */
export const OCULTAR_EJEMPLOS = hayQueOcultarLosEjemplos(process.env.OCULTAR_DATOS_DE_EJEMPLO);

/** La institución no está suspendida (ni es de ejemplo, si se ocultan los ejemplos). */
export const institucionVisible: SQL = OCULTAR_EJEMPLOS
  ? and(eq(instituciones.suspendida, false), eq(instituciones.esDemo, false))!
  : eq(instituciones.suspendida, false);

/** El docente no está suspendido (ni es de ejemplo, si se ocultan los ejemplos). */
export const docenteVisible: SQL = OCULTAR_EJEMPLOS
  ? and(eq(docentes.suspendido, false), eq(docentes.esDemo, false))!
  : eq(docentes.suspendido, false);

/**
 * Para consultas SQL a mano sobre docentes con el alias `d`: el trozo que descarta a los de ejemplo cuando se ocultan
 * (`and not d.es_demo`); vacío si no.
 */
export const sinDocentesDeEjemploSql: SQL = OCULTAR_EJEMPLOS ? sql`and not d.es_demo` : sql``;

/**
 * Para consultas SQL a mano sobre búsquedas con el alias `b`: el trozo que descarta las de instituciones de ejemplo cuando se
 * ocultan (`and not exists …`); vacío si no.
 */
export const sinBusquedasDeEjemploSql: SQL = OCULTAR_EJEMPLOS
  ? sql`and not exists (select 1 from instituciones ie where ie.id = b.institucion_id and ie.es_demo)`
  : sql``;

/**
 * Para consultas sobre `busquedas` que no unen la tabla de instituciones:
 * la búsqueda no pertenece a una institución suspendida (ni de ejemplo, si se ocultan los ejemplos).
 */
export const busquedaDeInstitucionActiva = OCULTAR_EJEMPLOS
  ? sql`not exists (
  select 1 from ${instituciones} i where i.id = ${busquedas.institucionId} and (i.suspendida or i.es_demo)
)`
  : sql`not exists (
  select 1 from ${instituciones} i where i.id = ${busquedas.institucionId} and i.suspendida
)`;

/**
 * La búsqueda sigue recibiendo postulaciones: está activa y, si es una búsqueda rápida, todavía no venció su plazo. Nada cierra solo
 * las rápidas vencidas, así que todo listado y contador público de búsquedas abiertas tiene que filtrar por esto y no solo por `estado`.
 */
export const busquedaVigente = sql`(${busquedas.estado} = 'activa' and (${busquedas.rapida} = false or ${busquedas.venceEn} is null or ${busquedas.venceEn} > now()))`;
