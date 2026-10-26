"use server";

import { revalidatePath } from "next/cache";
import { quitados } from "@/lib/archivos";
import { borrarArchivos } from "@/lib/queries/archivos";
import { encolarParaEquipo } from "@/lib/correo/cola";
import { avisarAAdmins } from "@/lib/queries/avisos";
import { randomBytes } from "node:crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb, transaccion } from "@/db";
import {
  cursos,
  cvEnviados,
  docenteDetalle,
  docentes,
  favoritos,
  inscripcionesCurso,
  instituciones,
  zonas,
} from "@/db/schema";
import { fallo, ok, parsear, type Resultado } from "@/lib/acciones";
import { institucionVisible } from "@/lib/visibilidad";
import { requerirDocente } from "@/lib/auth";
import { normalizar } from "@/lib/coincidencia";
import { decidirEstudios, esEstudiante } from "@/lib/estudiantes";
import { hoyArgentina } from "@/lib/fechas-curso";
import { disponibilidadDesdeGrilla } from "@/lib/onboarding";
import { cambiaElNombre, identidadFija, perfilDocenteSchema } from "@/lib/perfil-docente";
import { notificar } from "@/lib/queries/notificaciones";
import { planes } from "@/lib/queries/planes";
import { usuariosDeInstitucion } from "@/lib/queries/instituciones";
import { esPathPrivadoPropio, esUrlPublicaPropia } from "@/lib/subidas";
import { PERFIL_RECHAZADO, puedePostularse } from "@/lib/perfil-docente";

const idSchema = z.guid();

/** 18 bytes al azar en base64url: 24 caracteres (144 bits) que no se pueden adivinar. */
const nuevoTokenDePerfil = () => randomBytes(18).toString("base64url");

function nombreCompleto(d: { nombre: string; apellido: string }) {
  return `${d.nombre} ${d.apellido}`.trim();
}

/** Avisa a quienes administran una institución (propietario y equipo activo). */
async function avisarAInstitucion(
  institucionId: string,
  aviso: { tipo: string; titulo: string; texto: string; enlace: string },
) {
  const destinatarios = await usuariosDeInstitucion(institucionId);
  await Promise.all(destinatarios.map((id) => notificar(id, aviso)));
}

/* ───────────────────────────── Instituciones ───────────────────────────── */

/** Guarda o quita una institución de las favoritas del docente. */
export async function alternarFavoritoInstitucion(institucionId: string): Promise<Resultado<{ favorita: boolean }>> {
  const { usuario } = await requerirDocente();
  const id = idSchema.safeParse(institucionId);
  if (!id.success) return fallo("Institución inválida.");

  const db = getDb();
  const [institucion] = await db
    .select({ id: instituciones.id, slug: instituciones.slug })
    .from(instituciones)
    .where(eq(instituciones.id, id.data))
    .limit(1);
  if (!institucion) return fallo("Esa institución ya no existe.");

  const [quitada] = await db
    .delete(favoritos)
    .where(and(eq(favoritos.usuarioId, usuario.id), eq(favoritos.tipo, "institucion"), eq(favoritos.refId, institucion.id)))
    .returning({ refId: favoritos.refId });
  if (!quitada) {
    await db
      .insert(favoritos)
      .values({ usuarioId: usuario.id, tipo: "institucion", refId: institucion.id })
      .onConflictDoNothing();
  }

  revalidatePath("/docente/instituciones");
  revalidatePath(`/docente/instituciones/${institucion.slug}`);
  return ok({ favorita: !quitada });
}

/** "Enviá tu CV a esta institución": una vez por institución; le llega un aviso con el link a tu perfil. */
export async function enviarCvAInstitucion(institucionId: string): Promise<Resultado> {
  const { docente } = await requerirDocente();
  if (!puedePostularse(docente.verificacion)) return fallo(PERFIL_RECHAZADO);
  const id = idSchema.safeParse(institucionId);
  if (!id.success) return fallo("Institución inválida.");

  const db = getDb();
  const [institucion] = await db
    .select({ id: instituciones.id, slug: instituciones.slug, nombre: instituciones.nombre })
    .from(instituciones)
    .where(and(eq(instituciones.id, id.data), institucionVisible))
    .limit(1);
  if (!institucion) return fallo("Esa institución ya no existe.");

  const [nuevo] = await db
    .insert(cvEnviados)
    .values({ docenteId: docente.id, institucionId: institucion.id })
    .onConflictDoNothing()
    .returning({ institucionId: cvEnviados.institucionId });
  if (nuevo) {
    await avisarAInstitucion(institucion.id, {
      tipo: "postulacion",
      titulo: nombreCompleto(docente),
      texto: "te envió su CV.",
      enlace: `/institucion/docente/${docente.id}`,
    });
  }

  revalidatePath(`/docente/instituciones/${institucion.slug}`);
  return ok();
}

