"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, transaccion } from "@/db";
import {
  busquedas,
  docentes,
  favoritos,
  postulacionNotas,
  postulaciones,
  type EtapaPostulacion,
} from "@/db/schema";
import { fallo, ok, parsear, type Resultado } from "@/lib/acciones";
import { requerirInstitucion } from "@/lib/auth";
import { esUuid } from "@/lib/busquedas";
import { diaHoraLegible } from "@/lib/calendario";
import { correoDeContratacion, correoDeEntrevista, correoDeEntrevistaCancelada, correoDeEtapa } from "@/lib/correo/eventos";
import { fechaDeInput, parsearFechaHoraAR } from "@/lib/fechas";
import { ETAPAS_MOVIBLES } from "@/lib/postulaciones";
import { avisar, avisarCierreDeBusqueda, avisoDeEtapa } from "@/lib/queries/avisos";
import { postulacionPropia } from "@/lib/queries/pipeline";

const NO_ENCONTRADA = "No encontramos esa postulación.";
const BUSQUEDA_CERRADA = "La búsqueda está cerrada. Reabrila para mover postulantes.";

/** Pantallas que listan o cuentan postulaciones, de las dos puntas. */
function revalidarPipeline() {
  revalidatePath("/institucion/postulantes");
  revalidatePath("/institucion/busquedas");
  revalidatePath("/institucion/dashboard");
  revalidatePath("/docente/postulaciones");
  revalidatePath("/docente/dashboard");
}

const etapaMovibleSchema = z.enum(ETAPAS_MOVIBLES as [EtapaPostulacion, ...EtapaPostulacion[]]);

/** Enlace con el que el docente abre la postulación en su pantalla. */
const enlaceDocente = (postulacionId: string) => `/docente/postulaciones?abrir=${postulacionId}`;

/* ───────────────────────────── Etapas ───────────────────────────── */

/**
 * Mueve una postulación de etapa (drag & drop o menú) y avisa al docente. "Contratado" no entra
 * por acá: se confirma desde /institucion/contratar. También sirve para recuperar a un archivado (etapa interna `descartado`).
 */
export async function moverPostulacion(postulacionId: string, etapa: EtapaPostulacion): Promise<Resultado> {
  const { institucion } = await requerirInstitucion();
  if (!esUuid(postulacionId)) return fallo(NO_ENCONTRADA);
  const destino = etapaMovibleSchema.safeParse(etapa);
  if (!destino.success) {
    return fallo(etapa === "contratado" ? "Para contratar a una persona usá «Contratar»." : "Esa etapa no existe.");
  }

  const resultado = await transaccion(async (tx) => {
    const fila = await postulacionPropia(institucion.id, postulacionId, tx);
    if (!fila) return fallo(NO_ENCONTRADA);
    if (fila.busqueda.estado === "cerrada") return fallo(BUSQUEDA_CERRADA);
    if (fila.postulacion.etapa === destino.data) return ok();

    await tx
      .update(postulaciones)
      .set({ etapa: destino.data, etapaDesde: new Date() })
      .where(eq(postulaciones.id, fila.postulacion.id));

    const aviso = avisoDeEtapa(destino.data, fila.busqueda.puesto);
    if (aviso) {
      await avisar(tx, fila.docente.usuarioId, {
        ...aviso,
        titulo: institucion.nombre,
        enlace: enlaceDocente(fila.postulacion.id),
      });
    }
    await correoDeEtapa(tx, destino.data, {
      usuarioId: fila.docente.usuarioId,
      institucion: institucion.nombre,
      puesto: fila.busqueda.puesto,
      postulacionId: fila.postulacion.id,
    });
    return ok();
  });

  if (resultado.ok) revalidarPipeline();
  return resultado;
}

/**
 * Archiva a un postulante (etapa interna `descartado`: sale del tablero, queda en "Archivados" y se puede recuperar).
 * Es SILENCIOSO a propósito: no se le manda ninguna notificación ni mail a la persona. Se entera, si la búsqueda se cierra,
 * por el aviso de cierre (`avisarCierreDeBusqueda`); hasta entonces su postulación solo cambia de estado en su pantalla.
 */
