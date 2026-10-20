/*
 * Configuración de Mercado Pago. Todo sale de variables de entorno y nada se evalúa al importar, para poder probarlo con un `env`
 * armado a mano (igual que src/lib/correo/config.ts).
 *
 *   MP_ACCESS_TOKEN     el Access Token de la aplicación de Mercado Pago (de prueba mientras se prueba, después el de producción).
 *                       Nunca se muestra ni se guarda en la base: solo vive en las variables de Vercel.
 *   MP_WEBHOOK_SECRET   la clave secreta de los avisos ("Webhooks" de la aplicación, en Tus integraciones): con ella se comprueba que
 *                       un aviso lo mandó de verdad Mercado Pago.
 *
 * Sin las dos, el débito automático está apagado: el botón no aparece y el aviso de Mercado Pago se rechaza. Hacen falta las dos a la vez:
 * con el token pero sin la clave se podrían crear suscripciones cuyos cobros nunca se anotarían.
 */

type Entorno = Record<string, string | undefined>;

const valor = (env: Entorno, nombre: string) => env[nombre]?.trim() || undefined;

export const tokenDeMercadoPago = (env: Entorno = process.env) => valor(env, "MP_ACCESS_TOKEN");

export const secretoDelWebhook = (env: Entorno = process.env) => valor(env, "MP_WEBHOOK_SECRET");

/** ¿Se puede ofrecer el débito automático? Solo con el token Y la clave de los avisos. */
export const mercadoPagoActivo = (env: Entorno = process.env) => Boolean(tokenDeMercadoPago(env) && secretoDelWebhook(env));

/** Cuánto se acepta que difiera el reloj de Mercado Pago del nuestro en un aviso: más que esto es un aviso repetido o armado de antes. */
export const TOLERANCIA_DE_AVISO_SEGUNDOS = 15 * 60;

/** La ruta que Mercado Pago llama cuando pasa algo (se carga en su panel: https://<dominio>/api/mercadopago/webhook). */
export const RUTA_DEL_WEBHOOK = "/api/mercadopago/webhook";

/** Los tipos de aviso que usamos (se activan en el panel de Mercado Pago, en Webhooks). */
export const AVISOS_QUE_USAMOS = ["subscription_preapproval", "subscription_authorized_payment"] as const;
export type TipoDeAviso = (typeof AVISOS_QUE_USAMOS)[number];

export const esAvisoQueUsamos = (tipo: unknown): tipo is TipoDeAviso =>
  typeof tipo === "string" && (AVISOS_QUE_USAMOS as readonly string[]).includes(tipo);
