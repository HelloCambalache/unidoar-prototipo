import { MANUALES_PUBLICOS, articulosDe, rutaDeArticulo, rutaDeManual } from "@/lib/ayuda";
import { debeNoIndexarse } from "@/lib/indexacion";
import { PAGINAS } from "@/lib/seo";

/*
 * Las páginas fijas del sitemap (las que existen siempre). Salen de las mismas tablas que arman el título y la canónica de cada página
 * (`PAGINAS`, `src/lib/seo.ts`) y del Centro de ayuda, así una página nueva con su fila en `PAGINAS` entra sola y no hay una segunda lista que
 * mantener. Las instituciones y las búsquedas abiertas se leen de la base (`src/lib/queries/sitemap.ts`).
 */

/** Rutas fijas, sin repetir y en el orden de `PAGINAS` (primero lo principal), más los manuales públicos de ayuda y sus guías. */
export function rutasFijasDelSitemap(): string[] {
  const rutas = new Set<string>();
  for (const pagina of Object.values(PAGINAS)) rutas.add(pagina.ruta);
  for (const manual of MANUALES_PUBLICOS) {
    rutas.add(rutaDeManual(manual.perfil));
    for (const articulo of articulosDe(manual)) rutas.add(rutaDeArticulo(manual.perfil, articulo.slug));
  }
  return [...rutas].filter((ruta) => !debeNoIndexarse(ruta));
}
