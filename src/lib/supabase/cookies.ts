/*
 * Cookies de sesión de Supabase. `@supabase/ssr` las escribe sin `secure` (viajarían también por http si alguien entra a una dirección sin
 * https) y el servidor y el proxy las pasan por acá antes de guardarlas. En desarrollo (http://localhost) no se marcan `secure`: el navegador
 * no las guardaría. Siguen siendo legibles por JavaScript (`httpOnly: false`) porque el navegador usa el cliente de Supabase para
 * cerrar sesión; sacar esa dependencia y volverlas httpOnly es el paso que sigue (ver CLAUDE.md, "Seguridad").
 */
export function opcionesDeCookieDeSesion<T extends object>(
  options: T,
  produccion: boolean = process.env.NODE_ENV === "production",
): T & { secure: boolean } {
  return { ...options, secure: produccion };
}
