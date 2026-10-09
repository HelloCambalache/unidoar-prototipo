import "server-only";
import { cache } from "react";
import { and, asc, count, desc, eq, gt, inArray, isNull, min, ne, notInArray, or, sql, type SQL } from "drizzle-orm";
import { getDb } from "@/db";
import {
  asignaturas,
  busquedas,
  contactosInstitucion,
  cvEnviados,
  docenteDetalle,
  docentes,
  favoritos,
  postulaciones,
  zonas,
  type CategoriaDocente,
  type Docente,
  type EtapaPostulacion,
  type GrillaDisponibilidad,
  type Institucion,
} from "@/db/schema";
import { ETAPA_LABEL } from "@/lib/catalogo";
import { normalizarTexto } from "@/lib/busqueda-ia";
import { grillaDesdeLista } from "@/lib/disponibilidad";
import type { FiltrosDocentes } from "@/lib/filtros-docentes";
import { esEstudiante } from "@/lib/estudiantes";
import { distanciaKm } from "@/lib/geo";
import { grillaDesdeJson, grillaTieneHorarios } from "@/lib/onboarding";
import { estudiantesEntre } from "@/lib/queries/estudiantes";
import { docenteVisible } from "@/lib/visibilidad";

/*
 * Lecturas del paquete "Buscar profesionales": buscador (catálogo y rápidas), perfil de un docente
 * visto por la institución y base propia de la institución ("Profesionales").
 */

export const POR_PAGINA = 18;
const POR_PAGINA_BASE = 25;

/* ───────────────────────────── Piezas de SQL ─────────────────────────────
   Las columnas se escriben calificadas ("docentes"."x") porque Drizzle las deja sin calificar
   en el select de una sola tabla, y las subconsultas correlacionadas necesitan el nombre exacto. */

const col = (nombre: string) => sql.raw(`"docentes"."${nombre}"`);
const D = {
  id: col("id"),
  nombre: col("nombre"),
  apellido: col("apellido"),
  subtitulo: col("subtitulo"),
  categoria: col("categoria"),
  asignaturas: col("asignaturas"),
  zonas: col("zonas"),
  niveles: col("niveles"),
  disponibilidad: col("disponibilidad"),
  lat: col("lat"),
  lng: col("lng"),
  radioKm: col("radio_km"),
  verificacion: col("verificacion"),
  anios: col("anios_experiencia"),
};

const textos = (xs: string[]) =>
  sql`ARRAY[${sql.join(
    xs.map((x) => sql`${x}`),
    sql`, `,
  )}]::text[]`;

/** Sin tildes y en minúsculas (sin la extensión unaccent, que no siempre está instalada). */
const plano = (e: SQL) => sql`lower(translate(${e}, 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunaeiouun'))`;

const escaparLike = (s: string) => s.replace(/[\\%_]/g, "\\$&");

/** Kilómetros (haversine) entre el docente y un punto; el valor que se muestra se calcula con distanciaKm. */
const distanciaSql = (lat: number, lng: number) => sql`(12742 * asin(sqrt(least(1.0,
  power(sin(radians(${D.lat} - ${lat}::double precision) / 2), 2)
  + cos(radians(${lat}::double precision)) * cos(radians(${D.lat}))
  * power(sin(radians(${D.lng} - ${lng}::double precision) / 2), 2)))))`;

const esDelCatalogo = and(eq(docentes.onboardingCompleto, true), ne(docentes.verificacion, "rechazado"), docenteVisible);

/* ───────────────────────────── Catálogos para los filtros ───────────────────────────── */

const catalogoZonas = cache(async () =>
  getDb().select({ nombre: zonas.nombre, partido: zonas.partido }).from(zonas).orderBy(asc(zonas.orden)),
);

/** Asignaturas y zonas (nombres y partidos) de la base: sugerencias de la búsqueda y vocabulario de "Buscá con IA". */
export const vocabularioBuscador = cache(async () => {
  const [asigs, catalogo] = await Promise.all([
    getDb()
      .select({ nombre: asignaturas.nombre })
      .from(asignaturas)
      .groupBy(asignaturas.nombre)
      .orderBy(asc(min(asignaturas.orden)), asc(asignaturas.nombre)),
    catalogoZonas(),
  ]);
  const partidos = catalogo.map((z) => z.partido).filter((p): p is string => !!p);
  return {
    disciplinas: asigs.map((a) => a.nombre),
    zonas: [...new Set([...catalogo.map((z) => z.nombre), ...partidos])],
  };
});

