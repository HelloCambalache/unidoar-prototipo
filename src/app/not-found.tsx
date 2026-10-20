import type { Metadata } from "next";
import LayoutPublico from "./(publico)/layout";
import NoEncontrada from "./(publico)/not-found";

export const metadata: Metadata = { title: "Página no encontrada" };

/**
 * La 404 de una dirección que no existe en ningún lado (la de `(publico)/not-found.tsx` solo se usa cuando una página pública llama a
 * `notFound()`). Lleva el mismo marco del sitio público —cabecera y pie— y el mismo mensaje, así nadie queda en una pantalla sin salida.
 * La cabecera consulta la sesión, así que la página se arma en cada visita y puede llevar el nonce de la política de contenido (la 404
 * genérica de Next se generaba en el build, sin nonce: con la política aplicada salía sin JavaScript y con errores en la consola).
 */
export default function PaginaNoEncontrada() {
  return (
    <LayoutPublico>
      <NoEncontrada />
    </LayoutPublico>
  );
}