/* ───────────────────────────── Cursos ───────────────────────────── */

export async function inscribirseCurso(cursoId: string): Promise<Resultado> {
  const { docente } = await requerirDocente();
  const id = idSchema.safeParse(cursoId);
  if (!id.success) return fallo("Curso inválido.");

  const db = getDb();
  const [curso] = await db
    .select({ id: cursos.id, titulo: cursos.titulo, fechaFinal: cursos.fechaFinal, institucionId: cursos.institucionId, plan: instituciones.plan })
    .from(cursos)
    .innerJoin(instituciones, eq(instituciones.id, cursos.institucionId))
    .where(and(eq(cursos.id, id.data), institucionVisible))
    .limit(1);
  if (!curso) return fallo("Ese curso ya no existe.");
  // Los cursos de una institución cuyo plan no incluye la difusión de cursos (una búsqueda puntual) no se ven en el listado: tampoco se puede
  // anotar quien llegue al curso por el enlace o llamando a la acción.
  if (!(await planes()).incluye(curso.plan, "cursos")) return fallo("Ese curso ya no existe.");
  if (curso.fechaFinal && curso.fechaFinal < hoyArgentina()) return fallo("Este curso ya terminó y no admite inscripciones.");

  const [nueva] = await db
    .insert(inscripcionesCurso)
    .values({ cursoId: curso.id, docenteId: docente.id })
    .onConflictDoNothing()
    .returning({ cursoId: inscripcionesCurso.cursoId });
  if (nueva) {
    await avisarAInstitucion(curso.institucionId, {
      tipo: "curso",
      titulo: nombreCompleto(docente),
      texto: `se inscribió a «${curso.titulo}».`,
      enlace: "/institucion/cursos",
    });
  }

  revalidatePath("/docente/cursos");
  revalidatePath("/docente/dashboard");
  revalidatePath("/docente/perfil");
  return ok();
}

export async function cancelarInscripcion(cursoId: string): Promise<Resultado> {
  const { docente } = await requerirDocente();
  const id = idSchema.safeParse(cursoId);
  if (!id.success) return fallo("Curso inválido.");

  const db = getDb();
  // Solo se cancela lo propio y lo que todavía no se terminó: no se borra un curso ya completado.
  const [cancelada] = await db
    .delete(inscripcionesCurso)
    .where(
      and(
        eq(inscripcionesCurso.cursoId, id.data),
        eq(inscripcionesCurso.docenteId, docente.id),
        isNull(inscripcionesCurso.terminoEn),
      ),
    )
    .returning({ cursoId: inscripcionesCurso.cursoId });
  if (!cancelada) return fallo("No pudimos cancelar la inscripción: ya terminaste el curso o no estabas inscripto.");

  const [curso] = await db
    .select({ titulo: cursos.titulo, institucionId: cursos.institucionId })
    .from(cursos)
    .where(eq(cursos.id, id.data))
    .limit(1);
  if (curso) {
    await avisarAInstitucion(curso.institucionId, {
      tipo: "curso",
      titulo: nombreCompleto(docente),
      texto: `canceló su inscripción a «${curso.titulo}».`,
      enlace: "/institucion/cursos",
    });
  }

  revalidatePath("/docente/cursos");
  revalidatePath("/docente/dashboard");
  revalidatePath("/docente/perfil");
  return ok();
}

/* ───────────────────────────── Perfil ───────────────────────────── */