/** Disciplinas para el filtro, con cuántos perfiles hay en cada una (dentro de la categoría elegida). */
export async function disciplinasParaFiltro(categoria: CategoriaDocente | null, seleccionadas: string[]) {
  const db = getDb();
  const [catalogo, conteos] = await Promise.all([
    db
      .select({ nombre: asignaturas.nombre })
      .from(asignaturas)
      .where(categoria ? eq(asignaturas.categoria, categoria) : undefined)
      .groupBy(asignaturas.nombre)
      .orderBy(asc(min(asignaturas.orden)), asc(asignaturas.nombre)),
    db.execute<{ nombre: string; cantidad: number }>(sql`
      select a as nombre, count(*)::int as cantidad
      from docentes, unnest(asignaturas) as a
      where onboarding_completo and verificacion <> 'rechazado'
      ${categoria ? sql`and categoria = ${categoria}` : sql``}
      group by a`),
  ]);
  const porNombre = new Map(Array.from(conteos).map((c) => [c.nombre, Number(c.cantidad)]));
  const nombres = catalogo.map((c) => c.nombre);
  for (const s of seleccionadas) if (!nombres.includes(s)) nombres.push(s);
  return nombres.map((nombre) => ({ nombre, cantidad: porNombre.get(nombre) ?? 0 }));
}

/* ───────────────────────────── Búsquedas de la institución ───────────────────────────── */

export type BusquedaContexto = {
  id: string;
  puesto: string;
  categoria: CategoriaDocente;
  disciplina: string;
  nivel: string | null;
  turno: string | null;
  tipo: string;
  rapida: boolean;
  estado: "activa" | "pausada" | "cerrada";
};

/** La búsqueda de la URL, solo si es de esta institución (el id viene del cliente: se verifica). */
export async function busquedaDeContexto(institucionId: string, busquedaId: string): Promise<BusquedaContexto | null> {
  const [fila] = await getDb()
    .select({
      id: busquedas.id,
      puesto: busquedas.puesto,
      categoria: busquedas.categoria,
      disciplina: busquedas.disciplina,
      nivel: busquedas.nivel,
      turno: busquedas.turno,
      tipo: busquedas.tipo,
      rapida: busquedas.rapida,
      estado: busquedas.estado,
    })
    .from(busquedas)
    .where(and(eq(busquedas.id, busquedaId), eq(busquedas.institucionId, institucionId)))
    .limit(1);
  return fila ?? null;
}

export type BusquedaInvitable = { id: string; puesto: string; tipo: string; rapida: boolean; detalle: string };

/** Búsquedas a las que hoy se puede invitar: activas y, si son rápidas, que no hayan vencido. */
export async function busquedasActivas(institucionId: string): Promise<BusquedaInvitable[]> {
  const filas = await getDb()
    .select({
      id: busquedas.id,
      puesto: busquedas.puesto,
      tipo: busquedas.tipo,
      rapida: busquedas.rapida,
      turno: busquedas.turno,
      zona: busquedas.zona,
    })
    .from(busquedas)
    .where(
      and(
        eq(busquedas.institucionId, institucionId),
        eq(busquedas.estado, "activa"),
        or(eq(busquedas.rapida, false), isNull(busquedas.venceEn), gt(busquedas.venceEn, new Date())),
      ),
    )
    .orderBy(desc(busquedas.rapida), desc(busquedas.creadoEn));
  return filas.map((b) => ({
    id: b.id,
    puesto: b.puesto,
    tipo: b.tipo,
    rapida: b.rapida,
    detalle: [b.rapida ? "Suplencia rápida" : b.tipo, b.turno, b.zona].filter(Boolean).join(" · "),
  }));
}

/* ───────────────────────────── Buscador ───────────────────────────── */

type ClaveCriterio = "categoria" | "disciplina" | "nivel" | "disponibilidad" | "zona" | "verificacion";
type Criterio = { clave: ClaveCriterio; etiqueta: string; expr: SQL };

export type Coincidencia = {
  cumplidos: number;
  total: number;
  detalle: { clave: ClaveCriterio; etiqueta: string; cumple: boolean }[];
};

export type RelacionActiva = { busquedaId: string; origen: "postulacion" | "invitacion" };

export type DocenteTarjeta = {
  id: string;
  nombre: string;
  apellido: string;
  categoria: CategoriaDocente;
  subtitulo: string | null;
  fotoUrl: string | null;
  verificado: boolean;
  zonas: string[];
  asignaturas: string[];
  niveles: string[];
  disponibilidad: string[];
  aniosExperiencia: number | null;
  distanciaKm: number | null;
  favorito: boolean;
  /** Null cuando hay un solo criterio activo (la verificación): no dice nada. */
  coincide: Coincidencia | null;
  /** Cumple todos los criterios de una búsqueda rápida de contexto. */
  urgente: boolean;
  /** Todavía estudia (presenta la constancia de alumno regular en lugar del título); null si ya se recibió. */
  estudiante: { porcentaje: number | null } | null;
  relaciones: RelacionActiva[];
};

