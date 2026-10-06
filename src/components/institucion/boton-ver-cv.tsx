"use client";

import { Boton, BotonLink } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

/**
 * "Ver CV (PDF)": abre el archivo en otra pestaña. `cvUrl` ya viene firmada del servidor (los CV están en un
 * bucket privado); si no hay, avisa con `sinCv` (todavía no lo cargó, o no se pudo generar el enlace).
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