export async function descartarPostulacion(postulacionId: string): Promise<Resultado> {
  const { institucion } = await requerirInstitucion();
  if (!esUuid(postulacionId)) return fallo(NO_ENCONTRADA);

  const resultado = await transaccion(async (tx) => {
    const fila = await postulacionPropia(institucion.id, postulacionId, tx);
    if (!fila) return fallo(NO_ENCONTRADA);
    if (fila.busqueda.estado === "cerrada") return fallo(BUSQUEDA_CERRADA);
    if (fila.postulacion.etapa === "descartado") return ok();
    if (fila.postulacion.etapa === "contratado") {
      return fallo("Esta persona ya está contratada. Movela de etapa antes de archivarla.");
    }

    await tx
      .update(postulaciones)
      .set({ etapa: "descartado", etapaDesde: new Date() })
      .where(eq(postulaciones.id, fila.postulacion.id));

    return ok();
  });

  if (resultado.ok) revalidarPipeline();
  return resultado;
}

/* ───────────────────────────── Contratar ───────────────────────────── */

const contratarSchema = z.object({
  inicio: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  cerrar: z.literal("on").optional(),
});

export type EstadoContratar = { ok: false; error: string; campos?: Record<string, string> } | null;

/**
 * Confirma la contratación: pasa la postulación a "contratado", avisa al docente y, si se tildó,
 * cierra la búsqueda. Todo en una transacción. Al terminar redirige: a Publicaciones (cerradas)
 * si se cerró, o de vuelta al pipeline si siguen buscando.
 */
export async function contratarPostulacion(
  postulacionId: string,
  _estado: EstadoContratar,
  formData: FormData,
): Promise<EstadoContratar> {
  const { institucion } = await requerirInstitucion();
  if (!esUuid(postulacionId)) return fallo(NO_ENCONTRADA);
  const datos = parsear(contratarSchema, formData);
  if (!datos.ok) return fallo(datos.error, datos.campos);

  const resultado = await transaccion(async (tx) => {
    const fila = await postulacionPropia(institucion.id, postulacionId, tx);
    if (!fila) return fallo(NO_ENCONTRADA);
    const { postulacion, busqueda, docente } = fila;
    if (postulacion.etapa === "descartado") return fallo("Esta postulación está archivada. Recuperala antes de contratar.");
    if (busqueda.estado === "cerrada" && postulacion.etapa !== "contratado") return fallo(BUSQUEDA_CERRADA);

    const cerrar = datos.data.cerrar === "on" && busqueda.estado !== "cerrada";
    if (postulacion.etapa !== "contratado") {
      await tx
        .update(postulaciones)
        .set({ etapa: "contratado", etapaDesde: new Date() })
        .where(eq(postulaciones.id, postulacion.id));
      const inicio = datos.data.inicio ? `, con inicio el ${fechaDeInput(datos.data.inicio)}` : "";
      await avisar(tx, docente.usuarioId, {
        tipo: "postulacion",
        titulo: institucion.nombre,
        texto: `te eligió para «${busqueda.puesto}»${inicio}. ¡Felicitaciones!`,
        enlace: enlaceDocente(postulacion.id),
      });
      await correoDeContratacion(tx, {
        usuarioId: docente.usuarioId,
        institucion: institucion.nombre,
        puesto: busqueda.puesto,
        postulacionId: postulacion.id,
        inicio: datos.data.inicio ? fechaDeInput(datos.data.inicio) : null,
      });
    }
    if (cerrar) {
      await tx
        .update(busquedas)
        .set({ estado: "cerrada", cerradaEn: new Date() })
        .where(and(eq(busquedas.id, busqueda.id), eq(busquedas.institucionId, institucion.id)));
      // Al cerrar la búsqueda, los demás postulantes se enteran (campanita, sin mail); quien fue contratado ya sabe.
      await avisarCierreDeBusqueda(tx, { busquedaId: busqueda.id, puesto: busqueda.puesto, institucionNombre: institucion.nombre });
    }
    return { ok: true as const, busquedaId: busqueda.id, cerrada: cerrar || busqueda.estado === "cerrada" };
  });

  if (!resultado.ok) return resultado;
  revalidarPipeline();
  redirect(resultado.cerrada ? "/institucion/busquedas?tab=cerradas" : `/institucion/postulantes?busqueda=${resultado.busquedaId}`);
}

