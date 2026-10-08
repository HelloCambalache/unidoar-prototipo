import { claveDeResend, type ModoCorreo } from "./config";

/*
 * Envío de un mail por la API de Resend (https://resend.com/docs/api-reference/emails/send-email), sin SDK: es un
 * solo POST. Se corre solo desde el servidor (la clave nunca sale de acá). El modo "consola" imprime en lugar de enviar.
 */

export type Mensaje = {
  de: string;
  para: string;
  asunto: string;
  html: string;
  texto: string;
  responderA?: string;
  /** Cabeceras extra (List-Unsubscribe, etc.). */
  cabeceras?: Record<string, string>;
  /** Resend no manda dos veces el mismo mail con la misma clave (por 24 h): protege de reenvíos si un proceso se cae a la mitad. */
  claveDeIdempotencia: string;
};

export type ResultadoDeEnvio = { ok: true; id: string } | { ok: false; reintentable: boolean; motivo: string };

const URL_RESEND = "https://api.resend.com/emails";
const ESPERA_MAXIMA_MS = 15_000;

/** Qué hacer con la respuesta de Resend: un 429 o un error del servidor se reintentan; los demás (dirección inválida, dominio sin verificar…) no. */
export function interpretarRespuesta(status: number, cuerpo: unknown): ResultadoDeEnvio {
  const datos = (cuerpo ?? {}) as { id?: unknown; message?: unknown; name?: unknown };
  if (status >= 200 && status < 300 && typeof datos.id === "string") return { ok: true, id: datos.id };
  const detalle = typeof datos.message === "string" ? datos.message : typeof datos.name === "string" ? datos.name : "sin detalle";
  return { ok: false, reintentable: status === 429 || status >= 500, motivo: `Resend ${status}: ${detalle}`.slice(0, 300) };
}

export async function enviarMensaje(
  mensaje: Mensaje,
  modo: ModoCorreo,
  opciones: { fetchImpl?: typeof fetch; clave?: string } = {},
): Promise<ResultadoDeEnvio> {
  if (modo === "apagado") return { ok: false, reintentable: false, motivo: "El envío de mails está apagado." };

  if (modo === "consola") {
    console.info("[correo:consola]", { para: mensaje.para, de: mensaje.de, asunto: mensaje.asunto, responderA: mensaje.responderA ?? null });
    return { ok: true, id: "consola" };
  }

  const clave = opciones.clave ?? claveDeResend();
  if (!clave) return { ok: false, reintentable: false, motivo: "Falta RESEND_API_KEY." };

  try {
    const respuesta = await (opciones.fetchImpl ?? fetch)(URL_RESEND, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${clave}`,
        "Content-Type": "application/json",
        "Idempotency-Key": mensaje.claveDeIdempotencia,
      },
      body: JSON.stringify({
        from: mensaje.de,
        to: [mensaje.para],
        subject: mensaje.asunto,
        html: mensaje.html,
        text: mensaje.texto,
        ...(mensaje.responderA ? { reply_to: mensaje.responderA } : {}),
        ...(mensaje.cabeceras ? { headers: mensaje.cabeceras } : {}),
      }),
      signal: AbortSignal.timeout(ESPERA_MAXIMA_MS),
    });
    const cuerpo = await respuesta.json().catch(() => null);
    return interpretarRespuesta(respuesta.status, cuerpo);
  } catch (e) {
    // Sin respuesta (red caída, tiempo agotado): puede haber llegado o no. Se reintenta con la misma clave de idempotencia.
    const causa = e instanceof Error ? e.name : "error";
    return { ok: false, reintentable: true, motivo: `No se pudo conectar con Resend (${causa}).` };
  }
}
