import "server-only";
import {
  InvalidWebhookSignatureError,
  Invoice,
  MercadoPagoConfig,
  MercadoPagoError,
  MPNotFoundError,
  Payment,
  PreApproval,
  PreApprovalPlan,
  Preference,
  User,
  WebhookSignatureValidator,
} from "mercadopago";
import { cuerpoDeNuevoMonto, detalleDeRechazo, esUrlDeMercadoPago, type CobroDeMercadoPago, type cuerpoDePlan } from "@/lib/debito-automatico";
import { secretoDelWebhook, TOLERANCIA_DE_AVISO_SEGUNDOS, tokenDeMercadoPago } from "@/lib/mercadopago-config";
import type { CuerpoDePreferencia } from "@/lib/pago-semestre";

/*
 * Lo único que habla con Mercado Pago, por el SDK oficial (`mercadopago`). El resto de la app no importa el SDK: pide estas funciones,
 * que devuelven datos simples y fallan con un `ErrorDeMercadoPago` que dice si vale la pena reintentar. El token sale de `MP_ACCESS_TOKEN`
 * al momento de usarlo y no se guarda, no se loguea ni viaja al navegador.
 */

export type TipoDeError =
  /** Faltan MP_ACCESS_TOKEN / MP_WEBHOOK_SECRET. */
  | "sin-configurar"
  /** Mercado Pago dice que eso no existe (404). */
  | "no-existe"
  /** Mercado Pago rechazó el pedido (datos o permisos): reintentar igual no sirve. */
  | "rechazado"
  /** Falló la conexión o Mercado Pago está caído: se puede reintentar. */
  | "no-disponible";

export class ErrorDeMercadoPago extends Error {
  constructor(
    readonly tipo: TipoDeError,
    mensaje: string,
    readonly estadoHttp?: number,
  ) {
    super(mensaje);
    this.name = "ErrorDeMercadoPago";
  }
}

function configuracion(opciones: { timeout: number; maxRetries: number } = { timeout: 10_000, maxRetries: 2 }) {
  const token = tokenDeMercadoPago();
  if (!token) throw new ErrorDeMercadoPago("sin-configurar", "Falta MP_ACCESS_TOKEN.");
  // El SDK reintenta solo ante fallos transitorios y usa una clave de idempotencia por pedido: reintentar una creación no la duplica.
  return new MercadoPagoConfig({ accessToken: token, options: opciones });
}

/** Un error del SDK → uno nuestro, sin arrastrar el pedido (que lleva el token) ni el cuerpo de la respuesta. */
function traducir(error: unknown): ErrorDeMercadoPago {
  if (error instanceof ErrorDeMercadoPago) return error;
  if (error instanceof MPNotFoundError) return new ErrorDeMercadoPago("no-existe", "Mercado Pago no encontró el recurso.", 404);
  if (error instanceof MercadoPagoError) {
    const estado = error.status;
    // 4xx (salvo 408, 429 y 423): lo pedido está mal o no tenemos permiso: reintentar no cambia nada.
    if (estado >= 400 && estado < 500 && ![408, 423, 429].includes(estado)) {
      const detalle = detalleDeRechazo({ message: error.message, error: error.error, causes: error.causes });
      return new ErrorDeMercadoPago("rechazado", `Mercado Pago rechazó el pedido (${estado})${detalle ? `: ${detalle}` : ""}.`, estado);
    }
    return new ErrorDeMercadoPago("no-disponible", `Mercado Pago no respondió bien (${estado || "sin estado"}).`, estado || undefined);
  }
  return new ErrorDeMercadoPago("no-disponible", "No pudimos hablar con Mercado Pago.");
}

export type SuscripcionDeMercadoPago = {
  id: string;
  /** El estado tal cual lo informa Mercado Pago ("pending", "authorized", "paused", "cancelled"). */
  estado: string | undefined;
  /** La dirección de Mercado Pago donde la persona carga su tarjeta y autoriza (solo la devuelve al crear o consultar). */
  enlaceDeAutorizacion: string | null;
  /** Próximo débito (ISO), si ya lo definió. */
  proximoCobro: string | null;
  /** Pesos por mes que cobra hoy. */
  monto: number | null;
  email: string | null;
  referencia: string | null;
  /**
   * El plan por el que se suscribió la persona (`preapproval_plan_id`). Es lo ÚNICO que identifica a la institución cuando se suscribe por el
   * enlace de un plan: Mercado Pago deja vacíos la referencia y el mail.
   */
  planId: string | null;
  /** Cuándo se creó la suscripción en Mercado Pago (ISO): de ahí sale el día del mes en que cobra. */
  creadaEn: string | null;
};

