/*
 * Aceptación de los términos y condiciones: qué versión rige y cómo se transporta la constancia desde el momento en que
 * la persona tilda la casilla hasta que existe su fila `usuarios`. Sin acceso a base ni a Next.
 */

/** Versión vigente de /terminos. Cambia cuando se actualiza el texto: ahí hay que pedir una nueva aceptación. */
export const VERSION_TERMINOS = "2026-10";
/** Lo que dice la página de términos como "Última actualización". */
export const TERMINOS_ACTUALIZADOS = "octubre de 2026";
/** Lo mismo para la política de privacidad (/privacidad). */
export const PRIVACIDAD_ACTUALIZADA = "octubre de 2026";

/** Cookie de corta vida que lleva la aceptación del docente que se registra con Google (no hay otro medio de pasarla). */
export const COOKIE_TERMINOS = "unidoar_terminos";
export const VIDA_COOKIE_TERMINOS_SEGUNDOS = 60 * 60;
/** Una constancia en cookie más vieja que esto no se toma en cuenta. */
export const EDAD_MAXIMA_COOKIE_MS = 2 * 60 * 60 * 1000;

export type AceptacionDeTerminos = { version: string; en: Date };

/** "2026-09|2026-10-07T15:00:00.000Z": la versión que se aceptó y el momento exacto. */
export function codificarAceptacion(ahora = new Date(), version = VERSION_TERMINOS) {
  return `${version}|${ahora.toISOString()}`;
}

/**
 * Lee lo que dejó `codificarAceptacion`. Devuelve null si no tiene esa forma, si la fecha no existe, si es del futuro
 * (con 5 minutos de margen por diferencia de relojes) o, cuando se pide, si es más vieja que `edadMaximaMs`.
 */
export function decodificarAceptacion(
  valor: unknown,
  opciones: { ahora?: Date; edadMaximaMs?: number } = {},
): AceptacionDeTerminos | null {
  if (typeof valor !== "string") return null;
  const coincide = /^(\d{4}-\d{2})\|(\d{4}-\d{2}-\d{2}T[\d:.]+Z)$/.exec(valor);
  if (!coincide) return null;
  const en = new Date(coincide[2]!);
  if (Number.isNaN(en.getTime())) return null;
  const ahora = (opciones.ahora ?? new Date()).getTime();
  if (en.getTime() > ahora + 5 * 60 * 1000) return null;
  if (opciones.edadMaximaMs !== undefined && ahora - en.getTime() > opciones.edadMaximaMs) return null;
  return { version: coincide[1]!, en };
}
