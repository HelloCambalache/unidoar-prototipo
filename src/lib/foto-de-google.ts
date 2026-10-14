/*
 * Reglas para traer la foto de perfil de una cuenta de Google (puras, sin red: se prueban solas).
 *
 * Con Google la foto llega como una dirección (`avatar_url` / `picture`) en los datos de la cuenta. Esos datos los puede escribir
 * cualquiera al registrarse con email (`signUp({ data })`), así que no son de fiar: guardar esa dirección tal cual haría que el
 * navegador de cada institución cargue una imagen de un servidor ajeno (que ve su IP y puede mostrar lo que quiera). En cambio el
 * servidor la descarga, solo si es de los servidores de fotos de Google, y guarda una copia en nuestro Storage.
 */

/** Los servidores de fotos de perfil de Google (lh3, lh4, lh5, lh6). Nada más. */
const SERVIDOR_DE_FOTOS = /^lh[3-6]\.googleusercontent\.com$/;

/** Lado, en píxeles, de la copia que se pide: de sobra para un avatar y la foto del perfil, y pesa poco. */
export const LADO_DE_LA_FOTO = 400;

/** Cuánto puede pesar lo que se descarga: una foto de ese lado pesa decenas de KB; esto corta cualquier otra cosa. */
export const LIMITE_FOTO_DE_GOOGLE = 1024 * 1024;

/**
 * Devuelve la dirección lista para descargar (la misma foto, en el tamaño que usamos) o null si no es una foto de Google:
 * tiene que ser https, de uno de los servidores de fotos, sin usuario, clave ni puerto.
 */
export function urlDeFotoDeGoogle(valor: string | null | undefined): string | null {
  if (typeof valor !== "string" || valor.length === 0 || valor.length > 400) return null;
  let url: URL;
  try {
    url = new URL(valor.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || !SERVIDOR_DE_FOTOS.test(url.hostname)) return null;
  if (url.username || url.password || url.port) return null;
  if (url.pathname.length < 2 || url.pathname.includes("..")) return null;
  // El tamaño va al final del camino: "…/ACg8oc…=s96-c" → "…=s400-c". Sin tamaño, se lo agrega.
  const camino = /=[^/=]*$/.test(url.pathname) ? url.pathname.replace(/=[^/=]*$/, `=s${LADO_DE_LA_FOTO}-c`) : `${url.pathname}=s${LADO_DE_LA_FOTO}-c`;
  return `${url.protocol}//${url.hostname}${camino}`;
}
