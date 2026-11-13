/*
 * Qué páginas puede mostrar un buscador (Google, Bing…) y cuáles no. Código puro, sin base ni Next: lo usan el proxy (que pone la cabecera
 * `X-Robots-Tag` a lo que no se indexa), `robots.ts` y `sitemap.ts`, y tiene su prueba.
 *
 * El sitio entero estaba con `noindex` mientras era un entorno de prueba (2026-11-13: se abrió al público). Ahora se indexa todo lo público y
 * solo se marca como «no indexar» lo que no le sirve a nadie en un buscador: las áreas con cuenta, el ingreso, las invitaciones y los pasos
 * de confirmación. Las páginas que arman su propia política (el perfil compartido `/profesional/<token>`, `/avisos/baja`, `/auth/confirmar`)
 * siguen con su `noindex` en la propia página.
 */

const DIRECCION_POR_DEFECTO = "https://www.unidoar.com.ar";

/**
 * Rutas que nunca se indexan. No se prohíben en `robots.txt` a propósito: WhatsApp, Facebook y LinkedIn leen `robots.txt` para armar la vista previa
 * de un enlace, y un enlace compartido a `/docente/oportunidades` llega al ingreso (ver `paginaDeIngreso`, `src/lib/seo.ts`). Prohibirlas
 * apagaría esas vistas previas; `noindex` alcanza para que no figuren en un buscador.
 */
const SIN_INDEXAR: RegExp[] = [
  /^\/(docente|institucion|backoffice|app)(\/|$)/,
  /^\/onboarding(\/|$)/,
  /^\/ingresar(\/|$)/,
  /^\/(invitacion|auth|referido|inicio|cuenta-suspendida|cuenta-del-equipo)(\/|$)/,
];

/** El primer paso del alta (el registro) es público y tiene su propia página para buscadores: se indexa aunque cuelgue de `/onboarding`. */
const PASO_1_DEL_ALTA = /^\/onboarding\/(docente|institucion)\/1\/?$/;

/** Lo que va en la cabecera `X-Robots-Tag` de una página que no se indexa. */
export const CABECERA_NO_INDEXAR = "noindex, nofollow";

/** ¿Esta ruta (sin parámetros) tiene que salir con `noindex`? */
export function debeNoIndexarse(pathname: string): boolean {
  if (PASO_1_DEL_ALTA.test(pathname)) return false;
  return SIN_INDEXAR.some((r) => r.test(pathname));
}

/** Rutas que `robots.txt` pide no recorrer: solo lo que no es una página (las funciones internas) y los enlaces de confirmación. */
export const RUTAS_PROHIBIDAS_A_ROBOTS = ["/api/", "/auth/"];

/** La dirección del sitio (solo el origen, sin barra final): `NEXT_PUBLIC_SITE_URL` o la de producción. Nunca lanza. */
export function urlDelSitio(valor: string | undefined = process.env.NEXT_PUBLIC_SITE_URL): string {
  try {
    return new URL(valor?.trim() || DIRECCION_POR_DEFECTO).origin;
  } catch {
    return DIRECCION_POR_DEFECTO;
  }
}

/** Una ruta del sitio como dirección completa: `/planes` → `https://www.unidoar.com.ar/planes`. */
export const urlAbsoluta = (ruta: string, base: string = urlDelSitio()): string => new URL(ruta, `${base}/`).toString();
