/*
 * Débito automático mensual con Mercado Pago (suscripciones / "preapproval"). Reglas puras (sin base, sin red, sin el SDK): cómo se arma
 * la suscripción, cómo se traduce lo que informa Mercado Pago y a qué factura cae cada cobro. El detalle de la integración está en
 * CLAUDE.md ("Mercado Pago") y la guía de puesta en marcha en docs/mercadopago.md.
 */
import { fechaCobroDelPeriodo, hoyAR, sumarMeses } from "@/lib/cobros";

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

/**
 * Los cuatro estados tal como los GUARDAMOS en `suscripciones_mp.estado`. No confundir con `estadoDeSuscripcion`, que traduce los que
 * informa Mercado Pago ("authorized"): pasarle un estado guardado ("autorizada") devuelve null. Un valor desconocido devuelve null.
 */
export function estadoGuardado(valor: string | null | undefined): EstadoSuscripcion | null {
  return valor === "pendiente" || valor === "autorizada" || valor === "pausada" || valor === "cancelada" ? valor : null;
}

/** Mientras exista (pendiente, activa o en pausa) no se crea otra: una institución tiene una sola suscripción. */
export const suscripcionVigente = (estado: string | null | undefined) =>
  estado === "pendiente" || estado === "autorizada" || estado === "pausada";

/**
 * El día del mes en que Mercado Pago le va a cobrar a la institución: el día en que se suscribió (el primer cobro sale al suscribirse y los
 * demás el mismo día de cada mes). Se toma de la fecha de alta y, si falta, del próximo cobro; siempre en hora de Argentina. Devuelve null si
 * no hay ninguna fecha válida. Sirve para que la factura de cada mes venza el día en que el débito va a cobrar y no se vea "vencida" antes.
 */
export function diaDeCobroDelDebito(entrada: { creada: string | null | undefined; proximoCobro: string | null | undefined }): number | null {
  for (const iso of [entrada.creada, entrada.proximoCobro]) {
    if (!iso) continue;
    const fecha = new Date(iso);
    if (Number.isNaN(fecha.getTime())) continue;
    return Number(hoyAR(fecha).slice(8, 10));
  }
  return null;
}

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

export type DatosDePlan = {
  institucion: string;
  planLabel: string;
  /** Pesos enteros por mes (ya multiplicado por las sedes si el plan es por sede). */
  monto: number;
  /** A dónde vuelve después de suscribirse (siempre una dirección nuestra, con https, sin parámetros propios). */
  volverA: string;
  /** Días sin cobro antes del primer cobro (ver `primerCobroDiferido`). 0 o ausente: el primer cobro sale al suscribirse. */
  diasDePrueba?: number;
};

/**
 * El cuerpo de `POST /preapproval_plan`: la suscripción mensual de ESTA institución, con su monto. No lleva el mail de quien paga: la
 * persona entra al `init_point` del plan, inicia sesión en Mercado Pago con la cuenta que tenga y carga su tarjeta ahí (nosotros nunca
 * vemos datos de tarjeta). Mercado Pago crea la suscripción con esa cuenta, así que no hay un mail ni un país que puedan no coincidir (con
 * `payer_email` Mercado Pago exige entrar con ese mail exacto). Como el `external_reference` se pierde en este camino, la institución se
 * reconoce por el plan: hay un plan por institución y una tabla que los relaciona (`planes_mp`).
 */
export function cuerpoDePlan(d: DatosDePlan) {
  const dias = Number.isInteger(d.diasDePrueba) && (d.diasDePrueba as number) > 0 ? (d.diasDePrueba as number) : 0;
  return {
    reason: motivoDeSuscripcion(d.planLabel, d.institucion),
    back_url: d.volverA,
    auto_recurring: {
      frequency: 1,
      frequency_type: "months",
      transaction_amount: d.monto,
      currency_id: MONEDA,
      // Con `free_trial` Mercado Pago no cobra al suscribirse y el primer cobro sale al terminar la prueba.
      ...(dias > 0 ? { free_trial: { frequency: dias, frequency_type: "days" } } : {}),
    },
  };
}

