import { createHmac, timingSafeEqual } from "node:crypto";

/*
 * "Elegir una contraseña nueva" sin la actual solo vale para quien llegó por el enlace del mail de recuperación. Ese enlace deja una
 * cookie de corta vida y la pantalla y la acción la exigen. Sin esto, cualquiera con una sesión abierta de otra persona (una computadora
 * compartida) podía fijar una contraseña nueva entrando directo a /ingresar/nueva-contrasena, y esa contraseña después pasa el pedido de
 * "contraseña actual" de Mi cuenta.
 *
 * La cookie no vale "1": lleva cuándo vence y una firma HMAC atada a ESA cuenta. Antes alcanzaba con que existiera, y como el navegador
 * deja crear cualquier cookie con `document.cookie` (o mandarla a mano en un pedido), quien tuviera la sesión de otra persona la fabricaba
 * en un segundo. Ahora solo la puede emitir el servidor, con su secreto, y solo vale para la cuenta que abrió el enlace.
 * Sin base ni Next: lo usan las rutas, la página, la acción y las pruebas.
 */

export const COOKIE_RECUPERACION = "unidoar_recuperacion";
/** Cuánto dura el permiso: lo justo para elegir la contraseña nueva. */
export const VIDA_RECUPERACION_SEGUNDOS = 15 * 60;

export const RUTA_NUEVA_CONTRASENA = "/ingresar/nueva-contrasena";

/** ¿Este destino es la pantalla de elegir la contraseña nueva? (el enlace viejo de Supabase la pide por `next`) */
export const esRutaDeRecuperacion = (ruta: string) => ruta === RUTA_NUEVA_CONTRASENA || ruta.startsWith(`${RUTA_NUEVA_CONTRASENA}?`);

/* ───────────────────────────── Firma del permiso ───────────────────────────── */

/** Separa esta firma de las otras que usan el mismo secreto (ubicaciones, bajas de avisos): una no sirve de la otra. */
const CONTEXTO = "unidoar:recuperacion:v1:";

type Entorno = Record<string, string | undefined>;

function secreto(env: Entorno) {
  const s = env.CORREO_SECRETO?.trim() || env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  return s && s.length >= 16 ? s : null;
}

const firmar = (usuarioId: string, vence: number, clave: string) =>
  createHmac("sha256", clave).update(`${CONTEXTO}${usuarioId}.${vence}`).digest("base64url");

/**
 * El valor de la cookie para esta cuenta: `<cuándo vence, en milisegundos>.<firma>`. Devuelve null si el servidor no tiene secreto: sin él
 * no se emite ningún permiso (falla cerrado: la persona ve "El enlace venció" y pide otro).
 */
export function firmarRecuperacion(usuarioId: string, env: Entorno = process.env, ahora = Date.now()): string | null {
  const clave = secreto(env);
  if (!clave || !usuarioId) return null;
  const vence = ahora + VIDA_RECUPERACION_SEGUNDOS * 1000;
  return `${vence}.${firmar(usuarioId, vence, clave)}`;
}

/** ¿El valor de la cookie es un permiso de recuperación emitido por el servidor, para ESTA cuenta, y todavía vigente? */
export function recuperacionVigente(
  valor: string | null | undefined,
  usuarioId: string | null | undefined,
  env: Entorno = process.env,
  ahora = Date.now(),
): boolean {
  const clave = secreto(env);
  if (!clave || !valor || !usuarioId) return false;
  const partes = valor.split(".");
  if (partes.length !== 2) return false;
  const [venceTexto, firma] = partes as [string, string];
  if (!/^\d{10,16}$/.test(venceTexto)) return false;
  const vence = Number(venceTexto);
  // Vigente: no venció, y no vence más lejos de lo que dura un permiso (con un margen por relojes desfasados).
  if (ahora >= vence || vence - ahora > (VIDA_RECUPERACION_SEGUNDOS + 60) * 1000) return false;
  const esperada = Buffer.from(firmar(usuarioId, vence, clave));
  const recibida = Buffer.from(firma);
  return recibida.length === esperada.length && timingSafeEqual(recibida, esperada);
}
