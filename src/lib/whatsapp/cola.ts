import "server-only";
import { and, asc, count, eq, gt, inArray, lt, or, sql } from "drizzle-orm";
import { after } from "next/server";
import { getDb } from "@/db";
import { colaWhatsapp, consentimientosWhatsapp, docentes, type AvisoDeWhatsappEnCola } from "@/db/schema";
import { resumenDeError } from "@/lib/errores";
import type { Ejecutor } from "@/lib/queries/pipeline";
import { consentimientosActivos } from "@/lib/queries/whatsapp";
import { modoWhatsapp } from "./config";
import { puedeRecibirAvisos } from "./consentimiento";
import { enviarWhatsapp, type MensajeDeWhatsapp } from "./cliente";
import { datosDeAviso, esPlantillaDeWhatsapp, type DatosDeAviso, type NombreDePlantilla } from "./plantillas";
import { estadoTrasAviso, type EstadoRecibido } from "./webhook";

/*
 * Cola de avisos por WhatsApp ("outbox"), con el mismo modelo que la de mails (src/lib/correo/cola.ts):
 *   1. La acción que origina el aviso llama a `encolarAviso` DENTRO de su transacción: si se deshace, no sale nada.
 *   2. `encolarAviso` deja pedido el despacho con `after()`, que corre con la transacción ya confirmada.
 *   3. Si algo falla o la instancia se corta, queda pendiente y lo retoma el próximo despacho o el cron diario. Lo que lleva más de 24 horas sin
 *      salir se descarta: «te preseleccionaron» un día después ya no es un aviso.
 * Con los avisos apagados (`modoWhatsapp() === "apagado"`) no se anota nada. Un error al anotar un aviso NUNCA rompe la acción que lo origina.
 *
 * Quien no dio su consentimiento no recibe nada, y se vuelve a comprobar al mandar (no solo al anotar): si la persona retiró el consentimiento o cambió de número
 * mientras el aviso esperaba, no sale.
 */

const MAX_INTENTOS = 3;
/** Un aviso "procesando" hace más de esto es de una instancia que se cortó: se reclama de nuevo. */
const MINUTOS_PARA_RECLAMAR = 10;
const HORAS_DE_VIGENCIA = 24;
/** Cuántos avisos con plantilla puede recibir un mismo número por día: una búsqueda con mucho movimiento no tiene que llenarle el WhatsApp a nadie. */
export const TOPE_POR_NUMERO_POR_DIA = 8;
const DIAS_DE_HISTORIAL = 90;

/** Anota el mismo aviso para varias cuentas que lo pidieron. Nunca lanza: si algo del aviso falla, queda en el log y la acción sigue. */
export async function encolarAviso(
  ejecutor: Ejecutor,
  usuarioIds: string[],
  plantilla: NombreDePlantilla,
  valores: readonly (string | null | undefined)[],
  ruta: string,
  clave: (usuarioId: string) => string,
): Promise<void> {
  if (modoWhatsapp() === "apagado") return;
  try {
    const ids = [...new Set(usuarioIds.filter(Boolean))];
    if (ids.length === 0) return;
    const datos: DatosDeAviso = datosDeAviso(plantilla, valores, ruta);

    const consentimientos = await consentimientosActivos(ejecutor, ids);
    if (consentimientos.size === 0) return;
    // Igual que los mails de contratación: a un profesional suspendido no se le avisa (no puede entrar y el enlace terminaría en «cuenta suspendida»).
    const suspendidos = await ejecutor
      .select({ usuarioId: docentes.usuarioId })
      .from(docentes)
      .where(and(inArray(docentes.usuarioId, [...consentimientos.keys()]), eq(docentes.suspendido, true)));
    const fuera = new Set(suspendidos.map((s) => s.usuarioId));

    const filas = [...consentimientos.entries()]
      .filter(([id]) => !fuera.has(id))
      .map(([id, c]) => ({ para: c.telefono, usuarioId: id, tipo: "plantilla", plantilla, datos: datos as unknown as Record<string, unknown>, clave: clave(id) }));
    if (filas.length === 0) return;
    await ejecutor.insert(colaWhatsapp).values(filas).onConflictDoNothing();
    despacharWhatsapp();
  } catch (e) {
    console.error("No se pudo anotar un aviso de WhatsApp", resumenDeError(e));
  }
}

/** Anota una respuesta libre a quien nos escribió (solo se puede dentro de las 24 horas de su mensaje: por eso se manda enseguida). `para` es el número tal como lo manda Meta. */
export async function encolarRespuesta(para: string, texto: string, clave: string): Promise<void> {
  if (modoWhatsapp() === "apagado") return;
  await getDb()
    .insert(colaWhatsapp)
    .values({ para, tipo: "texto", plantilla: "texto", datos: { texto }, clave })
    .onConflictDoNothing();
  despacharWhatsapp();
}