/* ───────────────────────────── Entrevista ───────────────────────────── */

const entrevistaSchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Elegí fecha y hora"),
  titulo: z
    .string()
    .trim()
    .max(120, "Máximo 120 caracteres")
    .optional()
    .transform((v) => v || undefined),
});

/**
 * Agenda (o reprograma) la entrevista. `fecha` es la hora argentina de un datetime-local
 * ("2026-10-15T10:30"). Si el postulante estaba en Nuevos o Preseleccionados pasa a Entrevista.
 */
export async function agendarEntrevista(
  postulacionId: string,
  entrada: { fecha: string; titulo?: string },
): Promise<Resultado> {
  const { institucion } = await requerirInstitucion();
  if (!esUuid(postulacionId)) return fallo(NO_ENCONTRADA);
  const datos = parsear(entrevistaSchema, entrada);
  if (!datos.ok) return fallo(datos.campos?.fecha ?? datos.campos?.titulo ?? datos.error, datos.campos);
  const instante = parsearFechaHoraAR(datos.data.fecha);
  if (!instante) return fallo("La fecha no es válida.", { fecha: "La fecha no es válida" });
  if (instante.getTime() <= Date.now()) {
    return fallo("La entrevista tiene que ser a futuro.", { fecha: "Elegí una fecha futura" });
  }

  const resultado = await transaccion(async (tx) => {
    const fila = await postulacionPropia(institucion.id, postulacionId, tx);
    if (!fila) return fallo(NO_ENCONTRADA);
    const { postulacion, busqueda, docente } = fila;
    if (busqueda.estado === "cerrada") return fallo(BUSQUEDA_CERRADA);
    if (postulacion.etapa === "descartado") return fallo("Esta postulación está archivada. Recuperala para agendar.");
    if (postulacion.etapa === "contratado") return fallo("Esta persona ya está contratada.");

    const entraAEntrevista = postulacion.etapa === "nuevos" || postulacion.etapa === "preseleccionados";
    await tx
      .update(postulaciones)
      .set({
        entrevistaEn: instante,
        entrevistaTitulo: datos.data.titulo ?? null,
        ...(entraAEntrevista ? { etapa: "entrevista" as const, etapaDesde: new Date() } : {}),
      })
      .where(eq(postulaciones.id, postulacion.id));

    await avisar(tx, docente.usuarioId, {
      tipo: "entrevista",
      titulo: institucion.nombre,
      texto: `agendó una entrevista para «${busqueda.puesto}»: ${diaHoraLegible(instante)}.`,
      enlace: enlaceDocente(postulacion.id),
    });
    await correoDeEntrevista(tx, {
      usuarioId: docente.usuarioId,
      institucion: institucion.nombre,
      puesto: busqueda.puesto,
      postulacionId: postulacion.id,
      cuando: instante,
      cuandoTexto: diaHoraLegible(instante),
      titulo: datos.data.titulo ?? null,
    });
    return ok();
  });

  if (resultado.ok) revalidarPipeline();
  return resultado;
}

/** Quita la entrevista agendada (la postulación se queda en su etapa) y avisa al docente. */
export async function quitarEntrevista(postulacionId: string): Promise<Resultado> {
  const { institucion } = await requerirInstitucion();
  if (!esUuid(postulacionId)) return fallo(NO_ENCONTRADA);

  const resultado = await transaccion(async (tx) => {
    const fila = await postulacionPropia(institucion.id, postulacionId, tx);
    if (!fila) return fallo(NO_ENCONTRADA);
    const { postulacion, busqueda, docente } = fila;
    if (!postulacion.entrevistaEn) return ok();

    await tx
      .update(postulaciones)
      .set({ entrevistaEn: null, entrevistaTitulo: null })
      .where(eq(postulaciones.id, postulacion.id));
    await avisar(tx, docente.usuarioId, {
      tipo: "entrevista",
      titulo: institucion.nombre,
      texto: `canceló la entrevista que había agendado para «${busqueda.puesto}».`,
      enlace: enlaceDocente(postulacion.id),
    });
    await correoDeEntrevistaCancelada(tx, {
      usuarioId: docente.usuarioId,
      institucion: institucion.nombre,
      puesto: busqueda.puesto,
      postulacionId: postulacion.id,
      cuando: postulacion.entrevistaEn,
    });
    return ok();
  });

  if (resultado.ok) revalidarPipeline();
  return resultado;
}

