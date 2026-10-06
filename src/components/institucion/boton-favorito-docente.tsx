"use client";

import { useOptimistic, useTransition } from "react";
import { alternarFavorito } from "@/app/actions/profesionales";
import { Boton } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

/**
 * Guardar / quitar de favoritos. `estrella` es el ★ de las tarjetas; `boton` es el botón del perfil.
 * La estrella cambia al toque (optimista) y vuelve sola a lo que diga la base si la acción falla.
 */
export function BotonFavoritoDocente({
  docenteId,
  nombre,
  favorito,
  variante = "estrella",
}: {
  docenteId: string;
  nombre: string;
  favorito: boolean;
  variante?: "estrella" | "boton";
}) {
  const toast = useToast();
  const [esFavorito, setEsFavorito] = useOptimistic(favorito);
  const [, empezar] = useTransition();

  const alternar = () =>
    empezar(async () => {
      setEsFavorito(!esFavorito);
      const r = await alternarFavorito(docenteId);
      if (r.ok) toast(r.data.favorito ? "Guardado en tus favoritos" : "Quitado de favoritos");
      else toast(r.error, "error");
    });

  if (variante === "boton") {
    return (
      <Boton
        variante="secundario"
        bloque
        aria-pressed={esFavorito}
        onClick={alternar}
        className={cn(esFavorito && "border-[#F0C89A] bg-[#FDE9D8] text-[#9A4A12] hover:border-[#F0C89A] hover:bg-[#FDE9D8]")}
      >
        {esFavorito ? "★ En tus favoritos" : "Guardar en favoritos"}
      </Boton>
    );
  }

  return (
    <button
      type="button"
      aria-pressed={esFavorito}
      aria-label={esFavorito ? `Quitar a ${nombre} de favoritos` : `Guardar a ${nombre} en favoritos`}
      onClick={alternar}
      className={cn(
        "flex-none rounded text-[17px] leading-none transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-navy-700/30",
        esFavorito ? "text-[#F0B400]" : "text-[#D8D6CE] hover:text-[#C9C6C0]",
      )}
    >
      ★
    </button>
  );
}