/** Pide mandar lo pendiente cuando termine la respuesta actual (lo hacen solos los `encolar…`). */
export function despacharWhatsapp() {
  if (modoWhatsapp() === "apagado") return;
  try {
    after(async () => {
      try {
        await vaciarColaWhatsapp({ limite: 20 });
      } catch (e) {
        console.error("No se pudo despachar la cola de WhatsApp", resumenDeError(e));
      }
    });
  } catch {
    // Fuera de un pedido (scripts, pruebas): lo despacha el cron.
  }
}

export type ResumenDeColaWhatsapp = { enviados: number; omitidos: number; fallidos: number; reintentos: number };

/** Manda hasta `limite` avisos pendientes, de a uno. Dos despachos a la vez no se pisan: cada aviso se reclama con `FOR UPDATE SKIP LOCKED`. */
export async function vaciarColaWhatsapp(opciones: { limite?: number } = {}): Promise<ResumenDeColaWhatsapp> {
  const modo = modoWhatsapp();
  const resumen: ResumenDeColaWhatsapp = { enviados: 0, omitidos: 0, fallidos: 0, reintentos: 0 };
  if (modo === "apagado") return resumen;

  const db = getDb();
  const ahora = new Date();
  const vencidoDesde = new Date(ahora.getTime() - HORAS_DE_VIGENCIA * 3_600_000);
  const abandonadoDesde = new Date(ahora.getTime() - MINUTOS_PARA_RECLAMAR * 60_000);

  await db
    .update(colaWhatsapp)
    .set({ estado: "omitido", motivo: "Venció: llevaba más de 24 horas sin enviarse." })
    .where(and(inArray(colaWhatsapp.estado, ["pendiente", "procesando"]), lt(colaWhatsapp.creadoEn, vencidoDesde)));
  await db
    .update(colaWhatsapp)
    .set({ estado: "fallido", motivo: "Se cortó el envío y no quedaban intentos." })
    .where(and(eq(colaWhatsapp.estado, "procesando"), lt(colaWhatsapp.reclamadoEn, abandonadoDesde), sql`${colaWhatsapp.intentos} >= ${MAX_INTENTOS}`));

  const reclamables = db
    .select({ id: colaWhatsapp.id })
    .from(colaWhatsapp)
    .where(
      and(
        lt(colaWhatsapp.intentos, MAX_INTENTOS),
        or(eq(colaWhatsapp.estado, "pendiente"), and(eq(colaWhatsapp.estado, "procesando"), lt(colaWhatsapp.reclamadoEn, abandonadoDesde))),
      ),
    )
    .orderBy(asc(colaWhatsapp.creadoEn))
    .limit(opciones.limite ?? 20)
    .for("update", { skipLocked: true });

  const filas = await db
    .update(colaWhatsapp)
    .set({ estado: "procesando", reclamadoEn: ahora, intentos: sql`${colaWhatsapp.intentos} + 1` })
    .where(inArray(colaWhatsapp.id, reclamables))
    .returning();
  filas.sort((a, b) => a.creadoEn.getTime() - b.creadoEn.getTime());

  // Los consentimientos de las cuentas de estos avisos, en una sola consulta.
  const consentimientos = new Map<string, { bajaEn: Date | null; clave: string }>();
  const cuentas = [...new Set(filas.map((f) => f.usuarioId).filter((id): id is string => Boolean(id)))];
  if (cuentas.length > 0) {
    for (const c of await db
      .select({ usuarioId: consentimientosWhatsapp.usuarioId, bajaEn: consentimientosWhatsapp.bajaEn, clave: consentimientosWhatsapp.clave })
      .from(consentimientosWhatsapp)
      .where(inArray(consentimientosWhatsapp.usuarioId, cuentas))) {
      consentimientos.set(c.usuarioId, { bajaEn: c.bajaEn, clave: c.clave });
    }
  }

  for (const fila of filas) {
    const cerrar = (estado: "enviado" | "omitido" | "fallido", extra: Partial<AvisoDeWhatsappEnCola> = {}) =>
      db.update(colaWhatsapp).set({ estado, ...extra }).where(eq(colaWhatsapp.id, fila.id));

    let mensaje: MensajeDeWhatsapp;
    if (fila.tipo === "texto") {
      const texto = typeof fila.datos.texto === "string" ? fila.datos.texto : "";
      if (texto === "") {
        await cerrar("fallido", { motivo: "La respuesta no tiene texto." });
        resumen.fallidos += 1;
        continue;
      }
      mensaje = { tipo: "texto", para: fila.para, texto };
    } else {
      if (!esPlantillaDeWhatsapp(fila.plantilla)) {
        await cerrar("fallido", { motivo: `Plantilla desconocida: ${fila.plantilla}`.slice(0, 300) });
        resumen.fallidos += 1;
        continue;
      }
      if (!fila.usuarioId || !puedeRecibirAvisos(consentimientos.get(fila.usuarioId), fila.para)) {
        await cerrar("omitido", { motivo: fila.usuarioId ? "La persona retiró el consentimiento o cambió de número." : "La cuenta ya no existe." });
        resumen.omitidos += 1;
        continue;
      }
      const desde = new Date(Date.now() - 24 * 3_600_000);
      const [{ n }] = await db
        .select({ n: count() })
        .from(colaWhatsapp)
        .where(
          and(
            eq(colaWhatsapp.para, fila.para),
            eq(colaWhatsapp.tipo, "plantilla"),
            inArray(colaWhatsapp.estado, ["enviado", "entregado", "leido"]),
            gt(colaWhatsapp.enviadoEn, desde),
          ),
        );
      if (n >= TOPE_POR_NUMERO_POR_DIA) {
        await cerrar("omitido", { motivo: `Tope de ${TOPE_POR_NUMERO_POR_DIA} avisos por día a un mismo número.` });
        resumen.omitidos += 1;
        continue;
      }
      const datos = fila.datos as Partial<DatosDeAviso>;
      if (!Array.isArray(datos.variables) || typeof datos.ruta !== "string") {
        await cerrar("fallido", { motivo: "El aviso no tiene sus datos completos." });
        resumen.fallidos += 1;
        continue;
      }
      mensaje = { tipo: "plantilla", para: fila.para, plantilla: fila.plantilla, datos: { variables: datos.variables.map(String), ruta: datos.ruta } };
    }

    const resultado = await enviarWhatsapp(mensaje, modo);
    if (resultado.ok) {
      await cerrar("enviado", { enviadoEn: new Date(), wamid: resultado.id, motivo: null });
      resumen.enviados += 1;
    } else if (resultado.reintentable && fila.intentos < MAX_INTENTOS) {
      await db.update(colaWhatsapp).set({ estado: "pendiente", motivo: resultado.motivo }).where(eq(colaWhatsapp.id, fila.id));
      resumen.reintentos += 1;
      // Meta pide ir más despacio: se corta la tanda y sigue el próximo despacho.
      break;
    } else {
      await cerrar("fallido", { motivo: resultado.motivo });
      resumen.fallidos += 1;
      console.error("Falló un aviso de WhatsApp", { plantilla: fila.plantilla, motivo: resultado.motivo });
      // Un token vencido o inválido (190) frena todo: no tiene sentido seguir intentando con el resto.
      if (resultado.codigo === 190) break;
    }
  }
  return resumen;
}

