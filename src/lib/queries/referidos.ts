import "server-only";
import { and, count, desc, eq, isNull, sql, type AnyColumn } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { cookies } from "next/headers";
import { getDb, transaccion } from "@/db";
import { codigosReferido, facturas, instituciones, referidosInstituciones, suscripcionesMp } from "@/db/schema";
import type { TipoDeBeneficio } from "@/lib/bonificacion";
import { avisarAAdmins, avisarAVarios } from "@/lib/queries/avisos";
import { destinatariosDeInstitucion, type EjecutorBo } from "@/lib/queries/backoffice-instituciones";
import { resumenDeMesesPorReferido, type ResumenDeMesesDeReferido } from "@/lib/queries/bonificaciones";
import type { Ejecutor } from "@/lib/queries/pipeline";
import {
  codigoDeTexto,
  codigoParaElAlta,
  COOKIE_REFERIDO,
  ERROR_DE_CODIGO_DE_REFERIDO,
  ERROR_DE_DEMASIADOS_CODIGOS,
  estadoDeReferido,
  generarCodigo,
  normalizarCodigo,
  OPCIONES_DE_COOKIE_REFERIDO,
  sePuedeAnotar,
  type EstadoReferido,
} from "@/lib/referidos";
import { permitirProbarCodigoDeReferido } from "@/lib/pedidos";
import { datosDeSesion } from "@/lib/sesion";
import { resumenDeError } from "@/lib/errores";

/*
 * Referidos de instituciones (reglas y textos en src/lib/referidos.ts). El código de cada institución se crea la primera vez que
 * se lo pide; la recomendación se anota cuando la persona crea su cuenta de institución con el enlace (el navegador guarda el código
 * en una cookie mientras tanto); el equipo marca cuándo aplicó el beneficio.
 */

const azar = (n: number) => crypto.getRandomValues(new Uint32Array(1))[0]! % n;

/**
 * ¿La institución abonó su membresía? Es que tenga alguna factura paga (cobro automático o pago que cargó el equipo): lo que hace que
 * una recomendación cuente. Se pregunta siempre, no se guarda: un pago que se anula la devuelve al paso anterior.
 */
const tienePago = (institucionId: AnyColumn) =>
  sql<boolean>`exists (select 1 from ${facturas} where ${facturas.institucionId} = ${institucionId} and ${facturas.estado} = 'pagada')`;

/** Lo mismo para una institución puntual (lo usa la acción del equipo al aplicar el beneficio, dentro de su transacción). */
export async function institucionPago(ejecutor: Ejecutor, institucionId: string): Promise<boolean> {
  const [fila] = await ejecutor
    .select({ id: facturas.id })
    .from(facturas)
    .where(and(eq(facturas.institucionId, institucionId), eq(facturas.estado, "pagada")))
    .limit(1);
  return !!fila;
}

/** El código personal de una institución: el que ya tiene o, la primera vez, uno nuevo. */
export async function codigoDeInstitucion(institucionId: string): Promise<string> {
  const db = getDb();
  const buscar = async () => {
    const [fila] = await db.select({ codigo: codigosReferido.codigo }).from(codigosReferido).where(eq(codigosReferido.institucionId, institucionId)).limit(1);
    return fila?.codigo ?? null;
  };
  const existente = await buscar();
  if (existente) return existente;
  for (let intento = 0; intento < 5; intento++) {
    const [creado] = await db
      .insert(codigosReferido)
      .values({ institucionId, codigo: generarCodigo(azar) })
      .onConflictDoNothing()
      .returning({ codigo: codigosReferido.codigo });
    if (creado) return creado.codigo;
    // El conflicto fue porque otra visita ya le creó el código, o porque ese código ya lo tenía otra institución: se mira y se reintenta.
    const ahora = await buscar();
    if (ahora) return ahora;
  }
  throw new Error("No se pudo generar un código de referido.");
}