/* ───────────────────────────── Notas internas ───────────────────────────── */

const notaSchema = z.object({
  texto: z.string().trim().min(1, "Escribí la nota").max(1000, "Máximo 1000 caracteres"),
});

/** Nota interna de la institución sobre un postulante: la ve todo el equipo, nunca el docente. */
export async function agregarNotaInstitucion(postulacionId: string, texto: string): Promise<Resultado<{ id: string }>> {
  const { usuario, institucion } = await requerirInstitucion();
  if (!esUuid(postulacionId)) return fallo(NO_ENCONTRADA);
  const datos = parsear(notaSchema, { texto });
  if (!datos.ok) return fallo(datos.campos?.texto ?? datos.error, datos.campos);
  if (!(await postulacionPropia(institucion.id, postulacionId))) return fallo(NO_ENCONTRADA);

  const [nota] = await getDb()
    .insert(postulacionNotas)
    .values({ postulacionId, autor: "institucion", usuarioId: usuario.id, texto: datos.data.texto })
    .returning({ id: postulacionNotas.id });

  revalidatePath("/institucion/postulantes");
  return ok({ id: nota!.id });
}

/** Borra una nota interna: solo si es de la institución y cuelga de una postulación de una búsqueda suya. */
export async function borrarNotaInstitucion(notaId: string): Promise<Resultado> {
  const { institucion } = await requerirInstitucion();
  if (!esUuid(notaId)) return fallo("No encontramos esa nota.");

  const db = getDb();
  const [nota] = await db
    .select({ id: postulacionNotas.id })
    .from(postulacionNotas)
    .innerJoin(postulaciones, eq(postulaciones.id, postulacionNotas.postulacionId))
    .innerJoin(busquedas, eq(busquedas.id, postulaciones.busquedaId))
    .where(
      and(
        eq(postulacionNotas.id, notaId),
        eq(postulacionNotas.autor, "institucion"),
        eq(busquedas.institucionId, institucion.id),
      ),
    )
    .limit(1);
  if (!nota) return fallo("No encontramos esa nota.");

  await db.delete(postulacionNotas).where(eq(postulacionNotas.id, nota.id));
  revalidatePath("/institucion/postulantes");
  return ok();
}

/* ───────────────────────────── Favoritos ───────────────────────────── */

/** Guarda o quita a un docente de los favoritos de quien opera la sesión. Devuelve cómo quedó. */
export async function toggleFavoritoDocente(docenteId: string): Promise<Resultado<{ favorito: boolean }>> {
  const { usuario } = await requerirInstitucion();
  if (!esUuid(docenteId)) return fallo("No encontramos a ese profesional.");

  const db = getDb();
  const quitados = await db
    .delete(favoritos)
    .where(and(eq(favoritos.usuarioId, usuario.id), eq(favoritos.tipo, "docente"), eq(favoritos.refId, docenteId)))
    .returning({ refId: favoritos.refId });

  if (quitados.length === 0) {
    const [existe] = await db.select({ id: docentes.id }).from(docentes).where(eq(docentes.id, docenteId)).limit(1);
    if (!existe) return fallo("No encontramos a ese profesional.");
    await db.insert(favoritos).values({ usuarioId: usuario.id, tipo: "docente", refId: docenteId }).onConflictDoNothing();
  }

  revalidatePath("/institucion/postulantes");
  revalidatePath("/institucion/base-de-docentes");
  revalidatePath("/institucion/buscar-docentes");
  return ok({ favorito: quitados.length === 0 });
}
