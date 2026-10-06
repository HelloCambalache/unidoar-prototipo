"use client";

import { useRouter } from "next/navigation";
import { Icono } from "@/components/icons";

/**
 * Flecha de volver. Vuelve en el historial (así se conservan los filtros del buscador o de la base); si la
 * pestaña se abrió directo en este perfil, no hay a dónde volver y va a `fallback`.
 */
export function BotonVolver({ fallback }: { fallback: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      aria-label="Volver"
      onClick={() => {
        if (window.history.length > 1) router.back();
        else router.push(fallback);
      }}
      className="inline-flex size-[30px] flex-none items-center justify-center rounded-full border border-borde bg-white text-tinta-2 shadow-[0_1px_2px_rgba(31,36,33,.06)] transition-colors hover:border-borde-fuerte hover:bg-[#F0EFEA] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-navy-700/30"
    >
      <Icono nombre="flecha" tamano={16} trazo={2} className="rotate-180" />
    </button>
  );
}
