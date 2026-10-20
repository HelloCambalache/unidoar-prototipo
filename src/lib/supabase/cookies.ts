/*
 * Cookies de sesión de Supabase. `@supabase/ssr` las escribe por defecto sin `secure` (viajarían también por http) y legibles por JavaScript
 * (`httpOnly: false`), y el servidor y el proxy las pasan por acá antes de guardarlas:
 * - `secure` en producción (en desarrollo, http://localhost, el navegador no las guardaría);
 * - `httpOnly`: ningún script de la página —uno propio con un error, o uno que alguien lograra inyectar— puede leer ni robar el token. Todo lo
 *   que necesita la sesión corre en el servidor (el proxy, las páginas y las acciones). El navegador ya no usa su cliente de Supabase para
 *   cerrar sesión (lo hace la acción `salir`) y la subida directa de un PDF grande va con un token que firma el servidor, sin sesión.
 *   Una cookie httpOnly no se puede borrar desde el navegador: por eso cerrar sesión es una acción de servidor.
 */
export function opcionesDeCookieDeSesion<T extends object>(
  options: T,
  produccion: boolean = process.env.NODE_ENV === "production",
): T & { secure: boolean; httpOnly: true } {
  return { ...options, secure: produccion, httpOnly: true };
}
