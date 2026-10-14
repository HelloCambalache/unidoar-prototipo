import "server-only";
import { and, asc, count, desc, eq, getTableColumns } from "drizzle-orm";
import { getDb } from "@/db";
import { cursos, docentes, inscripcionesCurso, instituciones } from "@/db/schema";
import { normalizar } from "@/lib/coincidencia";
import { avancePorFechas, hoyArgentina } from "@/lib/fechas-curso";
import { distanciaKm } from "@/lib/geo";
import { institucionVisible } from "@/lib/visibilidad";

export type CursoBase = {
  id: string;
  titulo: string;
  subtitulo: string | null;
  descripcion: string | null;
  modalidad: string;
  profesor: string | null;
  fechaInicio: string | null;
  fechaFinal: string | null;
  horario: string | null;
  direccion: string | null;
  link: string | null;
  certifica: boolean;
  puntaje: number | null;
  fotoUrl: string | null;
  institucion: { id: string; nombre: string; slug: string; logoUrl: string | null };
};

export type CursoVista = CursoBase & {
  /** Cuántos docentes están anotados (todos, no solo el que mira). */
  inscriptos: number;
  /** El docente que mira está anotado. */
  inscripto: boolean;
  /** Kilómetros desde las zonas del docente hasta el curso presencial; null si falta alguno de los dos puntos. */
  distanciaKm: number | null;
  terminoEn: string | null;
  certificadoEnviado: boolean;
};

export type EstadoCursado = "por-empezar" | "en-curso" | "finalizado" | "completado";

export type CursoHistorial = CursoBase & {
  terminoEn: string | null;
  certificadoEnviado: boolean;
  estado: EstadoCursado;
  /** 0 a 100, estimado por fechas; el 100 "real" lo confirma la institución con `terminoEn`. */
  avance: number;
};

export type FiltrosCursos = { q: string; modalidad: string; soloInscripto: boolean };

const columnasCurso = getTableColumns(cursos);

function base(f: typeof cursos.$inferSelect, inst: CursoBase["institucion"]): CursoBase {
  return {
    id: f.id,
    titulo: f.titulo,
    subtitulo: f.subtitulo,
    descripcion: f.descripcion,
    modalidad: f.modalidad,
    profesor: f.profesor,
    fechaInicio: f.fechaInicio,
    fechaFinal: f.fechaFinal,
    horario: f.horario,
    direccion: f.direccion,
    link: f.link,
    certifica: f.certifica,
    puntaje: f.puntaje,
    fotoUrl: f.fotoUrl,
    institucion: inst,
  };
}

/** Todos los cursos con cuántos anotados tienen y si el docente está anotado. */
async function consultar(docenteId: string, soloId?: string): Promise<CursoVista[]> {
  const db = getDb();
  const [filas, mias, [origen]] = await Promise.all([
    db
      .select({
        curso: columnasCurso,
        instId: instituciones.id,
        instNombre: instituciones.nombre,
        instSlug: instituciones.slug,
        instLogo: instituciones.logoUrl,
        inscriptos: count(inscripcionesCurso.docenteId),
      })
      .from(cursos)
      .innerJoin(instituciones, eq(instituciones.id, cursos.institucionId))
      .leftJoin(inscripcionesCurso, eq(inscripcionesCurso.cursoId, cursos.id))
      // Los cursos de una institución suspendida no se ven ni admiten inscripciones.
      .where(soloId ? and(eq(cursos.id, soloId), institucionVisible) : institucionVisible)
      .groupBy(cursos.id, instituciones.id)
      .orderBy(asc(cursos.fechaInicio), asc(cursos.titulo)),
    db
      .select({
        cursoId: inscripcionesCurso.cursoId,
        terminoEn: inscripcionesCurso.terminoEn,
        certificadoEnviado: inscripcionesCurso.certificadoEnviado,
      })
      .from(inscripcionesCurso)
      .where(eq(inscripcionesCurso.docenteId, docenteId)),
    db.select({ lat: docentes.lat, lng: docentes.lng }).from(docentes).where(eq(docentes.id, docenteId)).limit(1),
  ]);
  const porCurso = new Map(mias.map((m) => [m.cursoId, m]));
  return filas.map((f) => {
    const mia = porCurso.get(f.curso.id);
    return {
      ...base(f.curso, { id: f.instId, nombre: f.instNombre, slug: f.instSlug, logoUrl: f.instLogo }),
      inscriptos: f.inscriptos,
      inscripto: !!mia,
      distanciaKm:
        origen?.lat != null && origen.lng != null && f.curso.modalidad === "Presencial" && f.curso.lat != null && f.curso.lng != null
          ? distanciaKm({ lat: origen.lat, lng: origen.lng }, { lat: f.curso.lat, lng: f.curso.lng })
          : null,
      terminoEn: mia?.terminoEn ?? null,
      certificadoEnviado: mia?.certificadoEnviado ?? false,
    };
  });
}

