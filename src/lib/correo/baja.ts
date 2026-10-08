import { createHmac, timingSafeEqual } from "node:crypto";

/*
 * Enlace para dejar de recibir los avisos por mail sin entrar a la cuenta. Va en el pie de los mails opcionales y en
 * la cabecera List-Unsubscribe. Lleva el id de la cuenta y una firma HMAC: sin la clave del servidor nadie puede armar
 * el enlace de otra persona. No vence (se puede usar desde un mail viejo), y solo sirve para apagar los avisos.
 */

const PROPOSITO = "unidoar:baja-avisos:v1:";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Entorno = Record<string, string | undefined>;

function secreto(env: Entorno) {
  const s = env.CORREO_SECRETO?.trim() || env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  return s && s.length >= 16 ? s : null;
}

/** Firma del enlace de baja de esa cuenta, o null si el servidor no tiene con qué firmar. */
export function firmaDeBaja(usuarioId: string, env: Entorno = process.env): string | null {
  const clave = secreto(env);
  if (!clave || !UUID.test(usuarioId)) return null;
  return createHmac("sha256", clave).update(PROPOSITO + usuarioId.toLowerCase()).digest("base64url");
}

export function firmaDeBajaValida(usuarioId: string, firma: string, env: Entorno = process.env): boolean {
  const esperada = firmaDeBaja(usuarioId, env);
  if (!esperada) return false;
  const recibida = Buffer.from(firma);
  const correcta = Buffer.from(esperada);
  return recibida.length === correcta.length && timingSafeEqual(recibida, correcta);
}

function consulta(usuarioId: string, env: Entorno) {
  const firma = firmaDeBaja(usuarioId, env);
  return firma ? `u=${encodeURIComponent(usuarioId.toLowerCase())}&t=${firma}` : null;
}

/** Ruta (con querystring) de la página donde la persona confirma la baja; null si no se puede firmar. */
export function rutaDeBaja(usuarioId: string, env: Entorno = process.env): string | null {
  const c = consulta(usuarioId, env);
  return c ? `/avisos/baja?${c}` : null;
}

/** Ruta que da de baja con un POST sin pasos intermedios (la cabecera List-Unsubscribe-Post de los clientes de correo). */
export function rutaDeBajaConUnClic(usuarioId: string, env: Entorno = process.env): string | null {
  const c = consulta(usuarioId, env);
  return c ? `/api/avisos/baja?${c}` : null;
}