export type ResultadoBuscador = { docentes: DocenteTarjeta[]; total: number; pagina: number; paginas: number };

/** Turno de una búsqueda ("Mañana y tarde") → franjas que declaran los docentes ("Turno mañana"…). */
function franjasDeTurno(turno: string | null): string[] {
  switch (turno) {
    case "Mañana":
      return ["Turno mañana"];
    case "Tarde":
      return ["Turno tarde"];
    case "Mañana y tarde":
      return ["Turno mañana", "Turno tarde"];
    case "Contraturno":
    case "Fin de semana":
      return ["Contraturno / sábados"];
    default:
      return [];
  }
}

/** Docentes que declaran alguna de las franjas; quien está "Full time" cubre cualquiera. */
const cubreFranja = (franjas: string[]) =>
  sql`(${D.disponibilidad} && ${textos(franjas)} or 'Full time' = any(${D.disponibilidad}))`;

function condicionZonas(terminos: string[], catalogo: { nombre: string; partido: string | null }[]): SQL {
  const partes = terminos.map((t) => {
    const n = normalizarTexto(t);
    // Un partido ("San Isidro") vale por todas sus zonas del catálogo.
    const nombres = catalogo
      .filter((z) => normalizarTexto(z.nombre) === n || (z.partido && normalizarTexto(z.partido) === n))
      .map((z) => z.nombre);
    if (nombres.length) return sql`${D.zonas} && ${textos(nombres)}`;
    return sql`exists (select 1 from unnest(${D.zonas}) as z(nombre) where ${plano(sql`z.nombre`)} like ${`%${escaparLike(n)}%`})`;
  });
  return sql`(${sql.join(partes, sql` or `)})`;
}

/**
 * "Coincide en N de M criterios". Los criterios son hasta seis: categoría, disciplina, nivel, disponibilidad,
 * zona y verificación. Cada uno está activo si hay algo que cumplir: el filtro que puso la institución o, si no
 * hay filtro, lo que pide la búsqueda de contexto (?busqueda=). La zona, sin filtro de zonas, se evalúa contra
 * la ubicación de la institución (el docente está dentro de su propio radio de traslado) y la verificación
 * cuenta siempre. N es cuántos de esos M cumple el docente.
 */
function armarCriterios(
  f: FiltrosDocentes,
  ctx: BusquedaContexto | null,
  inst: Pick<Institucion, "lat" | "lng">,
  catalogo: { nombre: string; partido: string | null }[],
): Criterio[] {
  const out: Criterio[] = [];
  const categoria = f.categoria ?? ctx?.categoria ?? null;
  if (categoria) out.push({ clave: "categoria", etiqueta: "Categoría", expr: sql`${D.categoria} = ${categoria}` });

  const disciplinas = f.disciplinas.length ? f.disciplinas : ctx ? [ctx.disciplina] : [];
  if (disciplinas.length)
    out.push({ clave: "disciplina", etiqueta: "Disciplina", expr: sql`${D.asignaturas} && ${textos(disciplinas)}` });

  const nivel = f.nivel ?? ctx?.nivel ?? null;
  if (nivel) out.push({ clave: "nivel", etiqueta: "Nivel", expr: sql`${nivel} = any(${D.niveles})` });

  const franjas = f.disponibilidad.length ? f.disponibilidad : franjasDeTurno(ctx?.turno ?? null);
  if (franjas.length) out.push({ clave: "disponibilidad", etiqueta: "Disponibilidad", expr: cubreFranja(franjas) });

  if (f.zonas.length) {
    out.push({ clave: "zona", etiqueta: "Zona", expr: condicionZonas(f.zonas, catalogo) });
  } else if (inst.lat != null && inst.lng != null) {
    out.push({
      clave: "zona",
      etiqueta: "Zona",
      expr: sql`(${D.lat} is not null and ${D.lng} is not null and ${distanciaSql(inst.lat, inst.lng)} <= ${D.radioKm})`,
    });
  }

  out.push({ clave: "verificacion", etiqueta: "Verificación", expr: sql`${D.verificacion} = 'verificado'` });
  return out;
}