/**
 * ¿Sirve el plan que ya creamos para esta institución? Solo si sigue siendo el mismo plan, el mismo monto y los mismos días de prueba: el
 * monto y la prueba van dentro del plan, así que si el precio, las sedes, el plan o los días hasta el próximo cobro cambiaron hay que crear
 * otro (el viejo queda mapeado por si alguien lo tenía abierto). Los días de prueba cambian cada día: un plan con prueba solo se reutiliza el mismo día.
 */
export function puedeReutilizarPlan(
  guardado: { plan: string; monto: number; diasDePrueba?: number } | null | undefined,
  actual: { plan: string; monto: number; diasDePrueba?: number },
): boolean {
  return (
    !!guardado && guardado.plan === actual.plan && guardado.monto === actual.monto && (guardado.diasDePrueba ?? 0) === (actual.diasDePrueba ?? 0)
  );
}

/** Lo más lejos que se difiere un primer cobro: dos meses (de sobra para llegar al día de cobro del mes que viene). */
const MAX_DIAS_DE_PRUEBA = 62;

/**
 * Mercado Pago cobra el primer mes AL SUSCRIBIRSE. Si el mes en curso ya está pago (la suscripción anterior se canceló en el mismo mes, o se
 * pagó por otro medio), ese cobro sería doble. Entonces el plan lleva una prueba hasta el día de cobro del mes que viene y el primer cobro
 * es el de ese mes. Devuelve esos días y la fecha ("AAAA-MM-DD") del primer cobro, o null si el mes en curso todavía no está pago: ahí el
 * primer cobro sale enseguida y paga la factura de este mes (lo que se quiere). `diaDeCobro` es el de la institución (por defecto el 10).
 */
export function primerCobroDiferido(e: { hoy: string; diaDeCobro: number | null; mesActualPago: boolean }): { dias: number; fecha: string } | null {
  if (!e.mesActualPago) return null;
  const fecha = fechaCobroDelPeriodo(sumarMeses(e.hoy.slice(0, 7), 1), e.diaDeCobro);
  const aDia = (f: string) => {
    const [a, m, d] = f.split("-").map(Number) as [number, number, number];
    return Date.UTC(a, m - 1, d);
  };
  const dias = Math.round((aDia(fecha) - aDia(e.hoy)) / 86_400_000);
  return dias > 0 && dias <= MAX_DIAS_DE_PRUEBA ? { dias, fecha } : null;
}

export type DecisionDeAlta = "ignorar" | "misma" | "crear" | "duplicada" | "reemplazar";

/**
 * Qué hacer cuando Mercado Pago avisa de una suscripción que NO tenemos anotada y ya sabemos de qué institución es (por su plan o por su
 * referencia). `estadoNuevo` es el estado de la suscripción nueva; `propia` es lo que la institución ya tenía anotado (una sola fila).
 *  - Si la fila de la institución ya ES esta suscripción (otro aviso o la vuelta de la persona la anotaron un instante antes), es la misma:
 *    se pone al día. Sin esto, dos caminos simultáneos se verían como duplicados entre sí y se cancelaría la suscripción buena.
 *  - Una cancelada o de estado desconocido no crea nada.
 *  - Sin nada anotado, o con una cancelada, se crea (la persona acaba de suscribirse).
 *  - Con una activa o en pausa, la nueva es una duplicada: Mercado Pago cobraría las dos, así que la ruta cancela la nueva.
 *  - Con una pendiente, solo una autorizada la reemplaza (la pendiente no cobra y se cancela); otra pendiente no pisa a la anterior.
 */
export function decidirAltaDeSuscripcion(entrada: {
  idNuevo: string;
  estadoNuevo: EstadoSuscripcion | null;
  propia: { estado: string; suscripcionId: string } | null;
}): DecisionDeAlta {
  const { idNuevo, estadoNuevo, propia } = entrada;
  if (propia && propia.suscripcionId === idNuevo) return "misma";
  if (!estadoNuevo || estadoNuevo === "cancelada") return "ignorar";
  if (!propia || propia.estado === "cancelada") return "crear";
  if (propia.estado === "autorizada" || propia.estado === "pausada") return "duplicada";
  return estadoNuevo === "autorizada" ? "reemplazar" : "ignorar";
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
