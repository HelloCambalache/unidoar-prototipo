import type { CategoriaDocente } from "@/db/schema";
import { CATEGORIAS, CATEGORIA_INFO } from "@/lib/catalogo";
import { CATEGORIA_ALTA } from "@/lib/onboarding";

/*
 * Un profesional puede ser de más de una categoría (2026-11-12, pedido del cliente: docente y entrenador, o entrenador y guardavidas, cada
 * una con sus disciplinas). `docentes.categoria` sigue siendo la PRINCIPAL (la que se eligió primero o la que quedó al quitar otra): da el
 * nombre del título que se pide, el subtítulo por defecto y es lo que lee todo lo que todavía habla de «la categoría» del perfil.
 * `docentes.categorias_extra` guarda las demás. Todo es puro (sin base ni Next) para poder probarlo.
 */

export type ConCategorias = { categoria: CategoriaDocente; categoriasExtra?: readonly CategoriaDocente[] | null };

const esCategoria = (v: unknown): v is CategoriaDocente => typeof v === "string" && (CATEGORIAS as readonly string[]).includes(v);

/** Todas las categorías del perfil: la principal primero y después las otras, sin repetir y en el orden del catálogo. */
export function categoriasDe(perfil: ConCategorias): CategoriaDocente[] {
  const extras = CATEGORIAS.filter((c) => c !== perfil.categoria && (perfil.categoriasExtra ?? []).includes(c));
  return [perfil.categoria, ...extras];
}

export const tieneCategoria = (perfil: ConCategorias, categoria: CategoriaDocente) => categoriasDe(perfil).includes(categoria);

export const MAX_CATEGORIAS = CATEGORIAS.length;

export type CategoriasElegidas = { categoria: CategoriaDocente; categoriasExtra: CategoriaDocente[] };

/**
 * Lo que se guarda a partir de las categorías que marcó la persona. Tiene que haber al menos una y no valen valores que no existan. La
 * principal es la que ya tenía, si la sigue teniendo; si no (alta nueva, o quitó la principal), la primera en el orden del catálogo.
 */
export function decidirCategorias(
  marcadas: readonly unknown[],
  principalActual?: CategoriaDocente | null,
): { ok: true; datos: CategoriasElegidas } | { ok: false; error: string } {
  if (marcadas.some((m) => !esCategoria(m))) return { ok: false, error: "Elegí una categoría de la lista." };
  const validas = new Set(marcadas as CategoriaDocente[]);
  if (validas.size === 0) return { ok: false, error: "Elegí qué sos." };
  const ordenadas = CATEGORIAS.filter((c) => validas.has(c));
  const categoria = principalActual && validas.has(principalActual) ? principalActual : ordenadas[0]!;
  return { ok: true, datos: { categoria, categoriasExtra: ordenadas.filter((c) => c !== categoria) } };
}

/** «Docente», «Docente · Guardavidas»: para tarjetas y fichas. */
export const etiquetaDeCategorias = (perfil: ConCategorias, campo: "label" | "plural" = "label") =>
  categoriasDe(perfil)
    .map((c) => CATEGORIA_INFO[c][campo])
    .join(" · ");

/**
 * Qué título o credencial se le pide a la persona, según sus categorías. Con una sola es el de esa categoría; con varias se pide uno por
 * cada categoría (cada archivo se sube por separado) y el texto los nombra.
 */
export function credencialesQueSePiden(perfil: ConCategorias): { nombre: string; vacio: string; corto: string } {
  const categorias = categoriasDe(perfil);
  if (categorias.length === 1) return CATEGORIA_ALTA[categorias[0]!].credencial;
  const nombres = categorias.map((c) => CATEGORIA_ALTA[c].credencial.nombre);
  return {
    nombre: "Títulos y credenciales",
    vacio: `Uno por cada categoría: ${nombres.join(", ").replace(/, ([^,]*)$/, " y $1")}`,
    corto: "La institución los valida al contratarte",
  };
}