/** Los filtros duros: lo que no los cumple no aparece. */
function armarCondiciones(
  f: FiltrosDocentes,
  rapidas: boolean,
  usuarioId: string,
  catalogo: { nombre: string; partido: string | null }[],
): SQL[] {
  const c: SQL[] = [];
  if (f.categoria) c.push(sql`${D.categoria} = ${f.categoria}`);
  if (f.disciplinas.length) c.push(sql`${D.asignaturas} && ${textos(f.disciplinas)}`);
  if (f.zonas.length) c.push(condicionZonas(f.zonas, catalogo));
  if (f.disponibilidad.length) c.push(cubreFranja(f.disponibilidad));
  if (f.nivel) c.push(sql`${f.nivel} = any(${D.niveles})`);
  if (f.soloVerificados) c.push(sql`${D.verificacion} = 'verificado'`);
  if (f.soloFavoritos)
    c.push(
      sql`exists (select 1 from favoritos fv where fv.usuario_id = ${usuarioId} and fv.tipo = 'docente' and fv.ref_id = ${D.id})`,
    );
  if (f.tipo)
    c.push(
      // No hay "tipo que busca" en el perfil del docente: se deriva de las búsquedas a las que ya se postuló o fue invitado.
      sql`exists (select 1 from postulaciones p inner join busquedas b on b.id = p.busqueda_id where p.docente_id = ${D.id} and b.tipo = ${f.tipo})`,
    );
  if (rapidas)
    // "Disponible ya": perfil verificado que declara jornada completa o al menos dos franjas.
    c.push(
      sql`(${D.verificacion} = 'verificado' and ('Full time' = any(${D.disponibilidad}) or cardinality(${D.disponibilidad}) >= 2))`,
    );
  for (const palabra of normalizarTexto(f.texto).split(" ").filter(Boolean).slice(0, 6)) {
    const pajar = plano(sql`coalesce(${D.nombre}, '') || ' ' || coalesce(${D.apellido}, '') || ' ' || coalesce(${D.subtitulo}, '')
      || ' ' || array_to_string(${D.asignaturas}, ' ') || ' ' || array_to_string(${D.zonas}, ' ')
      || ' ' || case ${D.categoria}
        when 'educador' then 'docente educador educadora profesional profesor profesora maestro maestra'
        when 'entrenador' then 'entrenador entrenadora instructor instructora profesional profesor profesora'
        else 'guardavidas salvavidas profesional' end`);
    c.push(sql`${pajar} like ${`%${escaparLike(palabra)}%`}`);
  }
  return c;
}

type FilaBuscador = Pick<
  Docente,
  | "id"
  | "nombre"
  | "apellido"
  | "categoria"
  | "subtitulo"
  | "fotoUrl"
  | "verificacion"
  | "zonas"
  | "asignaturas"
  | "niveles"
  | "disponibilidad"
  | "aniosExperiencia"
  | "lat"
  | "lng"
> & { favorito: boolean } & Record<`c${number}`, boolean>;