type RespuestaDeSuscripcion = {
  id?: string;
  status?: string;
  init_point?: string;
  next_payment_date?: string;
  auto_recurring?: { transaction_amount?: number };
  payer_email?: string;
  external_reference?: string;
  preapproval_plan_id?: string;
  date_created?: string;
};

function leerSuscripcion(r: RespuestaDeSuscripcion): SuscripcionDeMercadoPago {
  if (!r.id) throw new ErrorDeMercadoPago("no-disponible", "Mercado Pago no devolvió el número de la suscripción.");
  return {
    id: String(r.id),
    estado: r.status,
    // Solo seguimos un enlace que sea de Mercado Pago.
    enlaceDeAutorizacion: esUrlDeMercadoPago(r.init_point) ? r.init_point : null,
    proximoCobro: r.next_payment_date ?? null,
    monto: typeof r.auto_recurring?.transaction_amount === "number" ? r.auto_recurring.transaction_amount : null,
    // Mercado Pago deja el mail vacío cuando la suscripción nace de un plan: una cadena vacía es "no informó".
    email: r.payer_email ? r.payer_email : null,
    referencia: r.external_reference ? String(r.external_reference) : null,
    planId: r.preapproval_plan_id ? String(r.preapproval_plan_id) : null,
    creadaEn: r.date_created ? String(r.date_created) : null,
  };
}

/** Un plan de Mercado Pago: la plantilla de la suscripción de una institución y la dirección donde la persona se suscribe. */
export type PlanDeMercadoPago = {
  id: string;
  /** "active" mientras sirve para suscribirse. */
  estado: string | undefined;
  /** La dirección de Mercado Pago donde la persona inicia sesión, carga su tarjeta y se suscribe (solo si es de Mercado Pago). */
  enlace: string | null;
};

function leerPlan(r: { id?: string; status?: string; init_point?: string }): PlanDeMercadoPago {
  if (!r.id) throw new ErrorDeMercadoPago("no-disponible", "Mercado Pago no devolvió el número del plan.");
  return { id: String(r.id), estado: r.status, enlace: esUrlDeMercadoPago(r.init_point) ? r.init_point : null };
}

export async function crearPlanMp(cuerpo: ReturnType<typeof cuerpoDePlan>): Promise<PlanDeMercadoPago> {
  try {
    return leerPlan(await new PreApprovalPlan(configuracion()).create({ body: cuerpo }));
  } catch (e) {
    throw traducir(e);
  }
}

export async function obtenerPlanMp(id: string): Promise<PlanDeMercadoPago> {
  try {
    return leerPlan(await new PreApprovalPlan(configuracion()).get({ preApprovalPlanId: id }));
  } catch (e) {
    throw traducir(e);
  }
}

/**
 * Los números de las suscripciones que se crearon desde un plan. Sirve para confirmar una suscripción cuando la persona vuelve de
 * Mercado Pago (o el aviso no llegó): se buscan por el plan de la institución, nunca por un número que venga del navegador.
 */
export async function buscarSuscripcionesDelPlanMp(planId: string): Promise<string[]> {
  try {
    const r = await new PreApproval(configuracion()).search({ options: { preapproval_plan_id: planId, limit: 20 } });
    return (r.results ?? []).map((s) => (s.id ? String(s.id) : "")).filter(Boolean);
  } catch (e) {
    throw traducir(e);
  }
}

export async function obtenerSuscripcionMp(id: string): Promise<SuscripcionDeMercadoPago> {
  try {
    return leerSuscripcion(await new PreApproval(configuracion()).get({ id }));
  } catch (e) {
    throw traducir(e);
  }
}

/**
 * Cambia lo que cobra Mercado Pago cada mes (cuando cambia el plan, las sedes o el precio). Devuelve el estado en que quedó la suscripción:
 * un aumento puede sacarla de "authorized" hasta que la persona apruebe el monto nuevo, y eso no se puede dar por hecho ni en un sentido ni
 * en el otro.
 */
export async function cambiarMontoMp(id: string, monto: number): Promise<{ estado: string | undefined }> {
  try {
    const r = await new PreApproval(configuracion()).update({ id, body: cuerpoDeNuevoMonto(monto) });
    return { estado: r.status };
  } catch (e) {
    throw traducir(e);
  }
}

/** Da de baja la suscripción: Mercado Pago no vuelve a cobrar. */
export async function cancelarSuscripcionMp(id: string): Promise<void> {
  try {
    await new PreApproval(configuracion()).update({ id, body: { status: "cancelled" } });
  } catch (e) {
    throw traducir(e);
  }
}

/**
 * Todos los cobros que Mercado Pago le hizo (o intentó hacerle) a una suscripción. Es lo que permite recuperar un cobro cuyo aviso nunca
 * llegó o llegó cuando todavía estaba "en proceso" (Mercado Pago no siempre vuelve a avisar cuando acredita). Biomea perdió un cobro real
 * así y por eso corre esta búsqueda todos los días. Hasta 100 cobros por suscripción, de sobra para un plan mensual.
 */
