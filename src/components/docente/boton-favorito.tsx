"use client";

import { useOptimistic, useTransition } from "react";
import { alternarFavoritoOferta } from "@/app/actions/postulaciones";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

/** Estrella de favorito de una búsqueda. Responde al instante y se corrige sola si la acción falla. */
export function BotonFavorito({
  busquedaId,
  favorita,
  puesto,
  className,
}: {
  busquedaId: string;
  favorita: boolean;
  puesto: string;
  className?: string;
}) {
  const [, empezar] = useTransition();
  const [guardada, setGuardada] = useOptimistic(favorita);
  const toast = useToast();

  const alternar = () =>
    empezar(async () => {
      setGuardada(!guardada);
      const resultado = await alternarFavoritoOferta(busquedaId);
      if (!resultado.ok) toast(resultado.error, "error");
    });

  return (
    <button
      type="button"
      onClick={alternar}
      aria-pressed={guardada}
      aria-label={guardada ? `Quitar de favoritos: ${puesto}` : `Guardar en favoritos: ${puesto}`}
      title={guardada ? "Quitar de favoritos" : "Guardar en favoritos"}
      className={cn(
        "relative z-10 flex-none rounded-md px-1 text-base leading-none transition-colors focus-visible:ring-[3px] focus-visible:ring-navy-700/30 focus-visible:outline-none",
        guardada ? "text-[#F0B400]" : "text-[#D8D6CE] hover:text-[#F0B400]/70",
        className,
      )}
    >
      ★
    </button>
  );
}