export async function buscarDocentes(args: {
  institucion: Pick<Institucion, "lat" | "lng">;
  usuarioId: string;
  filtros: FiltrosDocentes;
  /** Pantalla de búsquedas rápidas: solo docentes "disponibles ya". */
  rapidas: boolean;
  contexto: BusquedaContexto | null;
  /** Búsquedas activas de la institución: para marcar a quién ya invitó o se postuló. */
  activas: BusquedaInvitable[];
}): Promise<ResultadoBuscador> {
  const { institucion, usuarioId, filtros, rapidas, contexto, activas } = args;
  const db = getDb();
  const catalogo = await catalogoZonas();
  const donde = and(esDelCatalogo, ...armarCondiciones(filtros, rapidas, usuarioId, catalogo));
  const criterios = armarCriterios(filtros, contexto, institucion, catalogo);

  const [{ n: total }] = await db.select({ n: count() }).from(docentes).where(donde);
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const pagina = Math.min(filtros.pagina, paginas);

  const puntaje = sql`(${sql.join(
    criterios.map((c) => sql`coalesce(${c.expr}, false)::int`),
    sql` + `,
  )})`;
  const conCoordenadas = institucion.lat != null && institucion.lng != null;
  const orden: SQL[] =
    filtros.orden === "experiencia"
      ? [sql`${D.anios} desc nulls last`, sql`${puntaje} desc`]
      : filtros.orden === "cercania" && conCoordenadas
        ? [sql`${distanciaSql(institucion.lat!, institucion.lng!)} asc nulls last`, sql`${puntaje} desc`]
        : filtros.orden === "nombre"
          ? []
          : [sql`${puntaje} desc`, sql`(${D.verificacion} = 'verificado') desc`, sql`${D.anios} desc nulls last`];
  orden.push(sql`${D.apellido} asc`, sql`${D.nombre} asc`, sql`${D.id} asc`);

  const campos = {
    id: docentes.id,
    nombre: docentes.nombre,
    apellido: docentes.apellido,
    categoria: docentes.categoria,
    subtitulo: docentes.subtitulo,
    fotoUrl: docentes.fotoUrl,
    verificacion: docentes.verificacion,
    zonas: docentes.zonas,
    asignaturas: docentes.asignaturas,
    niveles: docentes.niveles,
    disponibilidad: docentes.disponibilidad,
    aniosExperiencia: docentes.aniosExperiencia,
    lat: docentes.lat,
    lng: docentes.lng,
    favorito: sql<boolean>`exists (select 1 from favoritos f where f.usuario_id = ${usuarioId} and f.tipo = 'docente' and f.ref_id = ${D.id})`
      .mapWith(Boolean)
      .as("favorito"),
    ...Object.fromEntries(
      criterios.map((c, i) => [`c${i}`, sql<boolean>`coalesce(${c.expr}, false)`.mapWith(Boolean).as(`c${i}`)]),
    ),
  };

  const filas = (await db
    .select(campos)
    .from(docentes)
    .where(donde)
    .orderBy(...orden)
    .limit(POR_PAGINA)
    .offset((pagina - 1) * POR_PAGINA)) as unknown as FilaBuscador[];

  const ids = filas.map((f) => f.id);
  const activasIds = activas.map((a) => a.id);
  const [relaciones, estudiantes] = await Promise.all([
    ids.length && activasIds.length
      ? db
          .select({ docenteId: postulaciones.docenteId, busquedaId: postulaciones.busquedaId, origen: postulaciones.origen })
          .from(postulaciones)
          .where(and(inArray(postulaciones.docenteId, ids), inArray(postulaciones.busquedaId, activasIds)))
      : [],
    estudiantesEntre(ids),
  ]);

  const docentesTarjeta = filas.map((f): DocenteTarjeta => {
    const detalle = criterios.map((c, i) => ({ clave: c.clave, etiqueta: c.etiqueta, cumple: f[`c${i}`] }));
    const cumplidos = detalle.filter((d) => d.cumple).length;
    return {
      id: f.id,
      nombre: f.nombre,
      apellido: f.apellido,
      categoria: f.categoria,
      subtitulo: f.subtitulo,
      fotoUrl: f.fotoUrl,
      verificado: f.verificacion === "verificado",
      zonas: f.zonas,
      asignaturas: f.asignaturas,
      niveles: f.niveles,
      disponibilidad: f.disponibilidad,
      aniosExperiencia: f.aniosExperiencia,
      distanciaKm:
        conCoordenadas && f.lat != null && f.lng != null
          ? distanciaKm({ lat: institucion.lat!, lng: institucion.lng! }, { lat: f.lat, lng: f.lng })
          : null,
      favorito: f.favorito,
      coincide: criterios.length > 1 ? { cumplidos, total: criterios.length, detalle } : null,
      urgente: !!contexto?.rapida && criterios.length > 1 && cumplidos === criterios.length,
      estudiante: estudiantes.get(f.id) ?? null,
      relaciones: relaciones.filter((r) => r.docenteId === f.id).map((r) => ({ busquedaId: r.busquedaId, origen: r.origen })),
    };
  });

  return { docentes: docentesTarjeta, total, pagina, paginas };
}

/* ───────────────────────────── Perfil de un docente ───────────────────────────── */

export type RelacionConBusqueda = {
  busquedaId: string;
  puesto: string;
  estadoBusqueda: "activa" | "pausada" | "cerrada";
  etapa: EtapaPostulacion;
  origen: "postulacion" | "invitacion";
  desde: Date;
};

export type PerfilDocente = {
  docente: Docente;
  verificado: boolean;
  favorito: boolean;
  /** El docente le mandó su CV a esta institución desde el perfil público. */
  envioCv: boolean;
  /** Se muestra el contacto directo solo si se postuló a una búsqueda de esta institución o le mandó su CV. */
  puedeContactar: boolean;
  /** Grilla semanal declarada (por día y franja); null si todavía no declaró disponibilidad. */
  grilla: GrillaDisponibilidad | null;
  /** Cuándo actualizó su disponibilidad por última vez. */
  grillaActualizadaEn: Date | null;
  /** Todavía estudia: presenta la constancia de alumno regular en lugar del título. Null si ya se recibió. */
  estudiante: { porcentaje: number | null } | null;
  /** Búsquedas activas de la institución a las que se lo puede invitar, con su situación actual (si ya está). */
  busquedasDelDocente: (BusquedaInvitable & { relacion: { origen: "postulacion" | "invitacion"; etapa: EtapaPostulacion } | null })[];
  /** En qué búsquedas de la institución está cargado, en cualquier estado. */
  enBusquedas: RelacionConBusqueda[];
  postulacionesActivas: number;
};

