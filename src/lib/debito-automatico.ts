/*
 * Débito automático mensual con Mercado Pago (suscripciones / "preapproval"). Reglas puras (sin base, sin red, sin el SDK): cómo se arma
 * la suscripción, cómo se traduce lo que informa Mercado Pago y a qué factura cae cada cobro. El detalle de la integración está en
 * CLAUDE.md ("Mercado Pago") y la guía de puesta en marcha en docs/mercadopago.md.
 */
import { hoyAR } from "@/lib/cobros";

export const MONEDA = "ARS";

/** Planes que se cobran con débito automático: los mensuales. El Anual es un pago por adelantado y queda manual. */
export const esPlanDebitable = (clave: string) => clave !== "anual";

/** En qué está la suscripción de una institución. Lo informa Mercado Pago; acá solo se espeja. */
export type EstadoSuscripcion = "pendiente" | "autorizada" | "pausada" | "cancelada";

/** Estado de Mercado Pago → el nuestro. Un valor que no conocemos devuelve null: no se pisa lo que ya teníamos. */
export function estadoDeSuscripcion(estadoMp: string | null | undefined): EstadoSuscripcion | null {
  switch (estadoMp) {
    case "pending":
      return "pendiente";
    case "authorized":
      return "autorizada";
    case "paused":
      return "pausada";
    case "cancelled":
    case "canceled":
      return "cancelada";
    default:
      return null;
  }
}

/** Mientras exista (pendiente, activa o en pausa) no se crea otra: una institución tiene una sola suscripción. */
export const suscripcionVigente = (estado: string | null | undefined) =>
  estado === "pendiente" || estado === "autorizada" || estado === "pausada";

/** Una suscripción cobra solo con un monto entero y positivo. */
export const montoCobrable = (monto: unknown): monto is number => typeof monto === "number" && Number.isInteger(monto) && monto > 0;

export type DecisionDeSincronizacion = { accion: "nada" } | { accion: "cambiar-monto"; monto: number } | { accion: "cancelar" };

/**
 * Qué hacer con una suscripción ya creada cuando el plan, las sedes o el precio pueden haber cambiado (lo revisa el cron diario). `esperado`
 * es lo que hoy cobraría el plan (plan × sedes). Si el plan ya no se debita (pasó al Anual) se cancela; si el monto cambió, se actualiza;
 * si no se pudo calcular un monto válido, no se toca nada (mejor cobrar el de antes que uno raro).
 */
export function decidirSincronizacion(s: { plan: string; monto: number; esperado: number | null }): DecisionDeSincronizacion {
  if (!esPlanDebitable(s.plan)) return { accion: "cancelar" };
  if (!montoCobrable(s.esperado)) return { accion: "nada" };
  if (s.esperado === s.monto) return { accion: "nada" };
  return { accion: "cambiar-monto", monto: s.esperado };
}

/** Mercado Pago pide un motivo corto: lo ve quien autoriza el débito. */
export function motivoDeSuscripcion(planLabel: string, institucion: string) {
  return `UNIDOAR · ${planLabel} · ${institucion}`.replace(/\s+/g, " ").trim().slice(0, 100);
}

export type DatosDeSuscripcion = {
  institucionId: string;
  institucion: string;
  planLabel: string;
  /** Pesos enteros por mes (ya multiplicado por las sedes si el plan es por sede). */
  monto: number;
  /** Con qué mail paga la persona en Mercado Pago. */
  email: string;
  /** A dónde vuelve después de autorizar (siempre una dirección nuestra, con https). */
  volverA: string;
};

/**
 * El cuerpo de `POST /preapproval`. `status: "pending"`: la suscripción queda esperando que la persona cargue su tarjeta en Mercado
 * Pago (nosotros nunca vemos datos de tarjeta); al autorizar, el primer cobro sale enseguida y los siguientes cada mes. El
 * `external_reference` es la institución: así un aviso de Mercado Pago se puede ligar a quien corresponde aunque falte la fila nuestra.
 */
export function cuerpoDeSuscripcion(d: DatosDeSuscripcion) {
  return {
    reason: motivoDeSuscripcion(d.planLabel, d.institucion),
    external_reference: d.institucionId,
    payer_email: d.email,
    back_url: d.volverA,
    status: "pending",
    auto_recurring: { frequency: 1, frequency_type: "months", transaction_amount: d.monto, currency_id: MONEDA },
  };
}

/** El cuerpo de `PUT /preapproval/{id}` que solo cambia el monto mensual. */
export const cuerpoDeNuevoMonto = (monto: number) => ({ auto_recurring: { transaction_amount: monto, currency_id: MONEDA } });

/** La dirección a la que mandamos a la persona tiene que ser de Mercado Pago (https): nunca seguimos un enlace ajeno. */
export function esUrlDeMercadoPago(url: unknown): url is string {
  if (typeof url !== "string") return false;
  try {
    const u = new URL(url);
    return u.protocol === "https:" && (u.hostname === "mercadopago.com" || u.hostname.endsWith(".mercadopago.com") || u.hostname === "mercadopago.com.ar" || u.hostname.endsWith(".mercadopago.com.ar"));
  } catch {
    return false;
  }
}