/** La institución dueña de un código, si sigue en pie (ni dada de baja ni suspendida). */
export async function institucionPorCodigo(codigo: string) {
  const [fila] = await getDb()
    .select({ id: instituciones.id, nombre: instituciones.nombre, propietarioId: instituciones.propietarioId, cuit: instituciones.cuit })
    .from(codigosReferido)
    .innerJoin(instituciones, eq(instituciones.id, codigosReferido.institucionId))
    .where(and(eq(codigosReferido.codigo, codigo), isNull(instituciones.bajaEn), eq(instituciones.suspendida, false)))
    .limit(1);
  return fila ?? null;
}

/** El código de referido que dejó el enlace `/referido/<código>` (o el registro) en este navegador, ya normalizado; null si no hay. */
export async function codigoDeLaCookie(): Promise<string | null> {
  return normalizarCodigo((await cookies()).get(COOKIE_REFERIDO)?.value) ?? null;
}

/**
 * El código que ya quedó anotado para esta persona: el de la cookie o, si confirmó el mail desde otro dispositivo y la cookie no está, el que quedó
 * en los datos de su cuenta (ya normalizado). null si no hay.
 */
async function codigoRecordado(): Promise<string | null> {
  const delNavegador = await codigoDeLaCookie();
  if (delNavegador) return delNavegador;
  return normalizarCodigo((await datosDeSesion().catch(() => null))?.referido) ?? null;
}

/**
 * ¿Ya hay un código de referido anotado (por el enlace de otra institución) que todavía sirve? Es lo que decide si el alta avisa «ya quedó
 * anotado». **El campo «Código de referido» nunca se rellena con él** (2026-10-28: una cookie vieja de una prueba lo dejaba completado en
 * cuentas nuevas): se avisa y listo. No dice a quién pertenece. false si ya no sirve (institución dada de baja o suspendida).
 */
export async function hayCodigoRecordado(): Promise<boolean> {
  const codigo = await codigoRecordado();
  if (!codigo) return false;
  return !!(await institucionPorCodigo(codigo).catch(() => null));
}

/** Lo que decide el alta sobre la recomendación: el código a anotar (null: ninguno) o el error para mostrar en el campo. */
export type ReferidoDelAlta = { ok: true; codigo: string | null } | { ok: false; error: string };

/**
 * ¿Existe este código escrito a mano (de una institución en pie)? El campo contesta que sí o que no, así que cada intento cuenta contra un tope
 * (`claveDeTope`: la cuenta en el alta, el origen del pedido en el registro). Un código mal escrito y uno que no existe (o de una institución dada de
 * baja o suspendida) dan el mismo error: no se dice cuál de los dos.
 */
async function comprobarCodigoEscrito(codigo: string, claveDeTope: string): Promise<ReferidoDelAlta> {
  if (!permitirProbarCodigoDeReferido(claveDeTope)) return { ok: false, error: ERROR_DE_DEMASIADOS_CODIGOS };
  try {
    return (await institucionPorCodigo(codigo)) ? { ok: true, codigo } : { ok: false, error: ERROR_DE_CODIGO_DE_REFERIDO };
  } catch (e) {
    console.error("No se pudo comprobar el código de referido", resumenDeError(e));
    return { ok: false, error: "No pudimos comprobar el código ahora. Probá de nuevo en un momento o dejá el campo vacío." };
  }
}

/**
 * El campo «Código de referido» del REGISTRO (paso 1): vacío no es un error (no hay recomendación); lo escrito tiene que ser un código que exista, y
 * si no vuelve como error del campo para corregirlo antes de crear la cuenta.
 */
export async function codigoDeRegistro(escrito: string, claveDeTope: string): Promise<ReferidoDelAlta> {
  if (!escrito.trim()) return { ok: true, codigo: null };
  const codigo = codigoDeTexto(escrito);
  if (!codigo) return { ok: false, error: ERROR_DE_CODIGO_DE_REFERIDO };
  return comprobarCodigoEscrito(codigo, claveDeTope);
}

