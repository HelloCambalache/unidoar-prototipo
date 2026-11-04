"use server";

import { revalidatePath } from "next/cache";
import { quitados } from "@/lib/archivos";
import { borrarArchivos } from "@/lib/queries/archivos";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { getDb, transaccion } from "@/db";
import { cursos, inscripcionesCurso, inscripcionesCursoInstitucion, instituciones } from "@/db/schema";
import { fallo, ok, parsear, type Resultado } from "@/lib/acciones";
import { requerirInstitucion } from "@/lib/auth";
import { esUuid } from "@/lib/busquedas";
import {
  cursoSchema,
  etiquetaInscriptos,
  PUNTAJE_POR_DEFECTO,
  valoresDeCurso,
  type EstadoFormularioCurso,
} from "@/lib/cursos";
import { hoyArgentina } from "@/lib/fechas-curso";
import { avisar, avisarAVarios } from "@/lib/queries/avisos";
import { cursoPropio, inscripcionPropia, inscriptosDelCurso, institucionesInscriptasEnCurso } from "@/lib/queries/cursos-institucion";
import { usuariosDeInstitucion } from "@/lib/queries/instituciones";
import { planes } from "@/lib/queries/planes";
import { institucionVisible } from "@/lib/visibilidad";
import { ubicarPorDireccion } from "@/lib/queries/ubicacion";
import { esUrlPublicaPropia } from "@/lib/subidas";
import { claveDeDireccion } from "@/lib/ubicacion";
import { CODIGO_PLAN_INACTIVO } from "@/lib/plan-activo";
import { motivoDeLimiteDePlan } from "@/lib/queries/plan-activo";

const NO_ENCONTRADO = "No encontramos ese curso.";
const SIN_CURSOS = "Tu plan de búsqueda puntual no incluye la difusión de cursos.";
const NO_INSCRIPTO = "No encontramos esa inscripción.";

/** Pantallas de las dos puntas que muestran cursos o sus conteos. */
function revalidarCursos() {
  revalidatePath("/institucion/cursos", "layout");
  revalidatePath("/docente/cursos");
  revalidatePath("/docente/dashboard");
  revalidatePath("/docente/perfil");
}

/** La foto es la que ya tenía el curso o un archivo que subió esta misma cuenta, y tiene que ser una imagen. */
function fotoAceptable(url: string, actual: string | null, usuarioId: string) {
  if (url === actual) return true;
  return esUrlPublicaPropia(url, usuarioId) && /\.(jpe?g|png|webp)$/i.test(url);
}

const FOTO_INVALIDA = fallo("No pudimos validar la foto. Subila de nuevo.", { fotoUrl: "Archivo inválido" });

const SIN_UBICACION = { lat: null, lng: null, partido: null, provincia: null };

/**
 * Dónde queda el curso. Solo los presenciales con dirección tienen ubicación. Al editar, si la dirección no cambió y ya
 * estaba ubicada se conserva; si cambió (o no se la había podido ubicar) se busca de nuevo. Si no se encuentra, queda sin
 * ubicación: el curso se guarda igual y simplemente no muestra distancia.
 */
async function ubicacionDeCurso(
  d: { modalidad: string; direccion?: string; ubicacion?: string },
  actual: { direccion: string | null; lat: number | null; lng: number | null; partido: string | null; provincia: string | null } | null,
) {
  if (d.modalidad !== "Presencial" || !d.direccion) return SIN_UBICACION;
  const mismaDireccion = actual && claveDeDireccion(actual.direccion ?? "") === claveDeDireccion(d.direccion);
  if (mismaDireccion && actual.lat != null && actual.lng != null) {
    return { lat: actual.lat, lng: actual.lng, partido: actual.partido, provincia: actual.provincia };
  }
  const u = await ubicarPorDireccion({ direccion: d.direccion, token: d.ubicacion, osm: true });
  return u ? { lat: u.lat, lng: u.lng, partido: u.partido, provincia: u.provincia } : SIN_UBICACION;
}

/* ───────────────────────────── Crear, editar y borrar ───────────────────────────── */

