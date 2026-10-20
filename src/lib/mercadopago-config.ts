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

/** ¿Se puede ofrecer el débito automático? Alcanza con el token. */
export const mercadoPagoActivo = (env: Entorno = process.env) => Boolean(tokenDeMercadoPago(env));

/** Cuánto se acepta que difiera el reloj de Mercado Pago del nuestro en un aviso: más que esto es un aviso repetido o armado de antes. */
export const TOLERANCIA_DE_AVISO_SEGUNDOS = 15 * 60;

/** La ruta que Mercado Pago llama cuando pasa algo (se carga en su panel: https://<dominio>/api/mercadopago/webhook). */
export const RUTA_DEL_WEBHOOK = "/api/mercadopago/webhook";

/** Los tipos de aviso que usamos (se activan en el panel de Mercado Pago, en Webhooks). */
export const AVISOS_QUE_USAMOS = ["subscription_preapproval", "subscription_authorized_payment"] as const;
export type TipoDeAviso = (typeof AVISOS_QUE_USAMOS)[number];

export const esAvisoQueUsamos = (tipo: unknown): tipo is TipoDeAviso =>
  typeof tipo === "string" && (AVISOS_QUE_USAMOS as readonly string[]).includes(tipo);