/** Guarda "Mi perfil". Recibe el estado completo del formulario como JSON en el campo `datos`. */
export async function actualizarPerfilDocente(_previo: Resultado | null, formData: FormData): Promise<Resultado> {
  const { usuario, docente } = await requerirDocente();

  let crudo: unknown;
  try {
    crudo = JSON.parse(String(formData.get("datos") ?? ""));
  } catch {
    return fallo("No pudimos leer el formulario. Recargá la página e intentá de nuevo.");
  }
  const r = parsear(perfilDocenteSchema, (crudo ?? {}) as Record<string, unknown>);
  if (!r.ok) return fallo(r.error, r.campos);
  const datos = r.data;

  // Con la identidad verificada el nombre no se cambia desde acá (el formulario ni lo ofrece): se conserva el guardado.
  const nombreFijo = identidadFija(docente);
  if (nombreFijo && cambiaElNombre(docente, datos)) {
    return fallo("Tu identidad ya está verificada: el nombre y el apellido los corrige el equipo. Escribinos desde Contacto.", {
      nombre: "Ya está verificado",
      apellido: "Ya está verificado",
    });
  }

  // Foto y CV: se acepta lo que ya estaba guardado o un archivo que subió esta misma cuenta.
  if (datos.fotoUrl && datos.fotoUrl !== docente.fotoUrl && !esUrlPublicaPropia(datos.fotoUrl, usuario.id)) {
    return fallo("No pudimos validar la foto. Subila de nuevo.", { fotoUrl: "Archivo inválido" });
  }
  if (datos.cvUrl && datos.cvUrl !== docente.cvUrl && !esPathPrivadoPropio(datos.cvUrl, usuario.id, "cv")) {
    return fallo("No pudimos validar el CV. Subilo de nuevo.", { cvUrl: "Archivo inválido" });
  }

  const db = getDb();

  // El certificado de conducta vive en docente_detalle.documentos (lo crea el alta); se mezcla sin pisar el DNI ni el título.
  const [detalle] = await db
    .select({
      documentos: docenteDetalle.documentos,
      situacionEstudio: docenteDetalle.situacionEstudio,
      porcentajeMaterias: docenteDetalle.porcentajeMaterias,
    })
    .from(docenteDetalle)
    .where(eq(docenteDetalle.docenteId, docente.id))
    .limit(1);
  const documentos = { ...(detalle?.documentos ?? {}) };
  const documentosAnteriores = { ...documentos };

  // Estudios: "estoy estudiando" (porcentaje + constancia) o "ya me recibí" (título). Ausente en el formulario = no se tocan.
  const estudiosEnFormulario = datos.situacionEstudio !== undefined;
  const estudios = estudiosEnFormulario
    ? decidirEstudios({
        actual: detalle?.situacionEstudio,
        pedida: datos.situacionEstudio,
        porcentaje: datos.porcentajeMaterias,
        verificacion: docente.verificacion,
      })
    : null;
  if (estudios && !estudios.ok) return fallo(estudios.error, { [estudios.campo]: estudios.error });
  const estudiante = estudios ? estudios.situacion === "estudiante" : esEstudiante(detalle?.situacionEstudio);

  let conductaCambio = false;
  // Se subió (o se cambió) algo de lo que el equipo tiene que revisar: el DNI, la constancia o el título.
  let documentacionNueva = false;
  // Subió un título que todavía no se revisó: si el perfil ya está verificado, el equipo lo valida desde la ficha.
  let tituloNuevo = false;
  const QUE_ES = {
    conducta: "el certificado",
    dniFrente: "el frente del DNI",
    dniDorso: "el dorso del DNI",
    credencial: "el título",
    constancia: "la constancia de alumno regular",
  } as const;
  // Quien se recibió ya no necesita la constancia: se quita (y se borra de Storage al terminar).
  if (!estudiante && estudiosEnFormulario) delete documentos.constancia;
  for (const clave of ["conducta", "dniFrente", "dniDorso", "credencial", "constancia"] as const) {
    const nuevo = datos[clave];
    if (nuevo === undefined || nuevo === (documentos[clave] ?? "")) continue;
    // La constancia solo corresponde a quien estudia: si se recibió se ignora lo que haya mandado.
    if (clave === "constancia" && !estudiante) continue;
    // Lo ya verificado no se reemplaza desde acá, y a quien se le rechazó la verificación lo atiende el equipo.
    if (clave !== "conducta") {
      if (docente.verificacion === "rechazado") {
        return fallo("Rechazamos tu verificación: escribinos desde Contacto y lo revisamos.", { [clave]: "No se puede cambiar" });
      }
      const verificado = clave === "credencial" ? docente.tituloVerificado : docente.verificacion === "verificado";
      if (verificado) {
        return fallo("Ya lo verificamos: si necesitás cambiarlo, escribinos desde Contacto.", { [clave]: "Ya está verificado" });
      }
    }
    if (nuevo && !esPathPrivadoPropio(nuevo, usuario.id, "documentos")) {
      return fallo(`No pudimos validar ${QUE_ES[clave]}. Subilo de nuevo.`, { [clave]: "Archivo inválido" });
    }
    if (nuevo) documentos[clave] = nuevo;
    else delete documentos[clave];
    if (clave === "conducta") conductaCambio = true;
    else if (nuevo) {
      documentacionNueva = true;
      if (clave === "credencial") tituloNuevo = true;
    }
  }
  const documentosCambio = conductaCambio || documentacionNueva || Object.keys(documentosAnteriores).some((k) => !(k in documentos));

  const sinRepetir = (items: string[]) => {
    const vistos = new Set<string>();
    return items.filter((i) => {
      const clave = normalizar(i);
      if (!clave || vistos.has(clave)) return false;
      vistos.add(clave);
      return true;
    });
  };
  const zonasNuevas = sinRepetir(datos.zonas);

  // Si cambió la primera zona (o todavía no tenía ubicación), la posición sale de la tabla de zonas.
  let ubicacion: { lat: number; lng: number } | undefined;
  if (zonasNuevas.length && (zonasNuevas[0] !== docente.zonas[0] || docente.lat == null || docente.lng == null)) {
    const catalogo = await db.select({ nombre: zonas.nombre, lat: zonas.lat, lng: zonas.lng }).from(zonas);
    for (const z of zonasNuevas) {
      const hit = catalogo.find((c) => normalizar(c.nombre) === normalizar(z));
      if (hit?.lat != null && hit.lng != null) {
        ubicacion = { lat: hit.lat, lng: hit.lng };
        break;
      }
    }
  }

  const guardado = await transaccion(async (tx) => {
    // Todo lo de arriba se decidió con el perfil tal como estaba al abrir esta acción. Si el equipo lo revisó mientras tanto (verificó,
    // pidió una corrección, rechazó), guardar con esa foto vieja pisaría su resolución: se relee con la fila bloqueada y, si cambió, se corta.
    const [vigente] = await tx
      .select({
        verificacion: docentes.verificacion,
        tituloVerificado: docentes.tituloVerificado,
        antecedentesVerificados: docentes.antecedentesVerificados,
      })
      .from(docentes)
      .where(eq(docentes.id, docente.id))
      .limit(1)
      .for("update");
    if (
      !vigente ||
      vigente.verificacion !== docente.verificacion ||
      vigente.tituloVerificado !== docente.tituloVerificado ||
      vigente.antecedentesVerificados !== docente.antecedentesVerificados
    ) {
      return fallo("El equipo acaba de revisar tu perfil y algo cambió. Recargá la página y volvé a guardar.");
    }

    await tx
      .update(docentes)
      .set({
        nombre: nombreFijo ? docente.nombre : datos.nombre,
        apellido: nombreFijo ? docente.apellido : datos.apellido,
        subtitulo: datos.subtitulo || null,
        resumen: datos.resumen || null,
        telefono: datos.telefono || null,
        aniosExperiencia: datos.aniosExperiencia,
        radioKm: datos.radioKm,
        zonas: zonasNuevas,
        asignaturas: sinRepetir(datos.asignaturas),
        niveles: [...new Set(datos.niveles)],
        experiencia: datos.experiencia.filter((e) => e.titulo),
        formacion: datos.formacion.filter((f) => f.titulo),
        disponibilidad: disponibilidadDesdeGrilla(datos.grilla),
        ...(ubicacion ?? {}),
        ...(datos.fotoUrl !== undefined ? { fotoUrl: datos.fotoUrl || null } : {}),
        ...(datos.cvUrl !== undefined ? { cvUrl: datos.cvUrl || null } : {}),
        // Un certificado nuevo hay que volver a revisarlo.
        ...(conductaCambio ? { antecedentesVerificados: false } : {}),
        // Quien tenía una corrección pedida y sube documentación nueva vuelve a la cola de revisión.
        ...(documentacionNueva && docente.verificacion === "correccion" ? { verificacion: "pendiente" as const } : {}),
      })
      .where(eq(docentes.id, docente.id));
    // El equipo se entera de que hay documentación para revisar: si todavía no está verificado ni rechazado (cola de verificación),
    // o si ya está verificado y subió el título (se valida desde su ficha).
    const enCola = docente.verificacion === "pendiente" || docente.verificacion === "correccion";
    const tituloParaRevisar = tituloNuevo && docente.verificacion === "verificado" && !docente.tituloVerificado;
    if (documentacionNueva && (enCola || tituloParaRevisar)) {
      const detalleAviso = tituloParaRevisar && !enCola ? "subió su título para que lo revisen." : "subió documentación para que la revisen.";
      await avisarAAdmins(tx, {
        titulo: `${datos.nombre} ${datos.apellido}`.trim(),
        texto: detalleAviso,
        enlace: `/backoffice/docentes/${docente.id}`,
      });
      await encolarParaEquipo(tx, "M61", {
        docente: `${datos.nombre} ${datos.apellido}`.trim(),
        detalle: detalleAviso,
        ruta: `/backoffice/docentes/${docente.id}`,
      });
    }
    // La grilla vive en docente_detalle; si el docente no tiene fila (perfil cargado a mano), se crea.
    const estudiosGuardados = estudios?.ok
      ? { situacionEstudio: estudios.situacion, porcentajeMaterias: estudios.porcentaje }
      : {};
    await tx
      .insert(docenteDetalle)
      .values({ docenteId: docente.id, grillaDisponibilidad: datos.grilla, documentos, ...estudiosGuardados })
      .onConflictDoUpdate({
        target: docenteDetalle.docenteId,
        set: { grillaDisponibilidad: datos.grilla, ...(documentosCambio ? { documentos } : {}), ...estudiosGuardados },
      });
    return ok();
  });
  if (!guardado.ok) return guardado;

  // Foto, CV y certificado que se reemplazaron o se quitaron: se borran de Storage (lo que no vino en el formulario no cambió).
  await borrarArchivos(
    quitados(
      [docente.fotoUrl, docente.cvUrl, ...Object.values(documentosAnteriores)],
      [
        datos.fotoUrl !== undefined ? datos.fotoUrl : docente.fotoUrl,
        datos.cvUrl !== undefined ? datos.cvUrl : docente.cvUrl,
        ...Object.values(documentos),
      ],
    ),
  );

  if (documentacionNueva) {
    revalidatePath("/backoffice/verificacion");
    revalidatePath("/backoffice/docentes");
  }

  // El layout muestra "Perfil 80%": se refresca junto con las pantallas que dependen del perfil.
  revalidatePath("/docente", "layout");
  return ok();
}

/**
 * "Compartir mi perfil": prende o apaga la página pública del perfil (/profesional/<token>). Prender crea un enlace nuevo
 * (largo y imposible de adivinar) o conserva el que ya tenía; apagar borra el token, así el enlace deja de funcionar para
 * siempre (si se vuelve a prender, es otro). Devuelve el token vigente o null.
 */
export async function compartirPerfil(activar: boolean): Promise<Resultado<{ token: string | null }>> {
  const { docente } = await requerirDocente();
  if (typeof activar !== "boolean") return fallo("No pudimos cambiar el enlace. Probá de nuevo.");

  const [fila] = await getDb()
    .update(docentes)
    // `coalesce`: si dos pedidos llegan a la vez, queda el primero y los dos devuelven el mismo enlace.
    .set({ compartirToken: activar ? sql`coalesce(${docentes.compartirToken}, ${nuevoTokenDePerfil()})` : null })
    .where(eq(docentes.id, docente.id))
    .returning({ token: docentes.compartirToken });

  revalidatePath("/docente/perfil");
  return ok({ token: fila?.token ?? null });
}