/** Crea un curso de la institución de la sesión y lleva a su ficha. */
export async function crearCurso(_estado: EstadoFormularioCurso, formData: FormData): Promise<EstadoFormularioCurso> {
  const { usuario, institucion } = await requerirInstitucion();
  if (!(await planes()).incluye(institucion.plan, "cursos")) return fallo(SIN_CURSOS);
  // Sin el plan activo (nueva sin su primer pago, o con una factura vencida hace más de 15 días) no se publican cursos nuevos (ver src/lib/plan-activo.ts).
  const sinPlan = await motivoDeLimiteDePlan(institucion);
  if (sinPlan) return fallo(sinPlan, undefined, CODIGO_PLAN_INACTIVO);
  const datos = parsear(cursoSchema, formData);
  if (!datos.ok) return fallo(datos.error, datos.campos);
  if (datos.data.fotoUrl && !fotoAceptable(datos.data.fotoUrl, null, usuario.id)) return FOTO_INVALIDA;

  const [creado] = await getDb()
    .insert(cursos)
    .values({ institucionId: institucion.id, ...valoresDeCurso(datos.data), ...(await ubicacionDeCurso(datos.data, null)) })
    .returning({ id: cursos.id });

  revalidarCursos();
  redirect(`/institucion/cursos/${creado!.id}?aviso=creado`);
}

/** Guarda los cambios de un curso propio. Quienes ya están anotados lo ven actualizado la próxima vez que entran. */
export async function editarCurso(
  cursoId: string,
  _estado: EstadoFormularioCurso,
  formData: FormData,
): Promise<EstadoFormularioCurso> {
  const { usuario, institucion } = await requerirInstitucion();
  if (!(await planes()).incluye(institucion.plan, "cursos")) return fallo(SIN_CURSOS);
  if (!esUuid(cursoId)) return fallo(NO_ENCONTRADO);
  const datos = parsear(cursoSchema, formData);
  if (!datos.ok) return fallo(datos.error, datos.campos);

  const actual = await cursoPropio(institucion.id, cursoId);
  if (!actual) return fallo(NO_ENCONTRADO);
  if (datos.data.fotoUrl && !fotoAceptable(datos.data.fotoUrl, actual.fotoUrl, usuario.id)) return FOTO_INVALIDA;

  await getDb()
    .update(cursos)
    .set({ ...valoresDeCurso(datos.data), ...(await ubicacionDeCurso(datos.data, actual)) })
    .where(and(eq(cursos.id, actual.id), eq(cursos.institucionId, institucion.id)));
  await borrarArchivos(quitados([actual.fotoUrl], [datos.data.fotoUrl]));

  revalidarCursos();
  redirect(`/institucion/cursos/${actual.id}?aviso=editado`);
}

/**
 * Borra un curso propio. Con inscriptos hace falta `confirmado` y a cada docente anotado le llega una
 * notificación. Si alguien ya lo terminó o recibió su certificado no se borra: el curso es parte de su
 * formación y desaparecería de su perfil (con los puntos que sumó).
 */
