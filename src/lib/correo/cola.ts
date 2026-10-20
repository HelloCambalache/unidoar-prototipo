import "server-only";
import { and, asc, count, eq, gt, inArray, lt, or, sql } from "drizzle-orm";
import { after } from "next/server";
import { getDb } from "@/db";
import { colaCorreos, docentes, usuarios, type CorreoEnCola } from "@/db/schema";
import type { Ejecutor } from "@/lib/queries/pipeline";
import { rutaDeBaja, rutaDeBajaConUnClic } from "./baja";
import { destinatariosDelEquipo, modoCorreo, origenDeLosMails, remitenteDe } from "./config";
import { enviarMensaje } from "./enviar";
import { PLANTILLAS, armarMail, esGrupoOpcional, esPlantilla, urlInterna, type DatosDe, type PlantillaId } from "./plantillas";
import { resumenDeError } from "@/lib/errores";

/*
 * Cola de mails ("outbox"). El flujo es siempre el mismo:
 *   1. La acción que origina el mail llama a `encolar…` DENTRO de su transacción: si se deshace, no sale nada.
 *   2. `encolar…` también deja pedido el despacho con `after()`, que corre cuando ya terminó la respuesta de la acción,
 *      es decir con la transacción confirmada (si se deshizo, no hay nada para mandar). Por eso las acciones no llaman a
 *      `despacharCola()` a mano.
 *   3. Si algo falla o la instancia se corta, queda pendiente y lo retoma el próximo despacho o el cron diario
 *      (/api/cron/correos). Lo que lleva más de 48 horas sin salir se descarta: un aviso viejo ya no sirve.
 * Con el envío apagado (`modoCorreo() === "apagado"`) no se anota nada, para no juntar una cola que nadie despacha.
 */

const MAX_INTENTOS = 5;
/** Un mail "procesando" hace más de esto es de una instancia que se cortó: se reclama de nuevo. */
const MINUTOS_PARA_RECLAMAR = 10;
/** Pasado este tiempo desde que se anotó, un mail pendiente ya no se manda. */
const HORAS_DE_VIGENCIA = 48;
/** Resend permite 2 pedidos por segundo: un poco de aire entre mail y mail evita los 429. */
const ESPERA_ENTRE_ENVIOS_MS = 600;
const DIAS_DE_HISTORIAL = 90;

export type Encolable<P extends PlantillaId> = {
  plantilla: P;
  datos: DatosDe[P];
  para: string;
  /** La cuenta destinataria, si la tiene (hace falta para respetar sus preferencias y los topes por persona). */
  usuarioId?: string | null;
  /** Dos mails con la misma clave para el mismo destinatario no se anotan dos veces. */
  clave?: string;
  /** A qué tope cuenta este mail (ver `tope` de la plantilla). Por defecto, el id de la plantilla. */
  topeClave?: string;
};

function filaDe<P extends PlantillaId>(c: Encolable<P>): typeof colaCorreos.$inferInsert {
  const def = PLANTILLAS[c.plantilla];
  return {
    para: c.para.trim().toLowerCase(),
    usuarioId: c.usuarioId ?? null,
    plantilla: c.plantilla,
    grupo: def.grupo,
    datos: c.datos as Record<string, unknown>,
    clave: c.clave ?? null,
    topeClave: def.tope ? (c.topeClave ?? c.plantilla) : null,
  };
}

/** Anota un mail para un destinatario cuyo email ya se conoce (por ejemplo, una persona invitada que todavía no tiene cuenta). */
export async function encolarCorreo<P extends PlantillaId>(ejecutor: Ejecutor, correo: Encolable<P>) {
  if (modoCorreo() === "apagado") return;
  await ejecutor.insert(colaCorreos).values(filaDe(correo)).onConflictDoNothing();
  despacharCola();
}

/** El mismo mail para varias cuentas. El email de cada una se lee de `usuarios`. `clave` y `topeClave` pueden depender de la cuenta. */
export async function encolarParaUsuarios<P extends PlantillaId>(
  ejecutor: Ejecutor,
  usuarioIds: string[],
  plantilla: P,
  datos: DatosDe[P],
  opciones: { clave?: (usuarioId: string) => string; topeClave?: (usuarioId: string) => string } = {},
) {
  if (modoCorreo() === "apagado") return;
  const ids = [...new Set(usuarioIds.filter(Boolean))];
  if (ids.length === 0) return;
  let cuentas = await ejecutor.select({ id: usuarios.id, email: usuarios.email }).from(usuarios).where(inArray(usuarios.id, ids));
  // Los avisos de contratación (invitaciones, preselección, entrevistas, ofertas) no salen hacia un profesional suspendido: no puede
  // entrar y el enlace terminaría en "cuenta suspendida". Los de la cuenta (como el aviso de la propia suspensión) sí.
  if (esGrupoOpcional(PLANTILLAS[plantilla].grupo)) {
    const suspendidos = await ejecutor
      .select({ usuarioId: docentes.usuarioId })
      .from(docentes)
      .where(and(inArray(docentes.usuarioId, ids), eq(docentes.suspendido, true)));
    const fuera = new Set(suspendidos.map((s) => s.usuarioId));
    cuentas = cuentas.filter((c) => !fuera.has(c.id));
  }
  if (cuentas.length === 0) return;
  await ejecutor
    .insert(colaCorreos)
    .values(
      cuentas.map((c) =>
        filaDe({ plantilla, datos, para: c.email, usuarioId: c.id, clave: opciones.clave?.(c.id), topeClave: opciones.topeClave?.(c.id) }),
      ),
    )
    .onConflictDoNothing();
  despacharCola();
}

