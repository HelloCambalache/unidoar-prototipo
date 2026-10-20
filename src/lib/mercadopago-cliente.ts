import "server-only";
import {
  InvalidWebhookSignatureError,
  Invoice,
  MercadoPagoConfig,
  MercadoPagoError,
  MPNotFoundError,
  PreApproval,
  WebhookSignatureValidator,
} from "mercadopago";
import { cuerpoDeNuevoMonto, esUrlDeMercadoPago, type CobroDeMercadoPago, type cuerpoDeSuscripcion } from "@/lib/debito-automatico";
import { secretoDelWebhook, TOLERANCIA_DE_AVISO_SEGUNDOS, tokenDeMercadoPago } from "@/lib/mercadopago-config";

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

function configuracion() {
  const token = tokenDeMercadoPago();
  if (!token) throw new ErrorDeMercadoPago("sin-configurar", "Falta MP_ACCESS_TOKEN.");
  // El SDK reintenta solo ante fallos transitorios y usa una clave de idempotencia por pedido: reintentar una creación no la duplica.
  return new MercadoPagoConfig({ accessToken: token, options: { timeout: 10_000, maxRetries: 2 } });
}

/** Un error del SDK → uno nuestro, sin arrastrar el pedido (que lleva el token) ni el cuerpo de la respuesta. */
function traducir(error: unknown): ErrorDeMercadoPago {
  if (error instanceof ErrorDeMercadoPago) return error;
  if (error instanceof MPNotFoundError) return new ErrorDeMercadoPago("no-existe", "Mercado Pago no encontró el recurso.", 404);
  if (error instanceof MercadoPagoError) {
    const estado = error.status;
    // 4xx (salvo 408, 429 y 423): lo pedido está mal o no tenemos permiso: reintentar no cambia nada.
    if (estado >= 400 && estado < 500 && ![408, 423, 429].includes(estado)) {
      return new ErrorDeMercadoPago("rechazado", `Mercado Pago rechazó el pedido (${estado}).`, estado);
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
};

type RespuestaDeSuscripcion = {
  id?: string;
  status?: string;
  init_point?: string;
  next_payment_date?: string;
  auto_recurring?: { transaction_amount?: number };
  payer_email?: string;
  external_reference?: string;
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
    email: r.payer_email ?? null,
    referencia: r.external_reference ?? null,
  };
}

export async function crearSuscripcionMp(cuerpo: ReturnType<typeof cuerpoDeSuscripcion>): Promise<SuscripcionDeMercadoPago> {
  try {
    return leerSuscripcion(await new PreApproval(configuracion()).create({ body: cuerpo }));
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

/** Cambia lo que cobra Mercado Pago cada mes (cuando cambia el plan, las sedes o el precio). */
export async function cambiarMontoMp(id: string, monto: number): Promise<void> {
  try {
    await new PreApproval(configuracion()).update({ id, body: cuerpoDeNuevoMonto(monto) });
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

export async function obtenerCobroMp(id: string): Promise<CobroDeMercadoPago> {
  try {
    return (await new Invoice(configuracion()).get({ id })) as CobroDeMercadoPago;
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
