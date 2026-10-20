/*
 * Configuración de Mercado Pago. Todo sale de variables de entorno y nada se evalúa al importar, para poder probarlo con un `env`
 * armado a mano (igual que src/lib/correo/config.ts).
 *
 *   MP_ACCESS_TOKEN     el Access Token de la aplicación de Mercado Pago (de prueba mientras se prueba, después el de producción).
 *                       Nunca se muestra ni se guarda en la base: solo vive en las variables de Vercel.
 *   MP_WEBHOOK_SECRET   (opcional) la clave secreta de los avisos ("Webhooks" de la aplicación, en Tus integraciones). Si está, cada
 *                       aviso se comprueba contra su firma y, si no coincide, queda anotado en el log. NO bloquea el aviso: lo que decide un
 *                       cobro nunca es lo que llega en el aviso sino lo que Mercado Pago contesta cuando le preguntamos (ver el webhook).
 *                       Bloquear por la firma hacía perder avisos verdaderos si la clave estaba mal cargada (la de pruebas y la de
 *                       producción son distintas); Biomea ya pasó por eso.
 *
 * Sin el token, el débito automático está apagado: el botón no aparece y el webhook responde 503.
 */

type Entorno = Record<string, string | undefined>;

const valor = (env: Entorno, nombre: string) => env[nombre]?.trim() || undefined;

export const tokenDeMercadoPago = (env: Entorno = process.env) => valor(env, "MP_ACCESS_TOKEN");

export const secretoDelWebhook = (env: Entorno = process.env) => valor(env, "MP_WEBHOOK_SECRET");

/**
 * ¿Se difiere el primer cobro (período de prueba en el plan) cuando el mes en curso ya está pago? Apagado por defecto: en el sandbox, pagar
 * un plan con prueba falló ("No pudimos procesar tu pago", con tarjeta de crédito y de débito) y no se sabe si anda en producción; si fallara,
 * una institución real no podría suscribirse. Se enciende con `MP_DIFERIR_PRIMER_COBRO=1` recién después de validarlo en producción.
 */
export const diferirPrimerCobroActivo = (env: Entorno = process.env) => valor(env, "MP_DIFERIR_PRIMER_COBRO") === "1";

/** ¿Se puede ofrecer el débito automático? Alcanza con el token. */
export const mercadoPagoActivo = (env: Entorno = process.env) => Boolean(tokenDeMercadoPago(env));

/** En qué modo están los cobros: con un token de prueba no entra plata real. "desconocido" si no se pudo averiguar de quién es el token. */
export type ModoDeCobro = "produccion" | "prueba" | "desconocido";

/** Un Access Token de prueba de la aplicación empieza con "TEST-" (el de producción, con "APP_USR-"). */
export const esTokenDePrueba = (token: string | null | undefined) => typeof token === "string" && token.trim().toUpperCase().startsWith("TEST-");

/**
 * ¿Es de prueba la cuenta dueña del token? Lo dice `GET /users/me`: un usuario de prueba de Mercado Pago tiene un mail `test_user_…@testuser.com`
 * y un usuario `TESTUSER…`. Cubre el token `APP_USR-` de una aplicación creada dentro de una cuenta de prueba, que el prefijo no delata.
 */
export function esCuentaDePrueba(cuenta: { email?: unknown; nickname?: unknown; tags?: unknown } | null | undefined): boolean {
  if (!cuenta) return false;
  const email = typeof cuenta.email === "string" ? cuenta.email : "";
  const nickname = typeof cuenta.nickname === "string" ? cuenta.nickname : "";
  const tags = Array.isArray(cuenta.tags) ? cuenta.tags : [];
  return /@testuser\.com$/i.test(email) || /^test_user_/i.test(email) || /^TESTUSER/i.test(nickname) || tags.includes("test_user");
}

/** Cuánto se acepta que difiera el reloj de Mercado Pago del nuestro en un aviso: más que esto es un aviso repetido o armado de antes. */
export const TOLERANCIA_DE_AVISO_SEGUNDOS = 15 * 60;

/** La ruta que Mercado Pago llama cuando pasa algo (se carga en su panel: https://<dominio>/api/mercadopago/webhook). */
export const RUTA_DEL_WEBHOOK = "/api/mercadopago/webhook";

/** Los tipos de aviso que usamos (se activan en el panel de Mercado Pago, en Webhooks). */
export const AVISOS_QUE_USAMOS = ["subscription_preapproval", "subscription_authorized_payment"] as const;
export type TipoDeAviso = (typeof AVISOS_QUE_USAMOS)[number];

export const esAvisoQueUsamos = (tipo: unknown): tipo is TipoDeAviso =>
  typeof tipo === "string" && (AVISOS_QUE_USAMOS as readonly string[]).includes(tipo);