/**
 * Deja el código del registro en el navegador, igual que el enlace `/referido/<código>`: la recomendación se anota al crear la institución. Sin
 * código (el campo quedó vacío) no toca lo que hubiera: un código que dejó un enlace sigue valiendo, porque el campo ya no viene rellenado y
 * vacío no quiere decir «no la quiero».
 */
export async function recordarCodigoDeReferido(codigo: string | null) {
  if (!codigo) return;
  (await cookies()).set(COOKIE_REFERIDO, codigo, OPCIONES_DE_COOKIE_REFERIDO);
}

/**
 * Qué recomendación lleva el alta que se está por crear (paso 2): el código que la persona escribió en el campo «Código de referido» o, con el
 * campo vacío, el que ya quedó anotado (el del enlace). Es lo mismo que el enlace: los dos terminan en `anotarReferidoDelAlta`. Se llama **antes**
 * de crear la institución: un código escrito que no existe vuelve como error del campo para que lo corrija (o lo deje vacío) y no se crea nada a
 * medias. El que ya venía anotado no frena el alta: si ya no sirve, simplemente no se anota.
 */
export async function referidoDelAlta(escrito: string | null, cuentaId: string): Promise<ReferidoDelAlta> {
  const decision = codigoParaElAlta(escrito, await codigoRecordado());
  if (decision.tipo === "ninguno") return { ok: true, codigo: null };
  if (decision.tipo === "invalido") return { ok: false, error: ERROR_DE_CODIGO_DE_REFERIDO };
  if (!decision.escrito) return { ok: true, codigo: decision.codigo };
  return comprobarCodigoEscrito(decision.codigo, cuentaId);
}

/**
 * Se llama cuando una cuenta acaba de crear su institución: si el alta traía el código de quien la recomendó (escrito a mano o del enlace;
 * ver `referidoDelAlta`), lo anota y le avisa a esa institución en la campanita. Nunca frena el alta: si algo falla (o las tablas todavía no
 * existen) solo queda en el log. Gasta la cookie del enlace en cualquier caso, para que no se anote una segunda institución creada desde el
 * mismo navegador.
 */
export async function anotarReferidoDelAlta(nueva: { id: string; nombre: string; propietarioId: string; cuit?: string | null }, codigo: string | null) {
  try {
    const jar = await cookies();
    if (jar.get(COOKIE_REFERIDO)) jar.delete(COOKIE_REFERIDO);
    if (!codigo) return;

    const referidor = await institucionPorCodigo(codigo);
    if (!referidor || !sePuedeAnotar(referidor, { id: nueva.id, propietarioId: nueva.propietarioId, cuit: nueva.cuit })) return;

    await transaccion(async (tx) => {
      const [fila] = await tx
        .insert(referidosInstituciones)
        .values({ referidorId: referidor.id, referidoId: nueva.id })
        .onConflictDoNothing()
        .returning({ id: referidosInstituciones.id });
      if (!fila) return;
      await avisarAVarios(tx, await destinatariosDeInstitucion(tx, referidor.id), {
        tipo: "sistema",
        titulo: nueva.nombre,
        texto: "se registró con tu código de referidos. Tu beneficio queda listo cuando el equipo la verifique y ella pague su primera factura.",
        enlace: "/institucion/referidos",
      });
    });
  } catch (e) {
    console.error("No se pudo anotar el referido", resumenDeError(e));
  }
}

/**
 * La institución recién verificada fue recomendada por otra: se le avisa que ya está verificada y que el beneficio se activa cuando pague.
 * Se llama después de verificar y nunca la frena (el paso del referido se calcula de la verificación, así que no depende de que este
 * aviso salga).
 */
