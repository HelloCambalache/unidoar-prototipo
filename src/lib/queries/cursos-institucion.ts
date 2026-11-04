import "server-only";
import { and, asc, count, desc, eq, getTableColumns } from "drizzle-orm";
import { getDb } from "@/db";
import { cursos, docentes, inscripcionesCurso, inscripcionesCursoInstitucion, instituciones, type Curso } from "@/db/schema";
import { CATEGORIA_INFO } from "@/lib/catalogo";
import { fechaCorta } from "@/lib/fechas";
import { hoyArgentina } from "@/lib/fechas-curso";
import type { Ejecutor } from "@/lib/queries/pipeline";
import { iniciales } from "@/lib/utils";

/*
 * Lado institución de los cursos. Las filas son las mismas que lee el docente (src/lib/queries/cursos.ts):
 * acá solo se administran. Toda lectura o escritura de un curso arranca por `cursoPropio` o
 * `inscripcionPropia`: un id que viene del cliente no se usa nunca sin pasar por esos chequeos.
 */

export type CursoDeInstitucion = Curso & {
  inscriptos: number;
  /** Cuántos de los inscriptos ya fueron marcados como que terminaron. */
  terminaron: number;
  /** La fecha de finalización ya pasó. */
  finalizado: boolean;
};

/** Cursos de la institución, del más nuevo al más viejo, con cuántos se anotaron (profesionales e instituciones). */
export async function listarCursosDeInstitucion(institucionId: string): Promise<CursoDeInstitucion[]> {
  const hoy = hoyArgentina();
  const [filas, deInstituciones] = await Promise.all([
    getDb()
      .select({
        curso: getTableColumns(cursos),
        inscriptos: count(inscripcionesCurso.docenteId),
        terminaron: count(inscripcionesCurso.terminoEn),
      })
      .from(cursos)
      .leftJoin(inscripcionesCurso, eq(inscripcionesCurso.cursoId, cursos.id))
      .where(eq(cursos.institucionId, institucionId))
      .groupBy(cursos.id)
      .orderBy(desc(cursos.creadoEn)),
    getDb()
      .select({ cursoId: inscripcionesCursoInstitucion.cursoId, n: count() })
      .from(inscripcionesCursoInstitucion)
      .innerJoin(cursos, eq(cursos.id, inscripcionesCursoInstitucion.cursoId))
      .where(eq(cursos.institucionId, institucionId))
      .groupBy(inscripcionesCursoInstitucion.cursoId),
  ]);
  const institucionesPorCurso = new Map(deInstituciones.map((i) => [i.cursoId, i.n]));
  return filas.map((f) => ({
    ...f.curso,
    inscriptos: f.inscriptos + (institucionesPorCurso.get(f.curso.id) ?? 0),
    terminaron: f.terminaron,
    finalizado: !!f.curso.fechaFinal && f.curso.fechaFinal < hoy,
  }));
}

/** El curso, solo si es de la institución. Es la verificación de propiedad de todas las acciones. */
export async function cursoPropio(institucionId: string, cursoId: string, ejecutor: Ejecutor = getDb()) {
  const [fila] = await ejecutor
    .select()
    .from(cursos)
    .where(and(eq(cursos.id, cursoId), eq(cursos.institucionId, institucionId)))
    .limit(1);
  return fila ?? null;
}

/** La inscripción de un docente a un curso de la institución, con el curso y el docente. */
export async function inscripcionPropia(
  institucionId: string,
  cursoId: string,
  docenteId: string,
  ejecutor: Ejecutor = getDb(),
) {
  const [fila] = await ejecutor
    .select({
      curso: cursos,
      inscripcion: inscripcionesCurso,
      docente: { id: docentes.id, nombre: docentes.nombre, apellido: docentes.apellido, usuarioId: docentes.usuarioId },
    })
    .from(inscripcionesCurso)
    .innerJoin(cursos, eq(cursos.id, inscripcionesCurso.cursoId))
    .innerJoin(docentes, eq(docentes.id, inscripcionesCurso.docenteId))
    .where(
      and(
        eq(inscripcionesCurso.cursoId, cursoId),
        eq(inscripcionesCurso.docenteId, docenteId),
        eq(cursos.institucionId, institucionId),
      ),
    )
    .limit(1);
  return fila ?? null;
}

/** Quiénes están anotados en un curso (ya verificado como propio): su cuenta, si terminó y si ya tiene certificado. */
export async function inscriptosDelCurso(cursoId: string, ejecutor: Ejecutor = getDb()) {
  return ejecutor
    .select({
      docenteUsuarioId: docentes.usuarioId,
      terminoEn: inscripcionesCurso.terminoEn,
      certificadoEnviado: inscripcionesCurso.certificadoEnviado,
    })
    .from(inscripcionesCurso)
    .innerJoin(docentes, eq(docentes.id, inscripcionesCurso.docenteId))
    .where(eq(inscripcionesCurso.cursoId, cursoId));
}

