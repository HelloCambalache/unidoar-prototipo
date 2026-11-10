import "server-only";
import { and, eq, inArray, isNull, or } from "drizzle-orm";
import { getDb } from "@/db";
import { colaWhatsapp, consentimientosWhatsapp, usuarios } from "@/db/schema";
import type { Ejecutor } from "@/lib/queries/pipeline";
import { VERSION_DEL_CONSENTIMIENTO, validarNumeroDeAvisos } from "@/lib/whatsapp/consentimiento";
import { claveDeNumero, numeroEnmascarado } from "@/lib/whatsapp/telefono";

/*
 * Consentimiento para recibir avisos por WhatsApp (ver src/lib/whatsapp/consentimiento.ts). Todo se hace sobre la cuenta de la sesión: nadie activa ni
 * retira el consentimiento de otra persona. La única otra puerta es la respuesta «BAJA» que llega al webhook, que retira por número.
 */

export type EstadoDeAvisosPorWhatsapp = {
  activos: boolean;
  /** El número terminado en…, nunca entero. */
  numeroEnmascarado: string | null;
};

/** Cómo está la cuenta con los avisos por WhatsApp: activos (con el número enmascarado) o no. */
export async function avisosPorWhatsappDe(usuarioId: string): Promise<EstadoDeAvisosPorWhatsapp> {
  const [fila] = await getDb()
    .select({ telefono: consentimientosWhatsapp.telefono, bajaEn: consentimientosWhatsapp.bajaEn })
    .from(consentimientosWhatsapp)
    .where(eq(consentimientosWhatsapp.usuarioId, usuarioId))
    .limit(1);
  if (!fila || fila.bajaEn) return { activos: false, numeroEnmascarado: null };
  return { activos: true, numeroEnmascarado: numeroEnmascarado(fila.telefono) };
}

/** Activa los avisos para esta cuenta en el celular que escribió (o cambia el número). Devuelve el mensaje de error si el número no sirve. */
export async function activarAvisosPorWhatsapp(
  usuarioId: string,
  telefono: string,
  origen: "cuenta" | "alta" = "cuenta",
): Promise<{ ok: true } | { ok: false; error: string }> {
  const validado = validarNumeroDeAvisos(telefono);
  if (!validado.ok) return validado;
  const ahora = new Date();
  const valores = { telefono: validado.numero, clave: validado.clave, otorgadoEn: ahora, bajaEn: null, origen, version: VERSION_DEL_CONSENTIMIENTO };
  await getDb()
    .insert(consentimientosWhatsapp)
    .values({ usuarioId, ...valores })
    .onConflictDoUpdate({ target: consentimientosWhatsapp.usuarioId, set: valores });
  return { ok: true };
}

/** Retira el consentimiento de esta cuenta: queda anotado (con la fecha de la baja) y no sale ningún aviso más. */
export async function retirarAvisosPorWhatsapp(usuarioId: string): Promise<void> {
  await getDb()
    .update(consentimientosWhatsapp)
    .set({ bajaEn: new Date() })
    .where(and(eq(consentimientosWhatsapp.usuarioId, usuarioId), isNull(consentimientosWhatsapp.bajaEn)));
}

/**
 * Retira el consentimiento de todas las cuentas que lo dieron para este número (la respuesta «BAJA» llega por número, no por cuenta: dos personas de un mismo
 * equipo pueden compartir un celular). Devuelve cuántas cuentas dejaron de recibir avisos.
 */
export async function retirarAvisosPorNumero(numeroDeWhatsapp: string): Promise<number> {
  const clave = claveDeNumero(numeroDeWhatsapp);
  if (!clave) return 0;
  const filas = await getDb()
    .update(consentimientosWhatsapp)
    .set({ bajaEn: new Date() })
    .where(and(eq(consentimientosWhatsapp.clave, clave), isNull(consentimientosWhatsapp.bajaEn)))
    .returning({ usuarioId: consentimientosWhatsapp.usuarioId });
  return filas.length;
}

/**
 * Borra todo lo de WhatsApp de estas cuentas cuando se da de baja una cuenta (un teléfono es un dato personal): su consentimiento, los avisos que se les anotaron y las
 * respuestas automáticas que se mandaron a su número. Va en la misma transacción de la baja, ANTES de borrar la fila de la cuenta (después, los avisos perderían el vínculo con ella).
 * De los avisos de otras cuentas que comparten el número solo se borran las respuestas automáticas, no sus avisos. Devuelve cuántos avisos borró.
 */
export async function borrarDatosDeWhatsappDe(ejecutor: Ejecutor, usuarioIds: string[]): Promise<number> {
  const ids = [...new Set(usuarioIds.filter(Boolean))];
  if (ids.length === 0) return 0;
  const telefonos = (await ejecutor.select({ telefono: consentimientosWhatsapp.telefono }).from(consentimientosWhatsapp).where(inArray(consentimientosWhatsapp.usuarioId, ids))).map(
    (f) => f.telefono,
  );
  const avisos = await ejecutor
    .delete(colaWhatsapp)
    .where(or(inArray(colaWhatsapp.usuarioId, ids), telefonos.length > 0 ? and(eq(colaWhatsapp.tipo, "texto"), inArray(colaWhatsapp.para, telefonos)) : undefined))
    .returning({ id: colaWhatsapp.id });
  await ejecutor.delete(consentimientosWhatsapp).where(inArray(consentimientosWhatsapp.usuarioId, ids));
  return avisos.length;
}

/** Los consentimientos activos de estas cuentas (los que no tienen baja), con el número al que mandar. Se lee con el mismo ejecutor de la acción que anota el aviso. */
export async function consentimientosActivos(ejecutor: Ejecutor, usuarioIds: string[]): Promise<Map<string, { telefono: string; clave: string }>> {
  const ids = [...new Set(usuarioIds.filter(Boolean))];
  const mapa = new Map<string, { telefono: string; clave: string }>();
  if (ids.length === 0) return mapa;
  const filas = await ejecutor
    .select({ usuarioId: consentimientosWhatsapp.usuarioId, telefono: consentimientosWhatsapp.telefono, clave: consentimientosWhatsapp.clave })
    .from(consentimientosWhatsapp)
    .innerJoin(usuarios, eq(usuarios.id, consentimientosWhatsapp.usuarioId))
    .where(and(inArray(consentimientosWhatsapp.usuarioId, ids), isNull(consentimientosWhatsapp.bajaEn)));
  for (const f of filas) mapa.set(f.usuarioId, { telefono: f.telefono, clave: f.clave });
  return mapa;
}
