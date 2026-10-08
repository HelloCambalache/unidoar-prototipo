"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { getDb, transaccion } from "@/db";
import {
  busquedas,
  favoritos,
  instituciones,
  notificaciones,
  postulacionNotas,
  postulaciones,
} from "@/db/schema";
import { fallo, ok, parsear, type Resultado } from "@/lib/acciones";
import { requerirDocente } from "@/lib/auth";
import { instanteArgentina } from "@/lib/calendario";
import { postulacionMensajeSchema } from "@/lib/catalogo";
import { correoDePostulantes } from "@/lib/correo/eventos";
import { busquedaAbierta, esId, nombreCompleto } from "@/lib/oportunidades";
import { estadoParaDocente } from "@/lib/postulaciones";
import { usuariosConAcceso } from "@/lib/queries/postulaciones";

/** Pantallas del docente que listan o cuentan postulaciones / ofertas. */
function revalidarPostulaciones(busquedaId?: string) {
  revalidatePath("/docente/oportunidades");
  revalidatePath("/docente/busquedas-rapidas");
  revalidatePath("/docente/postulaciones");
  revalidatePath("/docente/dashboard");
  if (busquedaId) revalidatePath(`/docente/oferta/${busquedaId}`);
}

/** Postulación del docente de la sesión (con su búsqueda e institución), o undefined si no existe o es de otro. */
async function postulacionPropia(postulacionId: string, docenteId: string) {
  const [fila] = await getDb()
    .select({ postulacion: postulaciones, busqueda: busquedas, institucion: instituciones })
    .from(postulaciones)
    .innerJoin(busquedas, eq(busquedas.id, postulaciones.busquedaId))
    .innerJoin(instituciones, eq(instituciones.id, busquedas.institucionId))
    .where(and(eq(postulaciones.id, postulacionId), eq(postulaciones.docenteId, docenteId)))
    .limit(1);
  return fila;
}

/* ───────────────────────────── Postularse ───────────────────────────── */

/**
 * Postula al docente de la sesión a una búsqueda: crea la postulación en la etapa "nuevos"
 * (única por búsqueda y docente) y avisa a todas las cuentas de la institución.
 */
export async function postular(
  busquedaId: string,
  mensaje?: string,
): Promise<Resultado<{ postulacionId: string }>> {
  const { docente } = await requerirDocente();
  if (!esId(busquedaId)) return fallo("La búsqueda no existe.");
  const datos = parsear(postulacionMensajeSchema, { mensaje });
  if (!datos.ok) return fallo(datos.campos?.mensaje ?? datos.error, datos.campos);

  const db = getDb();
  const [fila] = await db
    .select({ busqueda: busquedas, institucion: instituciones })
    .from(busquedas)
    .innerJoin(instituciones, eq(instituciones.id, busquedas.institucionId))
    .where(eq(busquedas.id, busquedaId))
    .limit(1);
  if (!fila) return fallo("La búsqueda no existe o fue retirada.");
  const { busqueda, institucion } = fila;
  if (institucion.suspendida) return fallo("La búsqueda no existe o fue retirada.");

  if (!busquedaAbierta(busqueda)) {
    if (busqueda.estado === "pausada") return fallo("Esta búsqueda está pausada: por ahora no recibe postulaciones.");
    if (busqueda.estado === "activa") return fallo("Esta búsqueda rápida ya venció: no recibe más respuestas.");
    return fallo("Esta búsqueda está cerrada: ya no recibe postulaciones.");
  }

  const [existente] = await db
    .select({ origen: postulaciones.origen })
    .from(postulaciones)
    .where(and(eq(postulaciones.busquedaId, busqueda.id), eq(postulaciones.docenteId, docente.id)))
    .limit(1);
  if (existente) {
    return fallo(
      existente.origen === "invitacion"
        ? "La institución ya te invitó a esta búsqueda: figurás en su lista de postulantes."
        : "Ya te postulaste a esta búsqueda.",
    );
  }

  const destinatarios = await usuariosConAcceso(institucion);
  const nombre = nombreCompleto(docente);

  const creada = await transaccion(async (tx) => {
    const [nueva] = await tx
      .insert(postulaciones)
      .values({
        busquedaId: busqueda.id,
        docenteId: docente.id,
        origen: "postulacion",
        etapa: "nuevos",
        mensaje: datos.data.mensaje ?? null,
      })
      .onConflictDoNothing()
      .returning({ id: postulaciones.id });
    if (!nueva) return null;
    if (destinatarios.length > 0) {
      await tx.insert(notificaciones).values(
        destinatarios.map((usuarioId) => ({
          usuarioId,
          tipo: "postulacion",
          titulo: nombre,
          texto: `se postuló a ${busqueda.puesto}.`,
          enlace: `/institucion/postulantes?busqueda=${busqueda.id}`,
        })),
      );
      await correoDePostulantes(tx, { usuarioIds: destinatarios, busquedaId: busqueda.id, puesto: busqueda.puesto, rapida: busqueda.rapida });
    }
    return nueva;
  });
  // Otra pestaña ganó la carrera entre el chequeo y el insert.
  if (!creada) return fallo("Ya te postulaste a esta búsqueda.");

  revalidarPostulaciones(busqueda.id);
  return ok({ postulacionId: creada.id });
}

