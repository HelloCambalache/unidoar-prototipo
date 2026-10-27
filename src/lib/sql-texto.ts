import { sql, type AnyColumn, type SQL } from "drizzle-orm";

/*
 * Búsqueda de texto sin distinguir mayúsculas ni tildes: "natacion" encuentra "Natación",
 * "nunez" encuentra "Núñez". Usa translate() en vez de la extensión unaccent para no
 * depender de que esté instalada. Un solo lugar para que todos los buscadores se comporten igual.
 */

const CON_TILDE = "áéíóúüñÁÉÍÓÚÜÑ";
const SIN_TILDE = "aeiouunaeiouun";

/** Expresión SQL de una columna o texto, en minúsculas y sin tildes. */
export const plano = (expresion: SQL | AnyColumn) =>
  sql`lower(translate(${expresion}, ${CON_TILDE}, ${SIN_TILDE}))`;

/** El mismo recorte del lado de JS, para armar el patrón de búsqueda. */
export function textoPlano(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/** Escapa los comodines de LIKE (% _ \) para que el texto del usuario se busque literal. */
export function escaparLike(texto: string) {
  return texto.replace(/[\\%_]/g, "\\$&");
}

/** Las palabras de un texto de búsqueda (sin tildes, en minúsculas, hasta `max`): cada una tiene que aparecer en lo que se busca. */
export function palabrasDeBusqueda(texto: string, max = 6) {
  return textoPlano(texto).split(/\s+/).filter(Boolean).slice(0, max);
}

/** `columna contiene texto`, ignorando mayúsculas y tildes. */
export const contiene = (expresion: SQL | AnyColumn, texto: string) =>
  sql`${plano(expresion)} like ${`%${escaparLike(textoPlano(texto.trim()))}%`}`;