export async function buscarCobrosMp(suscripcionId: string): Promise<CobroDeMercadoPago[]> {
  try {
    const r = await new Invoice(configuracion()).search({ options: { preapproval_id: suscripcionId, limit: 100 } });
    return (r.results ?? []) as CobroDeMercadoPago[];
  } catch (e) {
    throw traducir(e);
  }
}

export async function obtenerCobroMp(id: string): Promise<CobroDeMercadoPago> {
  try {
    return (await new Invoice(configuracion()).get({ id })) as CobroDeMercadoPago;
  } catch (e) {
    throw traducir(e);
  }
}

/* ───────────── Pago único (Checkout Pro): el semestre por adelantado ───────────── */

/** El link de pago que creó Mercado Pago: su número y la dirección (de Mercado Pago, https) donde la persona paga. */
export type PreferenciaDeMercadoPago = { id: string; enlace: string | null };

/**
 * Crea el link de pago de un semestre (Checkout Pro). El SDK usa una clave de idempotencia por pedido, así que un reintento por un fallo de red no
 * crea dos. El monto y la referencia salen de `cuerpoDePreferencia`, que arma el servidor.
 */
export async function crearPreferenciaMp(cuerpo: CuerpoDePreferencia): Promise<PreferenciaDeMercadoPago> {
  try {
    const r = await new Preference(configuracion()).create({ body: cuerpo });
    if (!r.id) throw new ErrorDeMercadoPago("no-disponible", "Mercado Pago no devolvió el número del link de pago.");
    return { id: String(r.id), enlace: esUrlDeMercadoPago(r.init_point) ? r.init_point : null };
  } catch (e) {
    throw traducir(e);
  }
}

/** Un pago tal cual lo informa Mercado Pago (se lee con `leerPagoMp`, que no se fía de nada que no reconozca). */
export async function obtenerPagoMp(id: string): Promise<unknown> {
  try {
    return await new Payment(configuracion()).get({ id });
  } catch (e) {
    throw traducir(e);
  }
}

/**
 * Los pagos que Mercado Pago le asocia a una referencia nuestra (el número de un intento), los más nuevos primero. Es lo que permite recuperar un
 * pago cuyo aviso nunca llegó, o confirmarlo cuando la persona vuelve de pagar sin esperar el aviso.
 */
export async function buscarPagosDeReferenciaMp(referencia: string): Promise<unknown[]> {
  try {
    const r = await new Payment(configuracion()).search({ options: { external_reference: referencia, sort: "date_created", criteria: "desc", limit: 20 } });
    return r.results ?? [];
  } catch (e) {
    throw traducir(e);
  }
}

/**
 * La cuenta dueña del Access Token (`GET /users/me`): sirve para saber si los cobros son de prueba o reales (un token `APP_USR-` también
 * puede ser de una cuenta de prueba). Solo lee mail, usuario y etiquetas; nada de eso se guarda.
 */
export async function obtenerCuentaDeCobroMp(): Promise<{ email: string | null; nickname: string | null; tags: string[] }> {
  try {
    // Se pregunta al dibujar pantallas del backoffice: un límite corto y sin reintentos, para que una demora de Mercado Pago no las trabe.
    const u = await new User(configuracion({ timeout: 3_000, maxRetries: 0 })).get();
    return { email: u.email ?? null, nickname: u.nickname ?? null, tags: Array.isArray(u.tags) ? u.tags.map(String) : [] };
  } catch (e) {
    throw traducir(e);
  }
}

/**
 * ¿El aviso lo mandó Mercado Pago? Recalcula la firma (HMAC-SHA256) con la clave secreta de la aplicación, en tiempo constante, y rechaza
 * los avisos con el reloj muy corrido (repetidos). Devuelve el motivo si no vale, para anotarlo en el log sin mostrarlo a quien llamó.
 */
export function comprobarAviso(entrada: {
  firma: string | null;
  idDelPedido: string | null;
  idDelRecurso: string | null;
}): { valido: true } | { valido: false; motivo: string } {
  const secreto = secretoDelWebhook();
  if (!secreto) return { valido: false, motivo: "sin-clave" };
  try {
    WebhookSignatureValidator.validate({
      xSignature: entrada.firma,
      xRequestId: entrada.idDelPedido,
      dataId: entrada.idDelRecurso,
      secret: secreto,
      toleranceSeconds: TOLERANCIA_DE_AVISO_SEGUNDOS,
    });
    return { valido: true };
  } catch (e) {
    if (e instanceof InvalidWebhookSignatureError) return { valido: false, motivo: e.reason };
    return { valido: false, motivo: "error" };
  }
}