export async function borrarCurso(cursoId: string, confirmado = false): Promise<Resultado> {
  const { institucion } = await requerirInstitucion();
  if (!esUuid(cursoId)) return fallo(NO_ENCONTRADO);
  let fotoDelCurso: string | null = null;

  const resultado = await transaccion(async (tx) => {
    const curso = await cursoPropio(institucion.id, cursoId, tx);
    if (!curso) return fallo(NO_ENCONTRADO);

    const inscriptos = await inscriptosDelCurso(curso.id, tx);
    if (inscriptos.some((i) => i.terminoEn || i.certificadoEnviado)) {
      return fallo(
        "No se puede borrar: hay profesionales que ya lo terminaron o recibieron su certificado, y quedaría sin registro en su perfil.",
      );
    }
    if (inscriptos.length > 0 && !confirmado) {
      return fallo(`Este curso tiene ${etiquetaInscriptos(inscriptos.length).toLowerCase()}. Confirmá para borrarlo y avisarles.`);
    }

    await avisarAVarios(
      tx,
      inscriptos.flatMap((i) => (i.docenteUsuarioId ? [i.docenteUsuarioId] : [])),
      {
        tipo: "curso",
        titulo: institucion.nombre,
        texto: `canceló el curso «${curso.titulo}», al que estabas inscripto/a.`,
        enlace: "/docente/cursos",
      },
    );
    // Las instituciones que anotaron a su staff también se enteran (a quienes administran cada una).
    const anotadas = await institucionesInscriptasEnCurso(curso.id, tx);
    const usuariosDeAnotadas = [...new Set((await Promise.all(anotadas.map((a) => usuariosDeInstitucion(a.institucionId)))).flat())];
    await avisarAVarios(tx, usuariosDeAnotadas, {
      tipo: "curso",
      titulo: institucion.nombre,
      texto: `canceló el curso «${curso.titulo}», al que tu institución estaba inscripta.`,
      enlace: "/institucion/cursos/explorar",
    });
    fotoDelCurso = curso.fotoUrl;
    await tx.delete(cursos).where(and(eq(cursos.id, curso.id), eq(cursos.institucionId, institucion.id)));
    return ok();
  });

  if (resultado.ok) {
    await borrarArchivos([fotoDelCurso]);
    revalidarCursos();
  }
  return resultado;
}

/* ───────────────────────────── Anotar a la institución en un curso de otra ───────────────────────────── */

const SIN_EXPLORAR = "Tu plan de búsqueda puntual no incluye los cursos.";

/**
 * La institución de la sesión se anota en un curso de OTRA institución (para su staff o para la institución). Es la misma regla que cuando se
 * anota un profesional (el curso tiene que verse, no haber terminado y ser de una institución con difusión de cursos), más que no sea propio.
 * Le llega un aviso a quienes administran la institución que lo ofrece.
 */
export async function inscribirInstitucionAlCurso(cursoId: string): Promise<Resultado> {
  const { institucion } = await requerirInstitucion();
  if (!(await planes()).incluye(institucion.plan, "cursos")) return fallo(SIN_EXPLORAR);
  if (!esUuid(cursoId)) return fallo("Curso inválido.");

  const db = getDb();
  const [curso] = await db
    .select({ id: cursos.id, titulo: cursos.titulo, fechaFinal: cursos.fechaFinal, institucionId: cursos.institucionId, plan: instituciones.plan })
    .from(cursos)
    .innerJoin(instituciones, eq(instituciones.id, cursos.institucionId))
    .where(and(eq(cursos.id, cursoId), institucionVisible))
    .limit(1);
  if (!curso) return fallo("Ese curso ya no existe.");
  if (curso.institucionId === institucion.id) return fallo("Es un curso de tu institución: lo administrás desde Mis cursos.");
  // Los cursos de una institución cuyo plan no incluye la difusión de cursos no se ven en el listado: tampoco se puede anotar quien llegue por el enlace.
  if (!(await planes()).incluye(curso.plan, "cursos")) return fallo("Ese curso ya no existe.");
  if (curso.fechaFinal && curso.fechaFinal < hoyArgentina()) return fallo("Este curso ya terminó y no admite inscripciones.");

  const [nueva] = await db
    .insert(inscripcionesCursoInstitucion)
    .values({ cursoId: curso.id, institucionId: institucion.id })
    .onConflictDoNothing()
    .returning({ cursoId: inscripcionesCursoInstitucion.cursoId });
  if (nueva) {
    await avisarAVarios(db, await usuariosDeInstitucion(curso.institucionId), {
      tipo: "curso",
      titulo: institucion.nombre,
      texto: `inscribió a su institución en «${curso.titulo}».`,
      enlace: `/institucion/cursos/${curso.id}/inscriptos`,
    });
  }

  revalidarCursos();
  return ok();
}

