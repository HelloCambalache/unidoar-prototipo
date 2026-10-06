import "server-only";
import { cache } from "react";
import { and, asc, count, countDistinct, desc, eq, gt, isNull, or, sql, type SQL } from "drizzle-orm";
import { getDb } from "@/db";
import { asignaturas, busquedas, docentes, instituciones, testimonios, type CategoriaDocente } from "@/db/schema";
import { CATEGORIAS } from "@/lib/catalogo";
import { CUPOS_FUNDADOR, nombrePublico } from "@/lib/publico";
import { fotosDeInstitucion, novedadesDeInstitucion } from "@/lib/queries/vitrina";
import type { VitrinaFotoVista, VitrinaNovedadVista } from "@/lib/vitrina";
import { contiene } from "@/lib/sql-texto";
import { busquedaDeInstitucionActiva, docenteVisible, institucionVisible } from "@/lib/visibilidad";

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
      .where(and(eq(busquedas.estado, "activa"), busquedaDeInstitucionActiva))
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

/** Cupos del plan Fundador que quedan (instituciones reales con ese plan, sin contar las de ejemplo). */
export const cuposFundadorRestantes = cache(async (): Promise<number> => {
  const [{ n }] = await getDb()
    .select({ n: count() })
    .from(instituciones)
    .where(and(eq(instituciones.plan, "fundador"), eq(instituciones.esDemo, false)));
  return Math.max(0, CUPOS_FUNDADOR - n);
});

/* ───────── Logos y testimonios ───────── */

export type LogoInstitucion = { id: string; slug: string; nombre: string; logoUrl: string };

/** Instituciones verificadas con logo, para la tira "Confían en UNIDOAR". */
export async function logosInstituciones(limite = 24): Promise<LogoInstitucion[]> {
  const filas = await getDb()
    .select({ id: instituciones.id, slug: instituciones.slug, nombre: instituciones.nombre, logoUrl: instituciones.logoUrl })
    .from(instituciones)
    .where(and(eq(instituciones.verificada, true), institucionVisible))
    .orderBy(asc(instituciones.nombre))
    .limit(limite * 2);
  return filas.flatMap((f) => (f.logoUrl ? [{ ...f, logoUrl: f.logoUrl }] : [])).slice(0, limite);
}

export type TestimonioPublico = { id: string; cita: string; autor: string; cargo: string; fotoUrl: string | null };

/** Testimonios de una página: "home", "educadores", "entrenadores" o "guardavidas". */
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
    .where(eq(testimonios.pagina, pagina))
    .orderBy(asc(testimonios.orden), asc(testimonios.autor));
}

/* ───────── Perfiles destacados (landings de categoría) ───────── */

export type PerfilDestacado = {
  id: string;
  /** "Martina A.": en público no se muestra el apellido completo. */
  nombre: string;
  detalle: string;
  fotoUrl: string | null;
};

