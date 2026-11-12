import "server-only";
import { or, sql, type SQL } from "drizzle-orm";
import { docentes, type CategoriaDocente } from "@/db/schema";

/*
 * Un profesional puede tener varias categorías: `docentes.categoria` (la principal) y `docentes.categorias_extra` (las demás). Toda consulta
 * que pregunta «¿es de esta categoría?» pasa por acá en vez de comparar `docentes.categoria` a secas: si no, quien es docente Y guardavidas
 * dejaría de aparecer en lo de guardavidas. Las reglas que no necesitan la base están en src/lib/categorias-docente.ts.
 */

/** El perfil es de esta categoría: la principal o una de las otras. */
export const esDeCategoria = (categoria: CategoriaDocente): SQL =>
  sql`(${docentes.categoria} = ${categoria} or ${categoria}::categoria_docente = any(${docentes.categoriasExtra}))`;

/** El perfil es de alguna de estas categorías (sin categorías, no filtra). */
export function esDeAlgunaCategoria(categorias: readonly CategoriaDocente[]): SQL | undefined {
  return categorias.length > 0 ? or(...categorias.map(esDeCategoria)) : undefined;
}