export async function perfilDeDocente(
  institucionId: string,
  usuarioId: string,
  docenteId: string,
): Promise<PerfilDocente | null> {
  const db = getDb();
  const [docente] = await db.select().from(docentes).where(eq(docentes.id, docenteId)).limit(1);
  if (!docente) return null;

  const [relaciones, activas, [fav], [cv], [horarios], [{ n: postulacionesActivas }]] = await Promise.all([
    db
      .select({
        busquedaId: busquedas.id,
        puesto: busquedas.puesto,
        estadoBusqueda: busquedas.estado,
        etapa: postulaciones.etapa,
        origen: postulaciones.origen,
        desde: postulaciones.etapaDesde,
      })
      .from(postulaciones)
      .innerJoin(busquedas, eq(busquedas.id, postulaciones.busquedaId))
      .where(and(eq(postulaciones.docenteId, docenteId), eq(busquedas.institucionId, institucionId)))
      .orderBy(desc(postulaciones.etapaDesde)),
    busquedasActivas(institucionId),
    db
      .select({ refId: favoritos.refId })
      .from(favoritos)
      .where(and(eq(favoritos.usuarioId, usuarioId), eq(favoritos.tipo, "docente"), eq(favoritos.refId, docenteId)))
      .limit(1),
    db
      .select({ docenteId: cvEnviados.docenteId })
      .from(cvEnviados)
      .where(and(eq(cvEnviados.docenteId, docenteId), eq(cvEnviados.institucionId, institucionId)))
      .limit(1),
    db
      // Solo la grilla y si estudia: docente_detalle también guarda DNI, CUIL y domicilio, que no se leen acá.
      .select({
        grilla: docenteDetalle.grillaDisponibilidad,
        actualizadoEn: docenteDetalle.actualizadoEn,
        situacionEstudio: docenteDetalle.situacionEstudio,
        porcentajeMaterias: docenteDetalle.porcentajeMaterias,
      })
      .from(docenteDetalle)
      .where(eq(docenteDetalle.docenteId, docenteId))
      .limit(1),
    db
      .select({ n: count() })
      .from(postulaciones)
      .innerJoin(busquedas, eq(busquedas.id, postulaciones.busquedaId))
      .where(
        and(
          eq(postulaciones.docenteId, docenteId),
          notInArray(postulaciones.etapa, ["contratado", "descartado"]),
          eq(busquedas.estado, "activa"),
        ),
      ),
  ]);

  // Un perfil sin alta terminada o rechazado no se ve, salvo que ya tenga trato con esta institución.
  const visible = docente.onboardingCompleto && docente.verificacion !== "rechazado" && !docente.suspendido;
  if (!visible && relaciones.length === 0 && !cv) return null;

  // Sin grilla guardada (perfiles de ejemplo), se arma desde la lista de turnos.
  const guardada = horarios?.grilla ? grillaDesdeJson(horarios.grilla) : null;
  const usaGuardada = !!guardada && grillaTieneHorarios(guardada);
  const grilla = usaGuardada
    ? guardada
    : docente.disponibilidad.length > 0
      ? grillaDesdeLista(docente.disponibilidad)
      : null;

  return {
    docente,
    verificado: docente.verificacion === "verificado",
    favorito: !!fav,
    envioCv: !!cv,
    puedeContactar: !!cv || relaciones.some((r) => r.origen === "postulacion"),
    grilla,
    grillaActualizadaEn: usaGuardada ? horarios!.actualizadoEn : grilla ? docente.actualizadoEn : null,
    estudiante: esEstudiante(horarios?.situacionEstudio) ? { porcentaje: horarios?.porcentajeMaterias ?? null } : null,
    busquedasDelDocente: activas.map((b) => {
      const r = relaciones.find((x) => x.busquedaId === b.id);
      return { ...b, relacion: r ? { origen: r.origen, etapa: r.etapa } : null };
    }),
    enBusquedas: relaciones,
    postulacionesActivas,
  };
}

/* ───────────────────────────── Base de la institución ("Profesionales") ───────────────────────────── */

export type PestanaBase = "todos" | "postularon" | "cv" | "invitados" | "contratados" | "favoritos" | "cargados";
export const PESTANAS_BASE: { clave: PestanaBase; etiqueta: string }[] = [
  { clave: "todos", etiqueta: "Todos" },
  { clave: "postularon", etiqueta: "Se postularon" },
  { clave: "cv", etiqueta: "Enviaron CV" },
  { clave: "invitados", etiqueta: "Invitados" },
  { clave: "contratados", etiqueta: "Contratados" },
  { clave: "favoritos", etiqueta: "Favoritos" },
  { clave: "cargados", etiqueta: "Cargados por vos" },
];

/** Un contacto que la institución cargó a mano o por CSV (tabla `contactos_institucion`). */
export type ContactoVista = {
  id: string;
  nombre: string;
  email: string | null;
  telefono: string | null;
  disciplina: string | null;
  nota: string | null;
};