/** Un mail interno para el equipo de UNIDOAR: los emails de CORREO_EQUIPO o, si no están, los de las cuentas admin. */
export async function encolarParaEquipo<P extends PlantillaId>(ejecutor: Ejecutor, plantilla: P, datos: DatosDe[P], opciones: { clave?: string } = {}) {
  if (modoCorreo() === "apagado") return;
  const fijos = destinatariosDelEquipo();
  if (fijos.length > 0) {
    await ejecutor.insert(colaCorreos).values(fijos.map((para) => filaDe({ plantilla, datos, para, clave: opciones.clave }))).onConflictDoNothing();
    despacharCola();
    return;
  }
  const admins = await ejecutor.select({ id: usuarios.id, email: usuarios.email }).from(usuarios).where(eq(usuarios.rol, "admin"));
  if (admins.length === 0) return;
  await ejecutor
    .insert(colaCorreos)
    .values(admins.map((a) => filaDe({ plantilla, datos, para: a.email, usuarioId: a.id, clave: opciones.clave })))
    .onConflictDoNothing();
  despacharCola();
}

/** Pide mandar lo pendiente cuando termine la respuesta actual (lo hacen solos los `encolar…`). Varios pedidos en una misma respuesta no se pisan. */
export function despacharCola() {
  if (modoCorreo() === "apagado") return;
  try {
    after(async () => {
      try {
        await vaciarCola({ limite: 15 });
      } catch (e) {
        console.error("No se pudo despachar la cola de mails", resumenDeError(e));
      }
    });
  } catch {
    // Fuera de un pedido (scripts, pruebas): lo despacha el cron.
  }
}

/* ───────────────────────────── Despacho ───────────────────────────── */

export type ResumenDeCola = { enviados: number; omitidos: number; fallidos: number; reintentos: number };

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Manda hasta `limite` mails pendientes, de a uno (así los topes por día se cuentan bien y no se pasa el límite de
 * pedidos de Resend). Dos despachos a la vez no se pisan: cada mail se reclama con `FOR UPDATE SKIP LOCKED`.
 */