/**
 * Cursos que ve el docente: los que no terminaron todavía y aquellos en los que está anotado
 * (aunque hayan terminado). Los filtros se aplican después con `filtrarCursos`.
 */
export async function cursosParaDocente(docenteId: string) {
  const hoy = hoyArgentina();
  return (await consultar(docenteId)).filter((c) => c.inscripto || !c.fechaFinal || c.fechaFinal >= hoy);
}

/** Filtros en memoria, así "Matematica" encuentra "Matemática". */
export function filtrarCursos(lista: CursoVista[], filtros: FiltrosCursos) {
  const q = normalizar(filtros.q);
  return lista
    .filter((c) => !filtros.modalidad || c.modalidad === filtros.modalidad)
    .filter((c) => !filtros.soloInscripto || c.inscripto)
    .filter((c) => !q || normalizar(`${c.titulo} ${c.subtitulo ?? ""} ${c.institucion.nombre}`).includes(q));
}

export async function cursoPorId(docenteId: string, cursoId: string) {
  return (await consultar(docenteId, cursoId))[0] ?? null;
}

export function estadoCursado(
  c: { terminoEn: string | null; fechaInicio: string | null; fechaFinal: string | null },
  hoy = hoyArgentina(),
): EstadoCursado {
  if (c.terminoEn) return "completado";
  if (c.fechaFinal && c.fechaFinal < hoy) return "finalizado";
  if (c.fechaInicio && c.fechaInicio > hoy) return "por-empezar";
  return "en-curso";
}

/** Cursos en los que se anotó el docente, del más reciente al más viejo. */
export async function historialCursos(docenteId: string): Promise<CursoHistorial[]> {
  const hoy = hoyArgentina();
  const filas = await getDb()
    .select({
      curso: columnasCurso,
      instId: instituciones.id,
      instNombre: instituciones.nombre,
      instSlug: instituciones.slug,
      instLogo: instituciones.logoUrl,
      terminoEn: inscripcionesCurso.terminoEn,
      certificadoEnviado: inscripcionesCurso.certificadoEnviado,
    })
    .from(inscripcionesCurso)
    .innerJoin(cursos, eq(cursos.id, inscripcionesCurso.cursoId))
    .innerJoin(instituciones, eq(instituciones.id, cursos.institucionId))
    .where(eq(inscripcionesCurso.docenteId, docenteId))
    .orderBy(desc(inscripcionesCurso.creadoEn));
  return filas.map((f) => {
    const estado = estadoCursado({ terminoEn: f.terminoEn, fechaInicio: f.curso.fechaInicio, fechaFinal: f.curso.fechaFinal }, hoy);
    return {
      ...base(f.curso, { id: f.instId, nombre: f.instNombre, slug: f.instSlug, logoUrl: f.instLogo }),
      terminoEn: f.terminoEn,
      certificadoEnviado: f.certificadoEnviado,
      estado,
      avance: estado === "completado" ? 100 : avancePorFechas(f.curso.fechaInicio, f.curso.fechaFinal, hoy),
    };
  });
}

/** Números de "Tu formación": se arman con el historial, no se guardan aparte. */
export function resumenFormacion(historial: CursoHistorial[]) {
  const completados = historial.filter((c) => c.estado === "completado");
  return {
    completados: completados.length,
    certificados: historial.filter((c) => c.certificadoEnviado).length,
    puntaje: completados.filter((c) => c.certifica).reduce((n, c) => n + (c.puntaje ?? 0), 0),
    anotadoAhora: historial.filter((c) => c.estado === "por-empezar" || c.estado === "en-curso").length,
  };
}