/** El docente retira una postulación en curso. Se borra (con sus notas) y se avisa a la institución. */
export async function retirarPostulacion(postulacionId: string): Promise<Resultado> {
  const { docente } = await requerirDocente();
  if (!esId(postulacionId)) return fallo("No encontramos esa postulación.");
  const fila = await postulacionPropia(postulacionId, docente.id);
  if (!fila) return fallo("No encontramos esa postulación.");

  const { postulacion, busqueda, institucion } = fila;
  if (postulacion.etapa === "contratado") return fallo("Esta postulación terminó en contratación: ya no se puede retirar.");
  if (!estadoParaDocente(postulacion.etapa, busqueda.estado).activa) {
    return fallo("Esta postulación ya está cerrada.");
  }

  const destinatarios = await usuariosConAcceso(institucion);
  const nombre = nombreCompleto(docente);
  await transaccion(async (tx) => {
    await tx.delete(postulaciones).where(eq(postulaciones.id, postulacion.id));
    if (destinatarios.length > 0) {
      await tx.insert(notificaciones).values(
        destinatarios.map((usuarioId) => ({
          usuarioId,
          tipo: "postulacion",
          titulo: nombre,
          texto: `retiró su postulación a ${busqueda.puesto}.`,
          enlace: `/institucion/postulantes?busqueda=${busqueda.id}`,
        })),
      );
    }
  });

  revalidarPostulaciones(busqueda.id);
  return ok();
}

/* ───────────────────────────── Favoritos ───────────────────────────── */

/** Guarda o quita una búsqueda de los favoritos del docente. Devuelve cómo quedó. */
export async function alternarFavoritoOferta(busquedaId: string): Promise<Resultado<{ favorita: boolean }>> {
  const { usuario } = await requerirDocente();
  if (!esId(busquedaId)) return fallo("La búsqueda no existe.");

  const db = getDb();
  const clave = and(
    eq(favoritos.usuarioId, usuario.id),
    eq(favoritos.tipo, "busqueda"),
    eq(favoritos.refId, busquedaId),
  );
  const quitados = await db.delete(favoritos).where(clave).returning({ refId: favoritos.refId });
  if (quitados.length === 0) {
    // Solo se puede guardar una búsqueda que existe; quitar una que ya no existe sí se permite.
    const [existe] = await db.select({ id: busquedas.id }).from(busquedas).where(eq(busquedas.id, busquedaId)).limit(1);
    if (!existe) return fallo("La búsqueda no existe o fue retirada.");
    await db.insert(favoritos).values({ usuarioId: usuario.id, tipo: "busqueda", refId: busquedaId }).onConflictDoNothing();
  }

  revalidatePath("/docente/oportunidades");
  revalidatePath("/docente/busquedas-rapidas");
  return ok({ favorita: quitados.length === 0 });
}

