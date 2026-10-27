"use server";

import { revalidatePath } from "next/cache";
import { and, count, eq, gt, ne } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { busquedas, docentes, favoritos, postulaciones } from "@/db/schema";
import { requerirInstitucion } from "@/lib/auth";
import { fallo, ok, parsear, type Resultado } from "@/lib/acciones";
import { correoDeInvitacion } from "@/lib/correo/eventos";
import { notificar } from "@/lib/queries/notificaciones";
import { motivoSinBeneficio } from "@/lib/queries/puntuales";
import { docenteVisible } from "@/lib/visibilidad";
import { resumenDeError } from "@/lib/errores";
import { motivoDeTopeDeInvitaciones } from "@/lib/invitaciones";
import { motivoDeMora } from "@/lib/queries/mora";

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
  // Con una factura vencida hace más de 15 días la cuenta no invita a postularse (ver src/lib/mora.ts).
  const limitada = await motivoDeMora(institucion);
  if (limitada) return fallo(limitada);
  // Invitar a un profesional sale del buscador, que una búsqueda puntual puede no incluir: se exige acá y no solo en la pantalla.
  const sinBuscador = await motivoSinBeneficio(institucion.plan, "buscador");
  if (sinBuscador) return fallo(sinBuscador);
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

  // Tope diario por institución (cuenta en la base, no en la memoria de una instancia): ver `MAX_INVITACIONES_A_PROFESIONALES_POR_DIA`.
  const [{ n: invitadasHoy }] = await db
    .select({ n: count() })
    .from(postulaciones)
    .innerJoin(busquedas, eq(busquedas.id, postulaciones.busquedaId))
    .where(
      and(
        eq(busquedas.institucionId, institucion.id),
        eq(postulaciones.origen, "invitacion"),
        gt(postulaciones.creadoEn, new Date(Date.now() - 24 * 3_600_000)),
      ),
    );
  const tope = motivoDeTopeDeInvitaciones(invitadasHoy);
  if (tope) return fallo(tope);
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
    await correoDeInvitacion(db, { usuarioId: docente.usuarioId, institucion: institucion.nombre, puesto: busqueda.puesto, busquedaId: busqueda.id });
  } catch (error) {
    console.error("No se pudo avisar la invitación al profesional", resumenDeError(error));
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
  const { usuario, institucion } = await requerirInstitucion();
  // Los favoritos de profesionales viven en el buscador y en la base de profesionales, que una búsqueda puntual puede no incluir.
  const sinBuscador = await motivoSinBeneficio(institucion.plan, "buscador");
  if (sinBuscador) return fallo(sinBuscador);
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
