"use server";

import { revalidatePath } from "next/cache";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { busquedas, docentes, favoritos, postulaciones } from "@/db/schema";
import { requerirInstitucion } from "@/lib/auth";
import { fallo, ok, parsear, type Resultado } from "@/lib/acciones";
import { notificar } from "@/lib/queries/notificaciones";
import { docenteVisible } from "@/lib/visibilidad";

const idsInvitacion = z.object({
  docenteId: z.guid({ error: "Perfil inválido" }),
  busquedaId: z.guid({ error: "Búsqueda inválida" }),
});
const idDocente = z.object({ docenteId: z.guid({ error: "Perfil inválido" }) });

/** Todo lo que cambia cuando se invita o se guarda a alguien. */
function refrescarProfesionales() {
  revalidatePath("/institucion/buscar-docentes");
  revalidatePath("/institucion/busquedas-rapidas");
  revalidatePath("/institucion/base-de-docentes");
  revalidatePath("/institucion/docente/[id]", "page");
}

/**
 * Invita a un docente a postularse a una búsqueda activa de la institución: crea la postulación con
 * origen "invitacion" (etapa "nuevos") y le avisa si tiene cuenta. Si ya está en esa búsqueda, lo dice.
 */
export async function invitarDocente(docenteId: string, busquedaId: string): Promise<Resultado> {
  const { institucion } = await requerirInstitucion();
  const p = parsear(idsInvitacion, { docenteId, busquedaId });
  if (!p.ok) return fallo(p.error);
  const db = getDb();

  // La búsqueda tiene que ser de esta institución: el id viene del cliente.
  const [busqueda] = await db
    .select({
      id: busquedas.id,
      puesto: busquedas.puesto,
      estado: busquedas.estado,
      rapida: busquedas.rapida,
      venceEn: busquedas.venceEn,
    })
    .from(busquedas)
    .where(and(eq(busquedas.id, p.data.busquedaId), eq(busquedas.institucionId, institucion.id)))
    .limit(1);
  if (!busqueda) return fallo("No encontramos esa búsqueda.");
  if (busqueda.estado !== "activa") return fallo("Solo podés invitar a búsquedas activas.");
  if (busqueda.rapida && busqueda.venceEn && busqueda.venceEn < new Date())
    return fallo("Esa búsqueda rápida ya venció.");

  const [docente] = await db
    .select({ id: docentes.id, nombre: docentes.nombre, usuarioId: docentes.usuarioId })
    .from(docentes)
    .where(
      and(
        eq(docentes.id, p.data.docenteId),
        eq(docentes.onboardingCompleto, true),
        ne(docentes.verificacion, "rechazado"),
        docenteVisible,
      ),
    )
    .limit(1);
  if (!docente) return fallo("Este perfil no está disponible.");

  const [creada] = await db
    .insert(postulaciones)
    .values({ busquedaId: busqueda.id, docenteId: docente.id, origen: "invitacion", etapa: "nuevos" })
    .onConflictDoNothing()
    .returning({ id: postulaciones.id });

  if (!creada) {
    const [existente] = await db
      .select({ origen: postulaciones.origen })
      .from(postulaciones)
      .where(and(eq(postulaciones.busquedaId, busqueda.id), eq(postulaciones.docenteId, docente.id)))
      .limit(1);
    return fallo(
      existente?.origen === "postulacion"
        ? `${docente.nombre} ya se postuló a esta búsqueda: la tenés en Postulantes.`
        : `Ya invitaste a ${docente.nombre} a esta búsqueda.`,
    );
  }

  // La invitación ya está guardada: si falla el aviso no se la desarma, queda registrado y listo.
  try {
    await notificar(docente.usuarioId, {
      tipo: "invitacion",
      titulo: institucion.nombre,
      texto: `te invitó a postularte a ${busqueda.puesto}.`,
      enlace: `/docente/oferta/${busqueda.id}`,
    });
  } catch (error) {
    console.error("No se pudo avisar la invitación al docente", error);
  }

  refrescarProfesionales();
  revalidatePath("/institucion/postulantes");
  revalidatePath("/institucion/busquedas");
  revalidatePath("/institucion/dashboard");
  revalidatePath("/docente/postulaciones");
  revalidatePath("/docente/notificaciones");
  return ok();
}

/** Guarda o quita un docente de los favoritos de quien está en sesión. Devuelve cómo quedó. */
export async function alternarFavorito(docenteId: string): Promise<Resultado<{ favorito: boolean }>> {
  const { usuario } = await requerirInstitucion();
  const p = parsear(idDocente, { docenteId });
  if (!p.ok) return fallo(p.error);
  const db = getDb();

  const [docente] = await db.select({ id: docentes.id }).from(docentes).where(eq(docentes.id, p.data.docenteId)).limit(1);
  if (!docente) return fallo("No encontramos ese perfil.");

  const quitados = await db
    .delete(favoritos)
    .where(and(eq(favoritos.usuarioId, usuario.id), eq(favoritos.tipo, "docente"), eq(favoritos.refId, docente.id)))
    .returning({ refId: favoritos.refId });
  if (quitados.length === 0) {
    await db
      .insert(favoritos)
      .values({ usuarioId: usuario.id, tipo: "docente", refId: docente.id })
      .onConflictDoNothing();
  }

  refrescarProfesionales();
  return ok({ favorito: quitados.length === 0 });
}