export async function perfilesDestacados(categoria: CategoriaDocente, limite = 2): Promise<PerfilDestacado[]> {
  const filas = await getDb()
    .select({
      id: docentes.id,
      nombre: docentes.nombre,
      apellido: docentes.apellido,
      subtitulo: docentes.subtitulo,
      asignaturas: docentes.asignaturas,
      fotoUrl: docentes.fotoUrl,
    })
    .from(docentes)
    .where(
      and(
        eq(docentes.categoria, categoria),
        eq(docentes.verificacion, "verificado"),
        eq(docentes.onboardingCompleto, true),
        docenteVisible,
      ),
    )
    .orderBy(desc(sql`coalesce(${docentes.aniosExperiencia}, 0)`), asc(docentes.nombre))
    .limit(limite);
  return filas.map((f) => ({
    id: f.id,
    nombre: nombrePublico(f.nombre, f.apellido),
    detalle: f.subtitulo || f.asignaturas.slice(0, 2).join(" · "),
    fotoUrl: f.fotoUrl,
  }));
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


export const BUSQUEDAS_POR_PAGINA = 24;

/** Listado público de búsquedas activas, con texto libre, categoría y paginado. */
export async function listarBusquedasPublicas(filtros: { q?: string; categoria?: CategoriaDocente; pagina?: number }) {
  const db = getDb();
  const pagina = Math.max(1, filtros.pagina ?? 1);
  const condiciones: (SQL | undefined)[] = [eq(busquedas.estado, "activa"), busquedaDeInstitucionActiva];
  if (filtros.categoria) condiciones.push(eq(busquedas.categoria, filtros.categoria));
  if (filtros.q) {
    condiciones.push(
      or(
        contiene(busquedas.puesto, filtros.q),
        contiene(busquedas.disciplina, filtros.q),
        contiene(busquedas.zona, filtros.q),
        contiene(instituciones.nombre, filtros.q),
      ),
    );
  }
  const donde = and(...condiciones);

  const [filas, [{ total }]] = await Promise.all([
    db
      .select(columnasBusqueda)
      .from(busquedas)
      .innerJoin(instituciones, eq(instituciones.id, busquedas.institucionId))
      .where(donde)
      .orderBy(desc(busquedas.rapida), desc(busquedas.creadoEn), asc(busquedas.puesto))
      .limit(BUSQUEDAS_POR_PAGINA)
      .offset((pagina - 1) * BUSQUEDAS_POR_PAGINA),
    db
      .select({ total: count() })
      .from(busquedas)
      .innerJoin(instituciones, eq(instituciones.id, busquedas.institucionId))
      .where(donde),
  ]);
  return {
    filas: filas.map(aBusquedaPublica),
    total,
    pagina,
    paginas: Math.max(1, Math.ceil(total / BUSQUEDAS_POR_PAGINA)),
  };
}

/* ───────── Instituciones ───────── */

export type InstitucionPublica = {
  id: string;
  slug: string;
  nombre: string;
  tipo: string;
  zona: string | null;
  descripcion: string | null;
  logoUrl: string | null;
  verificada: boolean;
  busquedasActivas: number;
};

/**
 * Instituciones visibles en el listado: las verificadas y las que tienen búsquedas abiertas.
 * Las más activas primero.
 */
export async function listarInstitucionesPublicas(): Promise<InstitucionPublica[]> {
  const activas = count(busquedas.id);
  const filas = await getDb()
    .select({
      id: instituciones.id,
      slug: instituciones.slug,
      nombre: instituciones.nombre,
      tipo: instituciones.tipo,
      zona: instituciones.zona,
      descripcion: instituciones.descripcion,
      logoUrl: instituciones.logoUrl,
      verificada: instituciones.verificada,
      busquedasActivas: activas,
    })
    .from(instituciones)
    .leftJoin(busquedas, and(eq(busquedas.institucionId, instituciones.id), eq(busquedas.estado, "activa")))
    .where(institucionVisible)
    .groupBy(instituciones.id)
    .having(or(eq(instituciones.verificada, true), gt(activas, 0)))
    .orderBy(desc(activas), asc(instituciones.nombre));
  return filas;
}

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
  mision: string | null;
  vision: string | null;
  valores: string[];
  horarioAdministracion: string | null;
  fotos: VitrinaFotoVista[];
  novedades: VitrinaNovedadVista[];
  busquedas: { id: string; puesto: string; tipo: string; turno: string | null; rapida: boolean }[];
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
  const [abiertas, fotos, novedades] = await Promise.all([
    db
      .select({
        id: busquedas.id,
        puesto: busquedas.puesto,
        tipo: busquedas.tipo,
        turno: busquedas.turno,
        rapida: busquedas.rapida,
      })
      .from(busquedas)
      .where(and(eq(busquedas.institucionId, inst.id), eq(busquedas.estado, "activa")))
      .orderBy(desc(busquedas.rapida), desc(busquedas.creadoEn)),
    fotosDeInstitucion(inst.id),
    novedadesDeInstitucion(inst.id, 6),
  ]);
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
    mision: inst.mision,
    vision: inst.vision,
    valores: inst.valores,
    horarioAdministracion: inst.horarioAdministracion,
    fotos,
    novedades,
    busquedas: abiertas,
  };
});