/**
 * Anota los estados que manda Meta (enviado, entregado, leído, fallido) en los avisos que mandamos. Un estado nunca retrocede y uno de un mensaje que no
 * es nuestro (no está en la cola) se ignora. Devuelve cuántos avisos se tocaron.
 */
export async function registrarEstadosDeEntrega(estados: EstadoRecibido[]): Promise<number> {
  const db = getDb();
  let tocados = 0;
  for (const e of estados) {
    const [fila] = await db.select({ id: colaWhatsapp.id, estado: colaWhatsapp.estado }).from(colaWhatsapp).where(eq(colaWhatsapp.wamid, e.id)).limit(1);
    if (!fila) continue;
    const nuevo = estadoTrasAviso(fila.estado, e.estado);
    const motivo = e.estado === "fallido" && nuevo === "fallido" ? `Meta${e.error?.codigo ? ` (${e.error.codigo})` : ""}: ${e.error?.titulo ?? "no se pudo entregar"}`.slice(0, 300) : undefined;
    if (nuevo === fila.estado && motivo === undefined) continue;
    await db
      .update(colaWhatsapp)
      .set({ estado: nuevo, ...(motivo !== undefined ? { motivo } : {}) })
      .where(eq(colaWhatsapp.id, fila.id));
    tocados += 1;
  }
  return tocados;
}

/** Borra del historial lo cerrado hace más de 90 días (los avisos llevan un teléfono: no se guardan para siempre). */
export async function purgarColaWhatsapp() {
  const limite = new Date(Date.now() - DIAS_DE_HISTORIAL * 86_400_000);
  const borrados = await getDb()
    .delete(colaWhatsapp)
    .where(and(inArray(colaWhatsapp.estado, ["enviado", "entregado", "leido", "omitido", "fallido"]), lt(colaWhatsapp.creadoEn, limite)))
    .returning({ id: colaWhatsapp.id });
  return borrados.length;
}