export async function avisarReferidorDeVerificacion(institucionId: string) {
  try {
    const db = getDb();
    const [fila] = await db
      .select({ referidorId: referidosInstituciones.referidorId, nombre: instituciones.nombre })
      .from(referidosInstituciones)
      .innerJoin(instituciones, eq(instituciones.id, referidosInstituciones.referidoId))
      .where(and(eq(referidosInstituciones.referidoId, institucionId), isNull(referidosInstituciones.beneficioEn)))
      .limit(1);
    if (!fila) return;
    await avisarAVarios(db, await destinatariosDeInstitucion(db, fila.referidorId), {
      tipo: "sistema",
      titulo: fila.nombre,
      texto: "ya está verificada en UNIDOAR. Tu beneficio por recomendarla se activa cuando pague su primera factura.",
      enlace: "/institucion/referidos",
    });
  } catch (e) {
    console.error("No se pudo avisar la verificación de un referido", resumenDeError(e));
  }
}

/**
 * La institución recomendada acaba de pagar: si es su primera factura paga, se le avisa a la que la recomendó (y al equipo, que es quien
 * aplica el beneficio). Se llama después de confirmar el pago (cobro automático o pago que carga el equipo) y nunca lo frena: el paso del
 * referido se calcula de las facturas, así que no depende de que este aviso salga. Con una segunda factura paga no vuelve a avisar.
 */
export async function avisarReferidorDePago(institucionId: string) {
  try {
    const db = getDb();
    const referidora = alias(instituciones, "referidora");
    const [fila] = await db
      .select({ referidorId: referidora.id, referidorNombre: referidora.nombre, nombre: instituciones.nombre })
      .from(referidosInstituciones)
      .innerJoin(referidora, eq(referidora.id, referidosInstituciones.referidorId))
      .innerJoin(instituciones, eq(instituciones.id, referidosInstituciones.referidoId))
      .where(and(eq(referidosInstituciones.referidoId, institucionId), isNull(referidosInstituciones.beneficioEn)))
      .limit(1);
    if (!fila) return;
    const [{ pagas } = { pagas: 0 }] = await db
      .select({ pagas: count() })
      .from(facturas)
      .where(and(eq(facturas.institucionId, institucionId), eq(facturas.estado, "pagada")));
    if (pagas !== 1) return;
    await avisarAVarios(db, await destinatariosDeInstitucion(db, fila.referidorId), {
      tipo: "sistema",
      titulo: fila.nombre,
      texto: "ya pagó su membresía: tu beneficio por recomendarla está listo para aplicarse.",
      enlace: "/institucion/referidos",
    });
    await avisarAAdmins(db, {
      titulo: "Referido para aplicar",
      texto: `${fila.referidorNombre} recomendó a ${fila.nombre} y ya pagó su primera factura: hay un beneficio para aplicar.`,
      enlace: "/backoffice/referidos",
    });
  } catch (e) {
    console.error("No se pudo avisar el pago de un referido", resumenDeError(e));
  }
}

/** Cómo se aplicó un beneficio ya aplicado: lo guardado, y «pack» si es de antes de que existiera la opción. */
const tipoAplicado = (beneficioEn: Date | null, tipo: string | null): TipoDeBeneficio | null =>
  beneficioEn ? (tipo === "meses" ? "meses" : "pack") : null;

export type ReferidoDeInstitucion = {
  id: string;
  institucion: { nombre: string; slug: string };
  estado: EstadoReferido;
  creadoEn: Date;
  beneficioEn: Date | null;
  /** Cómo se aplicó el beneficio (null si todavía no). */
  beneficioTipo: TipoDeBeneficio | null;
  /** Si se aplicó como meses bonificados: cuántos generó y cuántos ya se gastaron. */
  meses: ResumenDeMesesDeReferido | null;
};

