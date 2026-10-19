import type { Metadata } from "next";
import type { CategoriaDocente } from "@/db/schema";
import { CATEGORIAS_PUBLICAS } from "./categorias";

/**
 * Metadatos de la página de una categoría (/educadores, /entrenadores, /guardavidas): título y descripción propios,
 * la dirección canónica y la vista previa al compartir. Repite lo que el layout ya define de `openGraph` porque Next no
 * lo mezcla: lo que se declara en una página reemplaza el objeto entero.
 */
export function metadatosDeCategoria(categoria: CategoriaDocente, titulo: string, descripcion: string): Metadata {
  const ruta = CATEGORIAS_PUBLICAS[categoria].ruta;
  return {
    title: titulo,
    description: descripcion,
    alternates: { canonical: ruta },
    openGraph: {
      type: "website",
      locale: "es_AR",
      siteName: "UNIDOAR",
      title: `${titulo} · UNIDOAR`,
      description: descripcion,
      url: ruta,
    },
  };
}