/** La institución de la sesión cancela su inscripción en un curso de otra (solo lo propio). */
export async function cancelarInscripcionDeInstitucion(cursoId: string): Promise<Resultado> {
  const { institucion } = await requerirInstitucion();
  if (!esUuid(cursoId)) return fallo("Curso inválido.");

  const db = getDb();
  const [cancelada] = await db
    .delete(inscripcionesCursoInstitucion)
    .where(and(eq(inscripcionesCursoInstitucion.cursoId, cursoId), eq(inscripcionesCursoInstitucion.institucionId, institucion.id)))
    .returning({ cursoId: inscripcionesCursoInstitucion.cursoId });
  if (!cancelada) return fallo("No estabas inscripta en ese curso.");

  const [curso] = await db.select({ titulo: cursos.titulo, institucionId: cursos.institucionId }).from(cursos).where(eq(cursos.id, cursoId)).limit(1);
  if (curso) {
    await avisarAVarios(db, await usuariosDeInstitucion(curso.institucionId), {
      tipo: "curso",
      titulo: institucion.nombre,
      texto: `canceló la inscripción de su institución en «${curso.titulo}».`,
      enlace: `/institucion/cursos/${cursoId}/inscriptos`,
    });
  }

  revalidarCursos();
  return ok();
}

/* ───────────────────────────── Inscriptos ───────────────────────────── */

/**
 * Marca (o desmarca) que un docente terminó el curso: queda como "Curso completado" en su formación.
 * Se registra con la fecha de hoy. No se puede marcar un curso que todavía no empezó ni desmarcar a
 * quien ya recibió el certificado.
 */
export async function marcarTermino(cursoId: string, docenteId: string, termino: boolean): Promise<Resultado> {
  const { institucion } = await requerirInstitucion();
  if (!esUuid(cursoId) || !esUuid(docenteId)) return fallo(NO_INSCRIPTO);

  const resultado = await transaccion(async (tx) => {
    const fila = await inscripcionPropia(institucion.id, cursoId, docenteId, tx);
    if (!fila) return fallo(NO_INSCRIPTO);
    const { curso, inscripcion } = fila;
    const hoy = hoyArgentina();

    if (termino) {
      if (inscripcion.terminoEn) return ok();
      if (curso.fechaInicio && curso.fechaInicio > hoy) return fallo("El curso todavía no empezó.");
    } else {
      if (!inscripcion.terminoEn) return ok();
      if (inscripcion.certificadoEnviado) return fallo("Ya le enviaste el certificado: no se puede deshacer.");
    }

    await tx
      .update(inscripcionesCurso)
      .set({ terminoEn: termino ? hoy : null })
      .where(and(eq(inscripcionesCurso.cursoId, curso.id), eq(inscripcionesCurso.docenteId, docenteId)));
    return ok();
  });

  if (resultado.ok) revalidarCursos();
  return resultado;
}

/** Envía el certificado a quien terminó el curso: queda registrado y el docente recibe una notificación. */
export async function enviarCertificado(cursoId: string, docenteId: string): Promise<Resultado> {
  const { institucion } = await requerirInstitucion();
  if (!esUuid(cursoId) || !esUuid(docenteId)) return fallo(NO_INSCRIPTO);

  const resultado = await transaccion(async (tx) => {
    const fila = await inscripcionPropia(institucion.id, cursoId, docenteId, tx);
    if (!fila) return fallo(NO_INSCRIPTO);
    const { curso, inscripcion, docente } = fila;

    if (inscripcion.certificadoEnviado) return ok();
    if (!curso.certifica) return fallo("Este curso no entrega certificado.");
    if (!inscripcion.terminoEn) return fallo("Primero marcá que terminó el curso.");

    await tx
      .update(inscripcionesCurso)
      .set({ certificadoEnviado: true })
      .where(and(eq(inscripcionesCurso.cursoId, curso.id), eq(inscripcionesCurso.docenteId, docente.id)));

    const puntos = curso.puntaje ?? PUNTAJE_POR_DEFECTO;
    await avisar(tx, docente.usuarioId, {
      tipo: "curso",
      titulo: institucion.nombre,
      texto: `te envió el certificado de «${curso.titulo}». Ya suma +${puntos} puntos a tu perfil.`,
      enlace: "/docente/cursos?vista=historial",
    });
    return ok();
  });

  if (resultado.ok) revalidarCursos();
  return resultado;
}
