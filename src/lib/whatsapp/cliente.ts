import { idDelNumeroDeWhatsapp, tokenDeWhatsapp, versionDeApi, type ModoWhatsapp } from "./config";
import { cargaDeLaPlantilla, esPlantillaDeWhatsapp, textoDeAviso, type DatosDeAviso, type NombreDePlantilla } from "./plantillas";
import { numeroEnmascarado } from "./telefono";

/*
 * Envío de un mensaje por la API de WhatsApp de Meta (https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages), sin SDK: es un solo POST.
 * Se corre solo desde el servidor (el token nunca sale de acá). El modo "consola" imprime en lugar de enviar.
 *
 * A diferencia de Resend, la API de Meta no tiene una clave de idempotencia: si el pedido sale y la respuesta se pierde, no hay forma de saber si el
 * mensaje salió. Por eso un corte SIN respuesta no se reintenta (`reintentable: false`): un aviso que se pierde es mejor que uno repetido dos veces.
 */

export type MensajeDeWhatsapp =
  | { tipo: "plantilla"; para: string; plantilla: NombreDePlantilla; datos: DatosDeAviso }
  | { tipo: "texto"; para: string; texto: string };

export type ResultadoDeEnvioWa = { ok: true; id: string } | { ok: false; reintentable: boolean; motivo: string; codigo?: number };

const ESPERA_MAXIMA_MS = 15_000;

/**
 * Códigos de error de Meta que se arreglan esperando: demasiados pedidos (130429, 80007, 4, 17, 32, 613), el límite de mensajes a una misma persona (131056)
 * o «demasiados mensajes de este tipo» (131048) y un fallo pasajero de Meta (131000). El resto (token vencido, número que no existe, plantilla
 * mal armada, la persona bloqueó el número…) no mejora reintentando.
 */
const CODIGOS_REINTENTABLES = new Set([4, 17, 32, 613, 80007, 130429, 131000, 131048, 131056]);

/** Qué hacer con la respuesta de Meta. Un 2xx con el id del mensaje es éxito; un 429, un 5xx o uno de los códigos de arriba se reintenta; lo demás no. */
export function interpretarRespuestaWa(status: number, cuerpo: unknown): ResultadoDeEnvioWa {
  const datos = (cuerpo ?? {}) as { messages?: { id?: unknown }[]; error?: { code?: unknown; message?: unknown; error_data?: { details?: unknown } } };
  const id = datos.messages?.[0]?.id;
  if (status >= 200 && status < 300 && typeof id === "string") return { ok: true, id };

  const codigo = typeof datos.error?.code === "number" ? datos.error.code : undefined;
  const detalle =
    typeof datos.error?.error_data?.details === "string"
      ? datos.error.error_data.details
      : typeof datos.error?.message === "string"
        ? datos.error.message
        : "sin detalle";
  return {
    ok: false,
    reintentable: status === 429 || status >= 500 || (codigo !== undefined && CODIGOS_REINTENTABLES.has(codigo)),
    motivo: `Meta ${status}${codigo !== undefined ? ` (${codigo})` : ""}: ${detalle}`.slice(0, 300),
    codigo,
  };
}

/** El cuerpo del pedido a la API para este mensaje. */
export function pedidoDeMensaje(mensaje: MensajeDeWhatsapp) {
  const base = { messaging_product: "whatsapp", recipient_type: "individual", to: mensaje.para };
  if (mensaje.tipo === "texto") return { ...base, type: "text", text: { preview_url: false, body: mensaje.texto } };
  return { ...base, type: "template", template: cargaDeLaPlantilla(mensaje.plantilla, mensaje.datos) };
}

export async function enviarWhatsapp(
  mensaje: MensajeDeWhatsapp,
  modo: ModoWhatsapp,
  opciones: { fetchImpl?: typeof fetch; token?: string; idDelNumero?: string; version?: string } = {},
): Promise<ResultadoDeEnvioWa> {
  if (modo === "apagado") return { ok: false, reintentable: false, motivo: "El envío por WhatsApp está apagado." };

  if (modo === "consola") {
    // Nunca el número entero ni el texto de la persona: la consola va a los logs.
    console.info("[whatsapp:consola]", {
      para: numeroEnmascarado(mensaje.para),
      tipo: mensaje.tipo,
      plantilla: mensaje.tipo === "plantilla" ? mensaje.plantilla : null,
      texto: mensaje.tipo === "plantilla" && esPlantillaDeWhatsapp(mensaje.plantilla) ? textoDeAviso(mensaje.plantilla, mensaje.datos.variables) : mensaje.tipo === "texto" ? mensaje.texto : null,
    });
    return { ok: true, id: "consola" };
  }

  const token = opciones.token ?? tokenDeWhatsapp();
  const idDelNumero = opciones.idDelNumero ?? idDelNumeroDeWhatsapp();
  if (!token || !idDelNumero) return { ok: false, reintentable: false, motivo: "Falta WHATSAPP_TOKEN o WHATSAPP_PHONE_NUMBER_ID." };

  try {
    const respuesta = await (opciones.fetchImpl ?? fetch)(`https://graph.facebook.com/${opciones.version ?? versionDeApi()}/${idDelNumero}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(pedidoDeMensaje(mensaje)),
      signal: AbortSignal.timeout(ESPERA_MAXIMA_MS),
    });
    const cuerpo = await respuesta.json().catch(() => null);
    return interpretarRespuestaWa(respuesta.status, cuerpo);
  } catch (e) {
    // Sin respuesta (red caída, tiempo agotado): puede haber salido o no, y no hay clave de idempotencia. No se reintenta (ver arriba).
    const causa = e instanceof Error ? e.name : "error";
    return { ok: false, reintentable: false, motivo: `Sin respuesta de Meta (${causa}): puede haber salido, no se reintenta para no repetirlo.` };
  }
}
