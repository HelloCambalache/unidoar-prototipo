/*
 * Configuración de los avisos por WhatsApp (API de WhatsApp Business de Meta, «Cloud API»). Todo sale de variables de entorno y nada se
 * evalúa al importar, para poder probarlo con un `env` armado a mano. Guía de puesta en marcha: docs/whatsapp.md.
 *
 *   WHATSAPP_TOKEN            token de acceso PERMANENTE de un usuario del sistema de Meta. Nunca por el chat, un commit ni un log.
 *   WHATSAPP_PHONE_NUMBER_ID  identificador del número de WhatsApp desde el que se manda (no es un secreto, pero hace falta).
 *   WHATSAPP_APP_SECRET       «clave secreta» de la app de Meta: con ella se comprueba la firma de cada aviso que manda Meta al webhook.
 *   WHATSAPP_VERIFY_TOKEN     texto que se escribe en Meta al configurar el webhook; Meta lo manda de vuelta para comprobar que es nuestro.
 *   WHATSAPP_MODO             "consola" (solo imprime, para probar) | "apagado". Por defecto: meta si hay token y número.
 *   WHATSAPP_API_VERSION      versión de la API de Meta. Por defecto la de abajo.
 */

export type ModoWhatsapp = "meta" | "consola" | "apagado";

type Entorno = Record<string, string | undefined>;

const valor = (env: Entorno, nombre: string) => env[nombre]?.trim() || undefined;

export const VERSION_DE_API_POR_DEFECTO = "v23.0";

/** Cómo salen los avisos. "apagado": no se anota ni se manda nada y las pantallas no ofrecen activarlos. */
export function modoWhatsapp(env: Entorno = process.env): ModoWhatsapp {
  const pedido = valor(env, "WHATSAPP_MODO")?.toLowerCase();
  if (pedido === "apagado") return "apagado";
  if (pedido === "consola") return "consola";
  return valor(env, "WHATSAPP_TOKEN") && valor(env, "WHATSAPP_PHONE_NUMBER_ID") ? "meta" : "apagado";
}

/** ¿Las pantallas pueden ofrecer los avisos por WhatsApp? (Solo cuando hay algo detrás que los mande o los imprima.) */
export const whatsappActivo = (env: Entorno = process.env) => modoWhatsapp(env) !== "apagado";

export const tokenDeWhatsapp = (env: Entorno = process.env) => valor(env, "WHATSAPP_TOKEN");
export const idDelNumeroDeWhatsapp = (env: Entorno = process.env) => valor(env, "WHATSAPP_PHONE_NUMBER_ID");
export const secretoDeLaApp = (env: Entorno = process.env) => valor(env, "WHATSAPP_APP_SECRET");
export const tokenDeVerificacionDelWebhook = (env: Entorno = process.env) => valor(env, "WHATSAPP_VERIFY_TOKEN");
export const versionDeApi = (env: Entorno = process.env) => valor(env, "WHATSAPP_API_VERSION") ?? VERSION_DE_API_POR_DEFECTO;
