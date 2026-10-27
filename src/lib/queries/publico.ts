import "server-only";
import { cache } from "react";
import { and, asc, count, countDistinct, desc, eq, gt, isNotNull, isNull, or, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { asignaturas, busquedas, docentes, instituciones, testimonios, type CategoriaDocente } from "@/db/schema";
import { CATEGORIAS } from "@/lib/catalogo";
import { sedesDeInstitucion } from "@/lib/queries/sedes";
import { fotosDeInstitucion, novedadesDeInstitucion } from "@/lib/queries/vitrina";
import { aSedePublica, type SedePublica } from "@/lib/sedes";
import type { VitrinaFotoVista, VitrinaNovedadVista } from "@/lib/vitrina";
import { busquedaDeInstitucionActiva, busquedaVigente, docenteVisible, institucionVisible } from "@/lib/visibilidad";

/* Lecturas del sitio público (sin sesión). Todo sale de la base: nada de cifras fijas. */

export type ConteoCategoria = {
  /** Docentes verificados con el alta completa. */
  verificados: number;
  busquedasActivas: number;
  /** Instituciones distintas con al menos una búsqueda activa de la categoría. */
  institucionesBuscando: number;
  /** Búsquedas rápidas activas que todavía aceptan respuesta. */
  urgentes: number;
};

export type ResumenPublico = {
  docentesVerificados: number;
  institucionesVerificadas: number;
  busquedasActivas: number;
  urgentes: number;
  /** Asignaturas y disciplinas del catálogo. */
  disciplinas: number;
  /** Tipos de institución distintos que ya usan la plataforma. */
  tiposInstitucion: number;
  categorias: Record<CategoriaDocente, ConteoCategoria>;
};

/** Contadores del hero, de las landings y de las tarjetas de categoría. Una vez por request. */
export const resumenPublico = cache(async (): Promise<ResumenPublico> => {
  const db = getDb();
  const [filasDocentes, filasBusquedas, [filaInst], [filaDisc]] = await Promise.all([
    db
      .select({ categoria: docentes.categoria, n: count() })
      .from(docentes)
      .where(and(eq(docentes.verificacion, "verificado"), eq(docentes.onboardingCompleto, true), docenteVisible))
      .groupBy(docentes.categoria),
    db
      .select({
        categoria: busquedas.categoria,
        activas: count(),
        instituciones: countDistinct(busquedas.institucionId),
        urgentes: sql<number>`count(*) filter (where ${busquedas.rapida} and (${busquedas.venceEn} is null or ${busquedas.venceEn} > now()))`.mapWith(
          Number,
        ),
      })
      .from(busquedas)
      .where(and(busquedaVigente, busquedaDeInstitucionActiva))
      .groupBy(busquedas.categoria),
    db
      .select({
        verificadas: sql<number>`count(*) filter (where ${instituciones.verificada})`.mapWith(Number),
        tipos: countDistinct(instituciones.tipo),
      })
      .from(instituciones)
      .where(institucionVisible),
    db.select({ n: count() }).from(asignaturas),
  ]);

  const categorias = Object.fromEntries(
    CATEGORIAS.map((c) => [c, { verificados: 0, busquedasActivas: 0, institucionesBuscando: 0, urgentes: 0 }]),
  ) as Record<CategoriaDocente, ConteoCategoria>;
  for (const f of filasDocentes) categorias[f.categoria].verificados = f.n;
  for (const f of filasBusquedas) {
    categorias[f.categoria].busquedasActivas = f.activas;
    categorias[f.categoria].institucionesBuscando = f.instituciones;
    categorias[f.categoria].urgentes = f.urgentes;
  }
  const suma = (k: keyof ConteoCategoria) => CATEGORIAS.reduce((t, c) => t + categorias[c][k], 0);

  return {
    docentesVerificados: suma("verificados"),
    institucionesVerificadas: filaInst?.verificadas ?? 0,
    busquedasActivas: suma("busquedasActivas"),
    urgentes: suma("urgentes"),
    disciplinas: filaDisc?.n ?? 0,
    tiposInstitucion: filaInst?.tipos ?? 0,
    categorias,
  };
});

/* ───────── Logos y testimonios ───────── */

export type LogoInstitucion = { id: string; slug: string; nombre: string; logoUrl: string };

/**
 * Los logos de la tira "Confían en UNIDOAR" de la portada (2026-10-27, definición del cliente): **solo las instituciones fundadoras**, verificadas, visibles y
 * con logo, y **nunca las de ejemplo** (instituciones que no existen) aunque el interruptor de datos de ejemplo esté apagado. Sin ninguna, la tira no se dibuja.
 * Las más antiguas primero.
 */
export async function logosInstituciones(limite = 24): Promise<LogoInstitucion[]> {
  const filas = await getDb()
    .select({ id: instituciones.id, slug: instituciones.slug, nombre: instituciones.nombre, logoUrl: instituciones.logoUrl })
    .from(instituciones)
    .where(
      and(
        eq(instituciones.plan, "fundador"),
        eq(instituciones.verificada, true),
        eq(instituciones.esDemo, false),
        isNotNull(instituciones.logoUrl),
        institucionVisible,
      ),
    )
    .orderBy(asc(instituciones.creadoEn), asc(instituciones.nombre))
    .limit(limite);
  return filas.flatMap((f) => (f.logoUrl ? [{ ...f, logoUrl: f.logoUrl }] : []));
}

export type FundadoraPublica = { id: string; slug: string; nombre: string; logoUrl: string | null };

/**
 * Las instituciones fundadoras que se muestran en la portada: las que tienen el Plan Fundador, están verificadas y son visibles (sin las de
 * ejemplo si el interruptor está prendido). Se dice cuál es, nunca el plan ni su precio. Por antigüedad: las primeras que se sumaron, primero.
 */
export async function fundadorasPublicas(limite = 60): Promise<FundadoraPublica[]> {
  return getDb()
    .select({ id: instituciones.id, slug: instituciones.slug, nombre: instituciones.nombre, logoUrl: instituciones.logoUrl })
    .from(instituciones)
    .where(and(eq(instituciones.plan, "fundador"), eq(instituciones.verificada, true), institucionVisible))
    .orderBy(asc(instituciones.creadoEn), asc(instituciones.nombre))
    .limit(limite);
}

export type TestimonioPublico = { id: string; cita: string; autor: string; cargo: string; fotoUrl: string | null };

/**
 * Los testimonios VISIBLES de una página ("home", "educadores", "entrenadores" o "guardavidas"), los que carga el equipo en Backoffice → Testimonios
 * (los genéricos de ejemplo originales quedaron ocultos). No depende de `OCULTAR_DATOS_DE_EJEMPLO`: lo que el equipo cargó es real. Las secciones sin
 * testimonios no se dibujan.
 */
export async function testimoniosDe(pagina: string): Promise<TestimonioPublico[]> {
  return getDb()
    .select({
      id: testimonios.id,
      cita: testimonios.cita,
      autor: testimonios.autor,
      cargo: testimonios.cargo,
      fotoUrl: testimonios.fotoUrl,
    })
    .from(testimonios)
    .where(and(eq(testimonios.pagina, pagina), eq(testimonios.visible, true)))
    .orderBy(asc(testimonios.orden), asc(testimonios.autor));
}

/* ───────── Búsquedas ───────── */

export type BusquedaPublica = {
  id: string;
  puesto: string;
  categoria: CategoriaDocente;
  disciplina: string;
  tipo: string;
  rapida: boolean;
  zona: string | null;
  /** Horario ya armado para mostrar. */
  horario: string | null;
  venceEn: Date | null;
  institucion: { id: string; slug: string; nombre: string; logoUrl: string | null; verificada: boolean };
};

const columnasBusqueda = {
  id: busquedas.id,
  puesto: busquedas.puesto,
  categoria: busquedas.categoria,
  disciplina: busquedas.disciplina,
  tipo: busquedas.tipo,
  rapida: busquedas.rapida,
  zona: busquedas.zona,
  zonaInstitucion: instituciones.zona,
  horario: busquedas.horario,
  turno: busquedas.turno,
  cargaHoraria: busquedas.cargaHoraria,
  venceEn: busquedas.venceEn,
  institucionId: instituciones.id,
  institucionSlug: instituciones.slug,
  institucionNombre: instituciones.nombre,
  logoUrl: instituciones.logoUrl,
  verificada: instituciones.verificada,
};

function aBusquedaPublica(f: {
  id: string;
  puesto: string;
  categoria: CategoriaDocente;
  disciplina: string;
  tipo: string;
  rapida: boolean;
  zona: string | null;
  zonaInstitucion: string | null;
  horario: string | null;
  turno: string | null;
  cargaHoraria: string | null;
  venceEn: Date | null;
  institucionId: string;
  institucionSlug: string;
  institucionNombre: string;
  logoUrl: string | null;
  verificada: boolean;
}): BusquedaPublica {
  return {
    id: f.id,
    puesto: f.puesto,
    categoria: f.categoria,
    disciplina: f.disciplina,
    tipo: f.tipo,
    rapida: f.rapida,
    zona: f.zona ?? f.zonaInstitucion,
    horario: f.horario || [f.turno, f.cargaHoraria].filter(Boolean).join(" · ") || null,
    venceEn: f.venceEn,
    institucion: {
      id: f.institucionId,
      slug: f.institucionSlug,
      nombre: f.institucionNombre,
      logoUrl: f.logoUrl,
      verificada: f.verificada,
    },
  };
}

/** Búsquedas rápidas activas que todavía aceptan respuesta, las que vencen antes primero. */
export async function busquedasUrgentes(opciones: { categoria?: CategoriaDocente; limite?: number } = {}) {
  const { categoria, limite = 3 } = opciones;
  const filas = await getDb()
    .select(columnasBusqueda)
    .from(busquedas)
    .innerJoin(instituciones, eq(instituciones.id, busquedas.institucionId))
    .where(
      and(
        eq(busquedas.rapida, true),
        eq(busquedas.estado, "activa"),
        institucionVisible,
        or(isNull(busquedas.venceEn), gt(busquedas.venceEn, sql`now()`)),
        categoria ? eq(busquedas.categoria, categoria) : undefined,
      ),
    )
    .orderBy(sql`${busquedas.venceEn} asc nulls last`, desc(busquedas.creadoEn))
    .limit(limite);
  return filas.map(aBusquedaPublica);
}

/* ───────── Una búsqueda (la página que se comparte) ───────── */

export type OfertaPublica = {
  id: string;
  puesto: string;
  categoria: CategoriaDocente;
  tipo: string;
  rapida: boolean;
  /** Sigue recibiendo postulaciones. Si no, la página dice que ya no está abierta y no muestra el detalle. */
  abierta: boolean;
  /** Por qué ya no está abierta (null si lo está). */
  cierre: "cerrada" | "pausada" | "vencida" | null;
  /** Hasta cuándo se acepta respuesta (solo las rápidas abiertas). */
  venceEn: Date | null;
  // El detalle va vacío cuando la búsqueda ya no está abierta: un enlace compartido que sobrevive a la búsqueda no es una forma de seguir leyéndola.
  zona: string | null;
  /** Cuál es la sede, solo cuando la institución tiene más de una. */
  sede: string | null;
  turno: string | null;
  nivel: string | null;
  disciplina: string | null;
  cargaHoraria: string | null;
  horario: string | null;
  fechaInicio: string | null;
  descripcion: string | null;
  requisitos: string[];
  beneficios: string[];
  institucion: { slug: string; nombre: string; tipo: string; logoUrl: string | null; verificada: boolean; fundadora: boolean; zona: string | null };
};

/**
 * La búsqueda que abre un enlace compartido (`/ofertas/<id>`), sin sesión. Null si no existe o si es de una institución suspendida (o de ejemplo,
 * cuando se ocultan). Lo que ve cualquiera es lo mismo que ya muestran el buscador público y la página de la institución, más la descripción,
 * los requisitos y lo que ofrece: nunca quiénes se postularon ni datos de contacto.
 */
export const ofertaPublica = cache(async (id: string): Promise<OfertaPublica | null> => {
  const db = getDb();
  const [fila] = await db
    .select({ b: busquedas, i: instituciones })
    .from(busquedas)
    .innerJoin(instituciones, eq(instituciones.id, busquedas.institucionId))
    .where(and(eq(busquedas.id, id), institucionVisible))
    .limit(1);
  if (!fila) return null;
  const { b, i } = fila;

  const vencida = b.estado === "activa" && b.rapida && b.venceEn !== null && b.venceEn.getTime() <= Date.now();
  const cierre = b.estado === "cerrada" ? "cerrada" : b.estado === "pausada" ? "pausada" : vencida ? "vencida" : null;
  const abierta = cierre === null;

  const sedes = abierta && b.sedeId ? await sedesDeInstitucion(i.id) : [];
  const sede = sedes.length > 1 ? (sedes.find((s) => s.id === b.sedeId)?.nombre ?? null) : null;

  return {
    id: b.id,
    puesto: b.puesto,
    categoria: b.categoria,
    tipo: b.tipo,
    rapida: b.rapida,
    abierta,
    cierre,
    venceEn: abierta && b.rapida ? b.venceEn : null,
    zona: abierta ? (b.zona ?? i.zona) : null,
    sede,
    turno: abierta ? b.turno : null,
    nivel: abierta ? b.nivel : null,
    disciplina: abierta ? b.disciplina : null,
    cargaHoraria: abierta ? b.cargaHoraria : null,
    horario: abierta ? b.horario : null,
    fechaInicio: abierta ? b.fechaInicio : null,
    descripcion: abierta ? b.descripcion : null,
    requisitos: abierta ? b.requisitos : [],
    beneficios: abierta ? b.beneficios : [],
    institucion: { slug: i.slug, nombre: i.nombre, tipo: i.tipo, logoUrl: i.logoUrl, verificada: i.verificada, fundadora: i.plan === "fundador", zona: i.zona },
  };
});

/* ───────── Instituciones ───────── */

export type PerfilInstitucionPublico = {
  id: string;
  slug: string;
  nombre: string;
  tipo: string;
  zona: string | null;
  direccion: string | null;
  descripcion: string | null;
  logoUrl: string | null;
  portadaUrl: string | null;
  alumnos: number | null;
  niveles: string | null;
  turnos: string | null;
  docentesPlanta: number | null;
  fundada: number | null;
  verificada: boolean;
  /** Tiene el Plan Fundador: lleva la insignia «Institución fundadora». Solo el hecho, nunca el plan ni su precio. */
  fundadora: boolean;
  mision: string | null;
  vision: string | null;
  valores: string[];
  horarioAdministracion: string | null;
  fotos: VitrinaFotoVista[];
  novedades: VitrinaNovedadVista[];
  /** Todas sus sedes, la principal primero (sin el CUE). */
  sedes: SedePublica[];
  /** `sede`: en cuál es la búsqueda, solo cuando la institución tiene más de una. */
  busquedas: { id: string; puesto: string; tipo: string; turno: string | null; rapida: boolean; sede: string | null }[];
};

/** Perfil público de una institución por su slug, con sus búsquedas activas. Null si no existe. */
export const institucionPublica = cache(async (slug: string): Promise<PerfilInstitucionPublico | null> => {
  const db = getDb();
  const [inst] = await db
    .select()
    .from(instituciones)
    .where(and(eq(instituciones.slug, slug), institucionVisible))
    .limit(1);
  if (!inst) return null;
  const [abiertas, fotos, novedades, sedes] = await Promise.all([
    db
      .select({
        id: busquedas.id,
        puesto: busquedas.puesto,
        tipo: busquedas.tipo,
        turno: busquedas.turno,
        rapida: busquedas.rapida,
        sedeId: busquedas.sedeId,
      })
      .from(busquedas)
      .where(and(eq(busquedas.institucionId, inst.id), busquedaVigente))
      .orderBy(desc(busquedas.rapida), desc(busquedas.creadoEn)),
    fotosDeInstitucion(inst.id),
    novedadesDeInstitucion(inst.id, 6),
    sedesDeInstitucion(inst.id),
  ]);
  const nombreDeSede = new Map(sedes.map((s) => [s.id, s.nombre] as const));
  return {
    id: inst.id,
    slug: inst.slug,
    nombre: inst.nombre,
    tipo: inst.tipo,
    zona: inst.zona,
    direccion: inst.direccion,
    descripcion: inst.descripcion,
    logoUrl: inst.logoUrl,
    portadaUrl: inst.portadaUrl,
    alumnos: inst.alumnos,
    niveles: inst.niveles,
    turnos: inst.turnos,
    docentesPlanta: inst.docentesPlanta,
    fundada: inst.fundada,
    verificada: inst.verificada,
    fundadora: inst.plan === "fundador",
    mision: inst.mision,
    vision: inst.vision,
    valores: inst.valores,
    horarioAdministracion: inst.horarioAdministracion,
    fotos,
    novedades,
    sedes: sedes.map(aSedePublica),
    busquedas: abiertas.map(({ sedeId, ...b }) => ({ ...b, sede: sedes.length > 1 && sedeId ? (nombreDeSede.get(sedeId) ?? null) : null })),
  };
});