/** Las instituciones que recomendó una institución, de la más nueva a la más vieja. */
export async function referidosDe(institucionId: string, ejecutor: EjecutorBo = getDb()): Promise<ReferidoDeInstitucion[]> {
  const filas = await ejecutor
    .select({
      id: referidosInstituciones.id,
      nombre: instituciones.nombre,
      slug: instituciones.slug,
      verificada: instituciones.verificada,
      pagada: tienePago(instituciones.id),
      creadoEn: referidosInstituciones.creadoEn,
      beneficioEn: referidosInstituciones.beneficioEn,
      beneficioTipo: referidosInstituciones.beneficioTipo,
    })
    .from(referidosInstituciones)
    .innerJoin(instituciones, eq(instituciones.id, referidosInstituciones.referidoId))
    .where(eq(referidosInstituciones.referidorId, institucionId))
    .orderBy(desc(referidosInstituciones.creadoEn));
  const meses = await resumenDeMesesPorReferido(ejecutor, filas.map((f) => f.id));
  return filas.map((f) => {
    const tipo = tipoAplicado(f.beneficioEn, f.beneficioTipo);
    return {
      id: f.id,
      institucion: { nombre: f.nombre, slug: f.slug },
      estado: estadoDeReferido(f),
      creadoEn: f.creadoEn,
      beneficioEn: f.beneficioEn,
      beneficioTipo: tipo,
      meses: tipo === "meses" ? (meses.get(f.id) ?? { total: 0, usados: 0 }) : null,
    };
  });
}

export type ReferidoBackoffice = {
  id: string;
  estado: EstadoReferido;
  creadoEn: Date;
  beneficioEn: Date | null;
  beneficioTipo: TipoDeBeneficio | null;
  meses: ResumenDeMesesDeReferido | null;
  /** `plan` y `conDebito` ayudan a elegir cómo aplicarle el beneficio: con un débito autorizado, cada mes bonificado hay que devolverlo a mano. */
  referidor: { id: string; nombre: string; plan: string; conDebito: boolean };
  referido: { id: string; nombre: string; verificada: boolean; pagada: boolean };
};

/** Todas las recomendaciones, de la más nueva a la más vieja (el equipo las ve y aplica los beneficios). */
export async function listarReferidosBackoffice(ejecutor: EjecutorBo = getDb()): Promise<ReferidoBackoffice[]> {
  const referidora = alias(instituciones, "referidora");
  const filas = await ejecutor
    .select({
      id: referidosInstituciones.id,
      creadoEn: referidosInstituciones.creadoEn,
      beneficioEn: referidosInstituciones.beneficioEn,
      beneficioTipo: referidosInstituciones.beneficioTipo,
      referidorId: referidora.id,
      referidorNombre: referidora.nombre,
      referidorPlan: referidora.plan,
      referidorConDebito: sql<boolean>`exists (select 1 from ${suscripcionesMp} where ${suscripcionesMp.institucionId} = ${referidora.id} and ${suscripcionesMp.estado} = 'autorizada')`,
      referidoId: instituciones.id,
      referidoNombre: instituciones.nombre,
      referidoVerificada: instituciones.verificada,
      referidoPagada: tienePago(instituciones.id),
    })
    .from(referidosInstituciones)
    .innerJoin(referidora, eq(referidora.id, referidosInstituciones.referidorId))
    .innerJoin(instituciones, eq(instituciones.id, referidosInstituciones.referidoId))
    .orderBy(desc(referidosInstituciones.creadoEn));
  const meses = await resumenDeMesesPorReferido(ejecutor, filas.map((f) => f.id));
  return filas.map((f) => {
    const tipo = tipoAplicado(f.beneficioEn, f.beneficioTipo);
    return {
      id: f.id,
      estado: estadoDeReferido({ verificada: f.referidoVerificada, pagada: f.referidoPagada, beneficioEn: f.beneficioEn }),
      creadoEn: f.creadoEn,
      beneficioEn: f.beneficioEn,
      beneficioTipo: tipo,
      meses: tipo === "meses" ? (meses.get(f.id) ?? { total: 0, usados: 0 }) : null,
      referidor: { id: f.referidorId, nombre: f.referidorNombre, plan: f.referidorPlan, conDebito: f.referidorConDebito },
      referido: { id: f.referidoId, nombre: f.referidoNombre, verificada: f.referidoVerificada, pagada: f.referidoPagada },
    };
  });
}
