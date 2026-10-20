"use client";

import { Boton, BotonLink } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

/**
 * "Ver CV (PDF)": abre el archivo en otra pestaña. `cvUrl` es la ruta del servidor que comprueba que se pueda ver y firma el
 * enlace (los CV están en un bucket privado); si no hay, avisa con `sinCv` (todavía no lo cargó, no se habilitó o no se pudo abrir).
 */
export function BotonVerCv({ cvUrl, sinCv }: { cvUrl: string | null; sinCv: string }) {
  const toast = useToast();
  if (cvUrl) {
    return (
      <BotonLink href={cvUrl} target="_blank" rel="noopener noreferrer" variante="secundario" bloque>
        Ver CV (PDF)
      </BotonLink>
    );
  }
  return (
    <Boton variante="secundario" bloque onClick={() => toast(sinCv, "info")}>
      Ver CV (PDF)
    </Boton>
  );
}
