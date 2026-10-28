import { conflictosDeSemestre, etiquetaDeCobertura, pagoHastaDeMes, sumarMeses, type FacturaConCobertura } from "@/lib/cobros";

/*
 * Pago del semestre por Mercado Pago: UN pago único por adelantado (pagás 5 meses, usás 6), no una suscripción. La institución toca «Pagar el
 * semestre», el servidor calcula el monto (nunca el navegador) y le arma un link de Checkout Pro; cuando Mercado Pago avisa que el pago se aprobó,
 * se registra el semestre como UNA factura paga que cubre los 6 meses, igual que cuando lo registra el equipo (ver «Semestre al contado» en
 * CLAUDE.md). Acá viven las reglas puras (sin base ni red) para poder probarlas.
 */

/** El medio que queda anotado en la factura. */
export const MEDIO_DE_PAGO_SEMESTRE = "Mercado Pago";

/** Cuánto vale el link de pago: pasado ese plazo Mercado Pago ya no lo acepta y hay que pedir otro. */
export const DIAS_DE_VIGENCIA_DEL_LINK = 3;

/** Los intentos que siguen pendientes se revisan en Mercado Pago hasta este día después de creados (la revisión diaria recupera un aviso perdido). */
export const DIAS_PARA_RECUPERAR_UN_PAGO = 10;

/** Un intento en el que el pago se aprobó pero no se pudo registrar solo queda en `revisar`: el equipo lo resuelve a mano. */
export type EstadoDelIntento = "pendiente" | "pagado" | "revisar";

/* ───────────────────────────── Lo que contesta Mercado Pago ───────────────────────────── */

export type EstadoDelPago = "aprobado" | "pendiente" | "rechazado" | "devuelto" | "desconocido";

/** El estado de un pago de Mercado Pago (`status`) llevado a los nuestros. Un estado que no conocemos no mueve plata. */
export function estadoDePagoMp(status: unknown): EstadoDelPago {
  switch (status) {
    case "approved":
      return "aprobado";
    case "pending":
    case "in_process":
    case "in_mediation":
    case "authorized":
      return "pendiente";
    case "rejected":
    case "cancelled":
      return "rechazado";
    case "refunded":
    case "charged_back":
      return "devuelto";
    default:
      return "desconocido";
  }
}

export type PagoLeido = {
  /** El número del pago en Mercado Pago. */
  id: string;
  estado: EstadoDelPago;
  /** Pesos pagados (`transaction_amount`); null si no vino. */
  monto: number | null;
  moneda: string | null;
  /** Lo que mandamos como `external_reference` al crear el link: el número de nuestro intento. */
  referencia: string | null;
  /** Cuándo se aprobó (ISO), si ya se aprobó. */
  aprobadoEn: string | null;
  /** El detalle que informa Mercado Pago (`accredited`, `cc_rejected_…`), para el log y el equipo. */
  detalle: string | null;
};

const ES_UN_NUMERO_DE_PAGO = /^[0-9A-Za-z_-]{1,64}$/;

/** Un pago tal como lo devuelve Mercado Pago → lo que usamos. null si no trae un número de pago válido. */
export function leerPagoMp(r: unknown): PagoLeido | null {
  if (typeof r !== "object" || r === null) return null;
  const p = r as Record<string, unknown>;
  const id = p.id === undefined || p.id === null ? "" : String(p.id);
  if (!ES_UN_NUMERO_DE_PAGO.test(id)) return null;
  const monto = typeof p.transaction_amount === "number" && Number.isFinite(p.transaction_amount) ? p.transaction_amount : null;
  return {
    id,
    estado: estadoDePagoMp(p.status),
    monto,
    moneda: typeof p.currency_id === "string" ? p.currency_id : null,
    referencia: typeof p.external_reference === "string" && p.external_reference ? p.external_reference : null,
    aprobadoEn: typeof p.date_approved === "string" && p.date_approved ? p.date_approved : null,
    detalle: typeof p.status_detail === "string" && p.status_detail ? p.status_detail : null,
  };
}

/* ───────────────────────────── El link de pago ───────────────────────────── */

export type CuerpoDePreferencia = {
  items: { id: string; title: string; description: string; quantity: number; currency_id: "ARS"; unit_price: number }[];
  external_reference: string;
  statement_descriptor: string;
  notification_url: string;
  back_urls: { success: string; pending: string; failure: string };
  auto_return: "approved";
  expires: true;
  expiration_date_from: string;
  expiration_date_to: string;
};

/**
 * El pedido de Checkout Pro de un semestre. `referencia` es el número de nuestro intento: vuelve en el pago (`external_reference`) y es lo único
 * que dice de quién es. El monto es el que calculó el servidor. `origen` es la dirección pública del sitio (https): Mercado Pago no acepta
 * `localhost` en las direcciones de vuelta ni en la del aviso.
 */
export function cuerpoDePreferencia(e: { referencia: string; titulo: string; descripcion: string; monto: number; origen: string; rutaDelAviso: string; ahora?: Date }): CuerpoDePreferencia {
  const ahora = e.ahora ?? new Date();
  const hasta = new Date(ahora.getTime() + DIAS_DE_VIGENCIA_DEL_LINK * 24 * 60 * 60 * 1000);
  const vuelta = (resultado: "ok" | "pendiente" | "error") => `${e.origen}/institucion/plan?pago_semestre=${resultado}`;
  return {
    items: [{ id: e.referencia, title: e.titulo, description: e.descripcion, quantity: 1, currency_id: "ARS", unit_price: e.monto }],
    external_reference: e.referencia,
    statement_descriptor: "UNIDOAR",
    notification_url: `${e.origen}${e.rutaDelAviso}`,
    back_urls: { success: vuelta("ok"), pending: vuelta("pendiente"), failure: vuelta("error") },
    auto_return: "approved",
    expires: true,
    expiration_date_from: ahora.toISOString(),
    expiration_date_to: hasta.toISOString(),
  };
}