/** Las instituciones anotadas en un curso (ya verificado como propio): su id, para avisarles a quienes la administran. */
export async function institucionesInscriptasEnCurso(cursoId: string, ejecutor: Ejecutor = getDb()) {
  return ejecutor
    .select({ institucionId: inscripcionesCursoInstitucion.institucionId })
    .from(inscripcionesCursoInstitucion)
    .where(eq(inscripcionesCursoInstitucion.cursoId, cursoId));
}

export type InscriptoCurso = {
  docenteId: string;
  nombre: string;
  iniciales: string;
  fotoUrl: string | null;
  /** "Docente", "Entrenador/a", "Guardavidas". */
  categoria: string;
  /** Un perfil sin alta terminada o rechazado no se puede abrir desde /institucion/docente/<id>. */
  perfilVisible: boolean;
  /** "AAAA-MM-DD" cuando la institución marcó que terminó. */
  terminoEn: string | null;
  certificadoEnviado: boolean;
  /** "21/09/2026" */
  inscriptoEl: string;
};

/** Una institución anotada en un curso propio (para su staff o para la institución). */
export type InstitucionInscripta = {
  institucionId: string;
  nombre: string;
  /** Para abrir su perfil público. */
  slug: string;
  logoUrl: string | null;
  /** "21/09/2026" */
  inscriptaEl: string;
};

export type CursoConInscriptos = { curso: Curso; inscriptos: InscriptoCurso[]; instituciones: InstitucionInscripta[] };

/** El curso propio con todos sus inscriptos (profesionales e instituciones), por orden alfabético. Null si no existe o es de otra institución. */
export async function cursoConInscriptos(institucionId: string, cursoId: string): Promise<CursoConInscriptos | null> {
  const curso = await cursoPropio(institucionId, cursoId);
  if (!curso) return null;

  const [filasInstituciones, filas] = await Promise.all([
    getDb()
      .select({
        institucionId: instituciones.id,
        nombre: instituciones.nombre,
        slug: instituciones.slug,
        logoUrl: instituciones.logoUrl,
        creadoEn: inscripcionesCursoInstitucion.creadoEn,
      })
      .from(inscripcionesCursoInstitucion)
      .innerJoin(instituciones, eq(instituciones.id, inscripcionesCursoInstitucion.institucionId))
      .where(eq(inscripcionesCursoInstitucion.cursoId, curso.id))
      .orderBy(asc(instituciones.nombre)),
    inscriptosConDocente(curso.id),
  ]);

  return {
    curso,
    instituciones: filasInstituciones.map((f) => ({
      institucionId: f.institucionId,
      nombre: f.nombre,
      slug: f.slug,
      logoUrl: f.logoUrl,
      inscriptaEl: fechaCorta(f.creadoEn),
    })),
    inscriptos: filas.map((f) => {
      const nombre = `${f.nombre} ${f.apellido}`.trim();
      return {
        docenteId: f.docenteId,
        nombre,
        iniciales: iniciales(nombre),
        fotoUrl: f.fotoUrl,
        categoria: CATEGORIA_INFO[f.categoria].label,
        perfilVisible: f.onboardingCompleto && f.verificacion !== "rechazado",
        terminoEn: f.terminoEn,
        certificadoEnviado: f.certificadoEnviado,
        inscriptoEl: fechaCorta(f.creadoEn),
      };
    }),
  };
}

/** Los profesionales anotados en un curso, con lo que muestra la ficha, por orden alfabético. */
function inscriptosConDocente(cursoId: string) {
  return getDb()
    .select({
      docenteId: docentes.id,
      nombre: docentes.nombre,
      apellido: docentes.apellido,
      categoria: docentes.categoria,
      fotoUrl: docentes.fotoUrl,
      onboardingCompleto: docentes.onboardingCompleto,
      verificacion: docentes.verificacion,
      terminoEn: inscripcionesCurso.terminoEn,
      certificadoEnviado: inscripcionesCurso.certificadoEnviado,
      creadoEn: inscripcionesCurso.creadoEn,
    })
    .from(inscripcionesCurso)
    .innerJoin(docentes, eq(docentes.id, inscripcionesCurso.docenteId))
    .where(eq(inscripcionesCurso.cursoId, cursoId))
    .orderBy(asc(docentes.apellido), asc(docentes.nombre));
}