export type FilaBase = {
  /** Clave estable de la fila: el id del docente, o "contacto:<id>" en los cargados por la institución. */
  clave: string;
  /** Null en los contactos cargados por la institución (no son docentes de UNIDOAR). */
  docenteId: string | null;
  /** Solo en los contactos cargados: sus datos, para editarlos. */
  contacto: ContactoVista | null;
  nombre: string;
  /**
   * Docentes: solo si se postuló a una búsqueda o mandó su CV (igual que el contacto de la ficha) y el perfil no está
   * suspendido. Contactos cargados: el que escribió la institución.
   */
  email: string | null;
  fotoUrl: string | null;
  /** Null en los contactos cargados: no tienen categoría. */
  categoria: CategoriaDocente | null;
  disciplina: string;
  /** El equipo suspendió el perfil: se avisa en la fila y no se muestra su contacto. */
  suspendido: boolean;
  /** Cómo llegó a la base, por orden de importancia. */
  origen: "contratado" | "postulo" | "cv" | "invitado" | "favorito" | "cargado";
  busqueda: string | null;
  fecha: Date;
  estado: string;
};

type Acumulado = FilaBase & {
  esPostulo: boolean;
  esCv: boolean;
  esInvitado: boolean;
  esContratado: boolean;
  esFavorito: boolean;
  esCargado: boolean;
};

export type BaseDeDocentes = {
  stats: { perfiles: number; postularon: number; cv: number; invitados: number; contratados: number; cargados: number };
  cantidades: Record<PestanaBase, number>;
  filas: FilaBase[];
  total: number;
  pagina: number;
  paginas: number;
};

/**
 * Personas que pasaron por la institución: docentes que se postularon, le mandaron su CV, los invitó, los contrató, o
 * los guardó como favoritos el usuario de la sesión (los favoritos son por cuenta), más los contactos que la propia
 * institución cargó a mano o por CSV. Se arma en memoria: el universo es el de una sola institución.
 */