/** "Plan Colegios · 6 meses (octubre 2026 a marzo 2027)": lo que ve la persona en Mercado Pago. */
export function tituloDelPago(plan: string, periodo: string, meses: number) {
  return `UNIDOAR · ${plan} · ${etiquetaDeCobertura(periodo, meses)}`;
}

/* ───────────────────────────── Cuánto y desde cuándo ───────────────────────────── */

/**
 * Cuánto sale el semestre: los meses que se pagan por lo que cuesta el mes (con sus sedes y su precio acordado). Con un mes bonificado por
 * recomendar a favor, se paga un mes menos (`mesesConReferido`). Es la misma cuenta que hace el registro manual del equipo.
 */
export function montoDelSemestre(mensual: number, usaMesBonificado: boolean, pack: { mesesQueSePagan: number; mesesConReferido: number }) {
  const mesesAPagar = usaMesBonificado ? Math.min(pack.mesesConReferido, pack.mesesQueSePagan) : pack.mesesQueSePagan;
  return { mesesAPagar, monto: mensual * mesesAPagar };
}

/** Cuántos meses adelante del mes en curso puede empezar un semestre que se paga solo desde la plataforma (el máximo que acepta el registro). */
const MESES_DE_ADELANTO = 2;

/**
 * Desde qué mes cubre el semestre que se paga ahora. El primer mes, desde el actual, que todavía no esté pago y cuya ventana de `meses` no tenga
 * meses pagos ni facturas impagas adentro (la del primer mes sí vale: pasa a ser la del semestre). Así, con el mes en curso ya pago empieza el
 * mes siguiente. Si ninguno sirve devuelve el motivo, para que lo resuelva el equipo.
 */
export function elegirInicioDeSemestre(e: { actual: string; meses: number; facturas: readonly FacturaConCobertura[] }): { inicio: string } | { error: string } {
  let ultimo = "";
  for (let k = 0; k <= MESES_DE_ADELANTO; k++) {
    const candidato = sumarMeses(e.actual, k);
    const pagoHasta = pagoHastaDeMes(candidato, e.facturas);
    const { pagos, impagas } = conflictosDeSemestre(candidato, e.meses, e.facturas);
    if (!pagoHasta && pagos.length === 0 && impagas.length === 0) return { inicio: candidato };
    ultimo = pagos.length > 0 || pagoHasta ? "ya hay meses pagos" : "hay facturas sin pagar";
  }
  return {
    error: `No pudimos armar el pago del semestre porque ${ultimo} en los meses que cubriría. Escribinos desde Contacto y lo coordinamos con el equipo.`,
  };
}

/* ───────────────────────────── Qué hacer cuando llega un pago ───────────────────────────── */

export type DecisionDelPago =
  /** El pago se aprobó, el monto coincide y el intento todavía no está pago: se registra el semestre. */
  | { accion: "registrar" }
  /** Este pago ya se aplicó (un aviso repetido): no se hace nada. */
  | { accion: "ya-registrado" }
  /** Se aprobó pero no por lo que acordamos: no se registra solo, lo mira el equipo. */
  | { accion: "revisar"; motivo: string }
  /** Todavía no se acredita (pendiente) o se rechazó (puede reintentar con el mismo link): no pasa nada. */
  | { accion: "esperar" }
  /** Se devolvió o hubo un contracargo de un pago que ya habíamos registrado: lo mira el equipo (no se deshace solo). */
  | { accion: "devuelto" };

/**
 * Qué se hace con un pago de Mercado Pago de un intento. El monto tiene que ser exactamente el que acordamos al crear el link y en pesos: ante
 * cualquier diferencia no se registra solo. Un pago que no se conoce o no está aprobado no mueve plata.
 */
export function decidirPagoDeSemestre(e: { intento: { estado: string; monto: number; pagoId: string | null }; pago: PagoLeido }): DecisionDelPago {
  const { intento, pago } = e;
  if (pago.estado === "devuelto") return intento.estado === "pagado" ? { accion: "devuelto" } : { accion: "esperar" };
  if (pago.estado !== "aprobado") return { accion: "esperar" };
  if (intento.estado === "pagado") {
    // El mismo pago repetido es un aviso repetido; otro pago aprobado sobre un intento ya pago es un cobro de más.
    return intento.pagoId === pago.id ? { accion: "ya-registrado" } : { accion: "revisar", motivo: "Hay otro pago aprobado para un semestre que ya estaba pago (posible cobro doble)." };
  }
  if (pago.moneda !== "ARS") return { accion: "revisar", motivo: `El pago no está en pesos (${pago.moneda ?? "sin moneda"}).` };
  if (pago.monto === null || Math.round(pago.monto) !== intento.monto) {
    return { accion: "revisar", motivo: `El monto pagado (${pago.monto ?? "sin dato"}) no es el que se acordó (${intento.monto}).` };
  }
  return { accion: "registrar" };
}

/* ───────────────────────────── Cuando la persona vuelve de Mercado Pago ───────────────────────────── */

export type VueltaDelPago = "ok" | "pendiente" | "error";

/** El `?pago_semestre=` que agregan nuestras direcciones de vuelta; cualquier otro valor se ignora. */
export function vueltaDelPago(valor: unknown): VueltaDelPago | null {
  const v = Array.isArray(valor) ? valor[0] : valor;
  return v === "ok" || v === "pendiente" || v === "error" ? v : null;
}
