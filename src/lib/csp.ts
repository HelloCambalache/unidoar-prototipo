/*
 * Política de contenido (CSP) con nonce, para frenar el XSS: aunque alguien lograra meter un <script> en una página, el navegador no lo
 * ejecuta si no lleva el nonce de ESE pedido (un valor al azar que solo conoce el servidor). Sigue la guía de Next
 * (node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md): el proxy genera el nonce, lo manda en la cabecera del pedido
 * (Next lo pone solo en sus scripts) y en la de la respuesta.
 *
 * Dos modos (variable `CSP_MODO`):
 * - "solo-avisar" (el de siempre hasta que se active el otro): `Content-Security-Policy-Report-Only`. El navegador NO bloquea nada: solo anota
 *   en su consola lo que bloquearía. Sirve para recorrer el sitio y ver si falta permitir algo (un mapa, una imagen) antes de activarla.
 * - "aplicar": `Content-Security-Policy`: bloquea de verdad.
 *
 * Qué permite y por qué:
 * - scripts: solo los de este sitio con el nonce, y los que ellos carguen (`strict-dynamic`). Sin `unsafe-inline`: ese es el punto.
 * - estilos: `unsafe-inline`. El sitio usa muchos `style="…"` (colores por categoría, fondos con foto) y un estilo inyectado no ejecuta código;
 *   el riesgo que importa es el de los scripts.
 * - imágenes: el sitio, `data:` y `blob:` (las fotos se achican en el navegador antes de subirse), los mosaicos del mapa (OpenStreetMap), el
 *   Storage de Supabase (logos, portadas, galerías) y las fotos de Google de las cuentas viejas.
 * - conexiones: el sitio y Supabase (la subida directa de un PDF grande va a una URL firmada de Storage).
 * - nada de plugins (`object-src`), marcos (`frame-src`) ni `<base>` ajeno (`base-uri`). `frame-ancestors` (que nadie nos enmarque) ya sale
 *   siempre, sin nonce, desde next.config.ts.
 * Puro (sin base ni Next): se prueba solo.
 */

export type ModoDeCsp = "solo-avisar" | "aplicar";

type Entorno = Record<string, string | undefined>;

/** "aplicar" solo si la variable lo dice exactamente: ante cualquier otra cosa, no se bloquea nada. */
export const modoDeCsp = (env: Entorno = process.env): ModoDeCsp => (env.CSP_MODO === "aplicar" ? "aplicar" : "solo-avisar");

type Par = [nombre: string, valor: string];

/**
 * Las cabeceras de una página según el modo. `delPedido` es lo que lee Next para poner el nonce en sus scripts; `deLaRespuesta` es lo que
 * ve el navegador.
 *
 * **Nunca puede haber una `Content-Security-Policy` sin nonce en el modo "solo-avisar".** Next copia al PEDIDO las cabeceras que devuelve
 * el proxy y saca el nonce de la primera que encuentra: `content-security-policy` antes que `-report-only`. Una cabecera fija (la que estaba en
 * next.config.ts, o una puesta desde el proxy) tapa a la del nonce y los scripts salen sin él: se vio en producción el 2026-10-20 con la de
 * next.config.ts (en local andaba, porque ahí las de la configuración no llegan al pedido; una puesta desde el proxy sí lo tapaba). Por eso, mientras la política solo
 * avisa, `frame-ancestors` queda cubierto por `X-Frame-Options: DENY` (next.config.ts) y `base-uri` / `object-src` solo se avisan; en el modo
 * "aplicar" van adentro de la única política (`frame-ancestors` no se acepta en una que solo avisa).
 */
export function cabecerasDeCsp(modo: ModoDeCsp, politica: string): { delPedido: Par[]; deLaRespuesta: Par[] } {
  if (modo === "aplicar") {
    return {
      delPedido: [["content-security-policy", politica]],
      deLaRespuesta: [["Content-Security-Policy", `${politica}; frame-ancestors 'none'`]],
    };
  }
  return {
    delPedido: [["content-security-policy-report-only", politica]],
    deLaRespuesta: [["Content-Security-Policy-Report-Only", politica]],
  };
}

/** Un valor al azar nuevo para cada pedido (base64 de un UUID, como en la guía de Next). */
export const nuevoNonce = () => Buffer.from(crypto.randomUUID()).toString("base64");

/** El origen (https://xxxx.supabase.co) de una URL, o null si no es una URL. */
function origenDe(url: string | undefined): string | null {
  try {
    return url ? new URL(url).origin : null;
  } catch {
    return null;
  }
}

/** El texto de la política para un pedido con ese nonce. En desarrollo suma `unsafe-eval` (React lo usa para sus mensajes de error). */
export function politicaDeContenido(nonce: string, { supabaseUrl, desarrollo = false }: { supabaseUrl?: string; desarrollo?: boolean } = {}): string {
  const supabase = origenDe(supabaseUrl);
  const lista = (...fuentes: (string | null)[]) => fuentes.filter(Boolean).join(" ");
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${desarrollo ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src ${lista("'self'", "data:", "blob:", "https://tile.openstreetmap.org", "https://*.googleusercontent.com", supabase)}`,
    "font-src 'self' data:",
    `connect-src ${lista("'self'", supabase)}`,
    "object-src 'none'",
    "base-uri 'self'",
    "frame-src 'none'",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
  ].join("; ");
}