/**
 * Lo que contó Mercado Pago de un rechazo (su mensaje y los códigos de causa), para anotarlo en el log: sin eso un 400 no dice si el
 * problema es el mail, el monto, la dirección de vuelta o las credenciales. Es lo que **respondió** Mercado Pago, nunca el pedido (que
 * lleva el token); igual se tapan los mails (podrían repetir el que escribió la persona) y se acota el largo.
 */
export function detalleDeRechazo(entrada: { message?: unknown; error?: unknown; causes?: unknown }): string {
  const partes: string[] = [];
  const texto = (v: unknown) => (typeof v === "string" || typeof v === "number" ? String(v).trim() : "");
  for (const v of [entrada.message, entrada.error]) {
    const t = texto(v);
    if (t && !partes.includes(t)) partes.push(t);
  }
  if (Array.isArray(entrada.causes)) {
    for (const c of entrada.causes.slice(0, 5)) {
      if (!c || typeof c !== "object") continue;
      const { code, description } = c as { code?: unknown; description?: unknown };
      const t = [texto(code), texto(description)].filter(Boolean).join(": ");
      if (t) partes.push(t);
    }
  }
  return partes.join(" | ").replace(/[^\s@|]+@[^\s@|]+/g, "[mail]").slice(0, 400);
}

/** Un mail con forma de mail (lo valida además Mercado Pago). */
export const esEmailDePago = (email: unknown): email is string =>
  typeof email === "string" && email.length <= 120 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

/* ───────────────────────────── Cobros ───────────────────────────── */

/** Lo que nos interesa de un cobro de la suscripción (`GET /authorized_payments/{id}`). */
export type CobroDeMercadoPago = {
  // Mercado Pago manda los números de cobro y de suscripción a veces como número y a veces como texto: se aceptan los dos.
  id?: string | number;
  preapproval_id?: string | number;
  status?: string;
  debit_date?: string;
  transaction_amount?: number;
  retry_attempt?: number;
  payment?: { id?: string | number; status?: string; status_detail?: string };
};

export type ResultadoDeCobro = "aprobado" | "rechazado" | "pendiente" | "cancelado";

export type CobroLeido = {
  id: string;
  suscripcionId: string;
  resultado: ResultadoDeCobro;
  /** "2026-10": el mes que cubre, según el día del débito en Argentina. Null si Mercado Pago no informó la fecha. */
  periodo: string | null;
  /** El día del débito en Argentina ("2026-10-20"). */
  debitoEn: string | null;
  monto: number | null;
  pagoId: string | null;
  detalle: string | null;
  intento: number;
};

/**
 * Traduce un cobro de Mercado Pago. Solo "aprobado" mueve plata: `payment.status === "approved"`. Un rechazo puede reintentarse
 * (Mercado Pago lo vuelve a intentar solo), así que "rechazado" no cierra nada. Devuelve null si falta lo mínimo para ligarlo.
 */
export function leerCobro(cobro: CobroDeMercadoPago | null | undefined): CobroLeido | null {
  const id = cobro?.id != null ? String(cobro.id) : "";
  const suscripcionId = cobro?.preapproval_id != null ? String(cobro.preapproval_id) : "";
  if (!cobro || !id || !suscripcionId) return null;

  const estadoDelPago = cobro.payment?.status;
  let resultado: ResultadoDeCobro = "pendiente";
  if (estadoDelPago === "approved") resultado = "aprobado";
  else if (estadoDelPago === "rejected" || estadoDelPago === "cancelled" || estadoDelPago === "charged_back") resultado = "rechazado";
  else if (cobro.status === "cancelled" || cobro.status === "canceled") resultado = "cancelado";

  const fecha = cobro.debit_date ? new Date(cobro.debit_date) : null;
  const debitoEn = fecha && !Number.isNaN(fecha.getTime()) ? hoyAR(fecha) : null;
  const monto = montoCobrable(cobro.transaction_amount) ? cobro.transaction_amount : null;

  return {
    id,
    suscripcionId,
    resultado,
    periodo: debitoEn ? debitoEn.slice(0, 7) : null,
    debitoEn,
    monto,
    pagoId: cobro.payment?.id != null ? String(cobro.payment.id) : null,
    detalle: cobro.payment?.status_detail ? String(cobro.payment.status_detail).slice(0, 120) : null,
    intento: Number.isInteger(cobro.retry_attempt) && (cobro.retry_attempt as number) >= 0 ? (cobro.retry_attempt as number) : 0,
  };
}

/** Qué hacer con la factura del mes cuando entra un cobro aprobado. */
export type AccionSobreLaFactura = "marcar-paga" | "crear-paga" | "ya-estaba-paga";

export function accionSobreLaFactura(factura: { estado: string } | null | undefined): AccionSobreLaFactura {
  if (!factura) return "crear-paga";
  return factura.estado === "pagada" ? "ya-estaba-paga" : "marcar-paga";
}

/** El texto corto de cada estado para la pantalla de la institución. */
export const ETIQUETA_SUSCRIPCION: Record<EstadoSuscripcion, string> = {
  pendiente: "Falta autorizarlo en Mercado Pago",
  autorizada: "Activo",
  pausada: "En pausa",
  cancelada: "Cancelado",
};