/* ───────────────────────────── Notas privadas ───────────────────────────── */

const notaSchema = z.object({
  texto: z.string().trim().min(1, "Escribí la nota").max(1000, "Máximo 1000 caracteres"),
});

export async function agregarNotaDocente(postulacionId: string, texto: string): Promise<Resultado<{ id: string }>> {
  const { usuario, docente } = await requerirDocente();
  if (!esId(postulacionId)) return fallo("No encontramos esa postulación.");
  const datos = parsear(notaSchema, { texto });
  if (!datos.ok) return fallo(datos.campos?.texto ?? datos.error, datos.campos);
  if (!(await postulacionPropia(postulacionId, docente.id))) return fallo("No encontramos esa postulación.");

  const [nota] = await getDb()
    .insert(postulacionNotas)
    .values({ postulacionId, autor: "docente", usuarioId: usuario.id, texto: datos.data.texto })
    .returning({ id: postulacionNotas.id });

  revalidatePath("/docente/postulaciones");
  return ok({ id: nota!.id });
}

/** Borra una nota propia: solo si es del docente y cuelga de una postulación suya. */
export async function borrarNotaDocente(notaId: string): Promise<Resultado> {
  const { docente } = await requerirDocente();
  if (!esId(notaId)) return fallo("No encontramos esa nota.");

  const db = getDb();
  const borradas = await db
    .delete(postulacionNotas)
    .where(
      and(
        eq(postulacionNotas.id, notaId),
        eq(postulacionNotas.autor, "docente"),
        inArray(
          postulacionNotas.postulacionId,
          db.select({ id: postulaciones.id }).from(postulaciones).where(eq(postulaciones.docenteId, docente.id)),
        ),
      ),
    )
    .returning({ id: postulacionNotas.id });
  if (borradas.length === 0) return fallo("No encontramos esa nota.");

  revalidatePath("/docente/postulaciones");
  return ok();
}

/* ───────────────────────────── Agenda ───────────────────────────── */

const agendaSchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Elegí una fecha"),
  hora: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Elegí una hora"),
  titulo: z.string().trim().min(2, "Poné un título").max(120, "Máximo 120 caracteres"),
});

/** Guarda la fecha, hora (de Argentina) y título que el docente quiere recordar para esta postulación. */
export async function agendarDocente(
  postulacionId: string,
  entrada: { fecha: string; hora: string; titulo: string },
): Promise<Resultado> {
  const { docente } = await requerirDocente();
  if (!esId(postulacionId)) return fallo("No encontramos esa postulación.");
  const datos = parsear(agendaSchema, entrada);
  if (!datos.ok) return fallo(datos.error, datos.campos);
  const instante = instanteArgentina(datos.data.fecha, datos.data.hora);
  if (!instante) return fallo("La fecha no es válida.", { fecha: "La fecha no es válida" });

  const actualizadas = await getDb()
    .update(postulaciones)
    .set({ entrevistaEn: instante, entrevistaTitulo: datos.data.titulo })
    .where(and(eq(postulaciones.id, postulacionId), eq(postulaciones.docenteId, docente.id)))
    .returning({ id: postulaciones.id });
  if (actualizadas.length === 0) return fallo("No encontramos esa postulación.");

  revalidatePath("/docente/postulaciones");
  return ok();
}

export async function quitarAgendaDocente(postulacionId: string): Promise<Resultado> {
  const { docente } = await requerirDocente();
  if (!esId(postulacionId)) return fallo("No encontramos esa postulación.");

  const actualizadas = await getDb()
    .update(postulaciones)
    .set({ entrevistaEn: null, entrevistaTitulo: null })
    .where(and(eq(postulaciones.id, postulacionId), eq(postulaciones.docenteId, docente.id)))
    .returning({ id: postulaciones.id });
  if (actualizadas.length === 0) return fallo("No encontramos esa postulación.");

  revalidatePath("/docente/postulaciones");
  return ok();
}