export async function vaciarCola(opciones: { limite?: number } = {}): Promise<ResumenDeCola> {
  const modo = modoCorreo();
  const resumen: ResumenDeCola = { enviados: 0, omitidos: 0, fallidos: 0, reintentos: 0 };
  if (modo === "apagado") return resumen;

  const db = getDb();
  const ahora = new Date();
  const vencidoDesde = new Date(ahora.getTime() - HORAS_DE_VIGENCIA * 3_600_000);
  const abandonadoDesde = new Date(ahora.getTime() - MINUTOS_PARA_RECLAMAR * 60_000);

  // Lo que ya no sirve (muy viejo) y lo que quedó colgado sin intentos por gastar.
  await db
    .update(colaCorreos)
    .set({ estado: "omitido", motivo: "Venció: llevaba más de 48 horas sin enviarse." })
    .where(and(inArray(colaCorreos.estado, ["pendiente", "procesando"]), lt(colaCorreos.creadoEn, vencidoDesde)));
  await db
    .update(colaCorreos)
    .set({ estado: "fallido", motivo: "Se cortó el envío y no quedaban intentos." })
    .where(and(eq(colaCorreos.estado, "procesando"), lt(colaCorreos.reclamadoEn, abandonadoDesde), sql`${colaCorreos.intentos} >= ${MAX_INTENTOS}`));

  const reclamables = db
    .select({ id: colaCorreos.id })
    .from(colaCorreos)
    .where(
      and(
        lt(colaCorreos.intentos, MAX_INTENTOS),
        or(eq(colaCorreos.estado, "pendiente"), and(eq(colaCorreos.estado, "procesando"), lt(colaCorreos.reclamadoEn, abandonadoDesde))),
      ),
    )
    .orderBy(asc(colaCorreos.creadoEn))
    .limit(opciones.limite ?? 15)
    .for("update", { skipLocked: true });

  const filas = await db
    .update(colaCorreos)
    .set({ estado: "procesando", reclamadoEn: ahora, intentos: sql`${colaCorreos.intentos} + 1` })
    .where(inArray(colaCorreos.id, reclamables))
    .returning();
  filas.sort((a, b) => a.creadoEn.getTime() - b.creadoEn.getTime());

  // Preferencias de las cuentas de los mails opcionales, en una sola consulta.
  const idsOpcionales = filas.filter((f) => esPlantilla(f.plantilla) && esGrupoOpcional(PLANTILLAS[f.plantilla].grupo) && f.usuarioId).map((f) => f.usuarioId!);
  const prefs = new Map<string, boolean>();
  if (idsOpcionales.length > 0) {
    for (const u of await db.select({ id: usuarios.id, avisos: usuarios.avisosPorCorreo }).from(usuarios).where(inArray(usuarios.id, [...new Set(idsOpcionales)]))) {
      prefs.set(u.id, u.avisos);
    }
  }

  let enviadosEnLaTanda = 0;
  for (const fila of filas) {
    const cerrar = (estado: "enviado" | "omitido" | "fallido", extra: Partial<CorreoEnCola> = {}) =>
      db.update(colaCorreos).set({ estado, ...extra }).where(eq(colaCorreos.id, fila.id));

    if (!esPlantilla(fila.plantilla)) {
      await cerrar("fallido", { motivo: `Plantilla desconocida: ${fila.plantilla}`.slice(0, 300) });
      resumen.fallidos += 1;
      continue;
    }
    const def = PLANTILLAS[fila.plantilla] as (typeof PLANTILLAS)[PlantillaId];
    const opcional = esGrupoOpcional(def.grupo);

    if (opcional && (!fila.usuarioId || prefs.get(fila.usuarioId) !== true)) {
      await cerrar("omitido", { motivo: fila.usuarioId ? "La persona apagó los avisos por mail." : "La cuenta ya no existe." });
      resumen.omitidos += 1;
      continue;
    }

    if (def.tope && fila.topeClave) {
      const desde = new Date(Date.now() - def.tope.horas * 3_600_000);
      const [{ n }] = await db
        .select({ n: count() })
        .from(colaCorreos)
        .where(and(eq(colaCorreos.topeClave, fila.topeClave), eq(colaCorreos.estado, "enviado"), gt(colaCorreos.enviadoEn, desde)));
      if (n >= def.tope.max) {
        await cerrar("omitido", { motivo: `Tope de ${def.tope.max} mails cada ${def.tope.horas} h.` });
        resumen.omitidos += 1;
        continue;
      }
    }

    let armado;
    try {
      const origen = origenDeLosMails();
      armado = armarMail(fila.plantilla, fila.datos as never, {
        origen,
        rutaDeBaja: opcional && fila.usuarioId ? rutaDeBaja(fila.usuarioId) : null,
      });
    } catch (e) {
      await cerrar("fallido", { motivo: `No se pudo armar el mail: ${e instanceof Error ? e.message : "error"}`.slice(0, 300) });
      resumen.fallidos += 1;
      continue;
    }

    const remitente = remitenteDe(def.remitente);
    const rutaDirecta = opcional && fila.usuarioId ? rutaDeBajaConUnClic(fila.usuarioId) : null;
    const resultado = await (async () => {
      if (modo === "resend" && enviadosEnLaTanda > 0) await esperar(ESPERA_ENTRE_ENVIOS_MS);
      enviadosEnLaTanda += 1;
      return enviarMensaje(
        {
          de: remitente.de,
          para: fila.para,
          asunto: armado.asunto,
          html: armado.html,
          texto: armado.texto,
          responderA: (def.responderA as ((d: unknown) => string | undefined) | undefined)?.(fila.datos) ?? remitente.responderA,
          cabeceras: rutaDirecta
            ? {
                "List-Unsubscribe": `<${urlInterna(origenDeLosMails(), rutaDirecta)}>`,
                "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
              }
            : undefined,
          claveDeIdempotencia: fila.id,
        },
        modo,
      );
    })();

    if (resultado.ok) {
      await cerrar("enviado", { enviadoEn: new Date(), resendId: resultado.id, motivo: null });
      resumen.enviados += 1;
    } else if (resultado.reintentable && fila.intentos < MAX_INTENTOS) {
      await db.update(colaCorreos).set({ estado: "pendiente", motivo: resultado.motivo }).where(eq(colaCorreos.id, fila.id));
      resumen.reintentos += 1;
      // Si Resend pide ir más despacio, se corta la tanda: sigue el próximo despacho.
      if (resultado.motivo.startsWith("Resend 429")) break;
    } else {
      await cerrar("fallido", { motivo: resultado.motivo });
      resumen.fallidos += 1;
      console.error("Falló un mail", { plantilla: fila.plantilla, motivo: resultado.motivo });
    }
  }
  return resumen;
}

/** Borra del historial lo cerrado hace más de 90 días (los mails llevan nombres y motivos: no se guardan para siempre). */
export async function purgarCola() {
  const limite = new Date(Date.now() - DIAS_DE_HISTORIAL * 86_400_000);
  const borrados = await getDb()
    .delete(colaCorreos)
    .where(and(inArray(colaCorreos.estado, ["enviado", "omitido", "fallido"]), lt(colaCorreos.creadoEn, limite)))
    .returning({ id: colaCorreos.id });
  return borrados.length;
}