export async function baseDeDocentes(
  institucionId: string,
  usuarioId: string,
  opciones: { pestana: PestanaBase; q: string; pagina: number },
): Promise<BaseDeDocentes> {
  const db = getDb();
  const datosDocente = {
    docenteId: docentes.id,
    nombre: docentes.nombre,
    apellido: docentes.apellido,
    email: docentes.email,
    fotoUrl: docentes.fotoUrl,
    categoria: docentes.categoria,
    asignaturas: docentes.asignaturas,
    subtitulo: docentes.subtitulo,
    suspendido: docentes.suspendido,
  };
  const [pos, favs, cvs, cargados] = await Promise.all([
    db
      .select({
        ...datosDocente,
        etapa: postulaciones.etapa,
        origen: postulaciones.origen,
        desde: postulaciones.etapaDesde,
        puesto: busquedas.puesto,
      })
      .from(postulaciones)
      .innerJoin(busquedas, eq(busquedas.id, postulaciones.busquedaId))
      .innerJoin(docentes, eq(docentes.id, postulaciones.docenteId))
      .where(eq(busquedas.institucionId, institucionId))
      .orderBy(asc(postulaciones.etapaDesde)),
    db
      .select({ ...datosDocente, guardadoEn: favoritos.creadoEn })
      .from(favoritos)
      .innerJoin(docentes, eq(docentes.id, favoritos.refId))
      .where(and(eq(favoritos.usuarioId, usuarioId), eq(favoritos.tipo, "docente"))),
    db
      .select({ ...datosDocente, enviadoEn: cvEnviados.creadoEn })
      .from(cvEnviados)
      .innerJoin(docentes, eq(docentes.id, cvEnviados.docenteId))
      .where(eq(cvEnviados.institucionId, institucionId)),
    db
      .select({
        id: contactosInstitucion.id,
        nombre: contactosInstitucion.nombre,
        email: contactosInstitucion.email,
        telefono: contactosInstitucion.telefono,
        disciplina: contactosInstitucion.disciplina,
        nota: contactosInstitucion.nota,
        creadoEn: contactosInstitucion.creadoEn,
      })
      .from(contactosInstitucion)
      .where(eq(contactosInstitucion.institucionId, institucionId)),
  ]);

  const mapa = new Map<string, Acumulado>();
  const asegurar = (d: (typeof pos)[number] | (typeof favs)[number] | (typeof cvs)[number]): Acumulado => {
    let a = mapa.get(d.docenteId);
    if (!a) {
      a = {
        clave: d.docenteId,
        docenteId: d.docenteId,
        contacto: null,
        nombre: `${d.nombre} ${d.apellido}`.trim(),
        email: d.email,
        suspendido: d.suspendido,
        fotoUrl: d.fotoUrl,
        categoria: d.categoria,
        disciplina: d.asignaturas.slice(0, 2).join(", ") || d.subtitulo || "—",
        origen: "favorito",
        busqueda: null,
        fecha: new Date(0),
        estado: "Sin contactar",
        esPostulo: false,
        esCv: false,
        esInvitado: false,
        esContratado: false,
        esFavorito: false,
        esCargado: false,
      };
      mapa.set(d.docenteId, a);
    }
    return a;
  };

  // Ordenadas de la más vieja a la más nueva: la última pisa a las anteriores.
  for (const p of pos) {
    const a = asegurar(p);
    if (p.origen === "postulacion") a.esPostulo = true;
    else a.esInvitado = true;
    if (p.etapa === "contratado") a.esContratado = true;
    a.busqueda = p.puesto;
    a.fecha = p.desde > a.fecha ? p.desde : a.fecha;
    a.estado =
      p.origen === "invitacion" && p.etapa === "nuevos" ? "Invitación enviada" : ETAPA_LABEL[p.etapa];
  }
  for (const f of favs) {
    const a = asegurar(f);
    a.esFavorito = true;
    a.fecha = f.guardadoEn > a.fecha ? f.guardadoEn : a.fecha;
  }
  for (const c of cvs) {
    const a = asegurar(c);
    a.esCv = true;
    a.fecha = c.enviadoEn > a.fecha ? c.enviadoEn : a.fecha;
  }
  for (const c of cargados) {
    const clave = `contacto:${c.id}`;
    mapa.set(clave, {
      clave,
      docenteId: null,
      contacto: { id: c.id, nombre: c.nombre, email: c.email, telefono: c.telefono, disciplina: c.disciplina, nota: c.nota },
      nombre: c.nombre,
      email: c.email,
      suspendido: false,
      fotoUrl: null,
      categoria: null,
      disciplina: c.disciplina ?? "—",
      origen: "cargado",
      busqueda: null,
      fecha: c.creadoEn,
      estado: "—",
      esPostulo: false,
      esCv: false,
      esInvitado: false,
      esContratado: false,
      esFavorito: false,
      esCargado: true,
    });
  }

  const todos = [...mapa.values()];
  for (const a of todos) {
    a.origen = a.esCargado
      ? "cargado"
      : a.esContratado
        ? "contratado"
        : a.esPostulo
          ? "postulo"
          : a.esCv
            ? "cv"
            : a.esInvitado
              ? "invitado"
              : "favorito";
    if (a.esContratado) a.estado = "Contratado/a";
  }

  const cantidades: Record<PestanaBase, number> = {
    todos: todos.length,
    postularon: todos.filter((a) => a.esPostulo).length,
    cv: todos.filter((a) => a.esCv).length,
    invitados: todos.filter((a) => a.esInvitado).length,
    contratados: todos.filter((a) => a.esContratado).length,
    favoritos: todos.filter((a) => a.esFavorito).length,
    cargados: todos.filter((a) => a.esCargado).length,
  };

  const pertenece: Record<PestanaBase, (a: Acumulado) => boolean> = {
    todos: () => true,
    postularon: (a) => a.esPostulo,
    cv: (a) => a.esCv,
    invitados: (a) => a.esInvitado,
    contratados: (a) => a.esContratado,
    favoritos: (a) => a.esFavorito,
    cargados: (a) => a.esCargado,
  };
  const consulta = normalizarTexto(opciones.q);
  const visibles = todos
    .filter(pertenece[opciones.pestana])
    .filter((a) => !consulta || normalizarTexto(`${a.nombre} ${a.disciplina}`).includes(consulta))
    .sort((x, y) => y.fecha.getTime() - x.fecha.getTime() || x.nombre.localeCompare(y.nombre, "es"));

  const paginas = Math.max(1, Math.ceil(visibles.length / POR_PAGINA_BASE));
  const pagina = Math.min(Math.max(1, opciones.pagina), paginas);
  const filas = visibles.slice((pagina - 1) * POR_PAGINA_BASE, pagina * POR_PAGINA_BASE).map((a): FilaBase => ({
    clave: a.clave,
    docenteId: a.docenteId,
    contacto: a.contacto,
    nombre: a.nombre,
    // El de un docente solo se muestra si se postuló o mandó su CV y no está suspendido; el de un contacto cargado es de la institución.
    email: a.esCargado || (!a.suspendido && (a.esPostulo || a.esCv)) ? a.email : null,
    suspendido: a.suspendido,
    fotoUrl: a.fotoUrl,
    categoria: a.categoria,
    disciplina: a.disciplina,
    origen: a.origen,
    busqueda: a.busqueda,
    fecha: a.fecha,
    estado: a.estado,
  }));

  return {
    stats: {
      perfiles: cantidades.todos,
      postularon: cantidades.postularon,
      cv: cantidades.cv,
      invitados: cantidades.invitados,
      contratados: cantidades.contratados,
      cargados: cantidades.cargados,
    },
    cantidades,
    filas,
    total: visibles.length,
    pagina,
    paginas,
  };
}
