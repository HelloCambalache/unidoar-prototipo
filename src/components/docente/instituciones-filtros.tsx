"use client";

import { useState } from "react";
import { Input, Select } from "@/components/ui/campos";
import { useFiltrosUrl } from "@/components/docente/filtros-url";
import { TIPOS_INSTITUCION } from "@/lib/catalogo";
import { cn } from "@/lib/utils";

export type ValoresFiltroInstituciones = { q: string; tipo: string; zona: string; favoritas: boolean };

/**
 * Buscador, tipo, zona y "solo favoritas". Todo va a la URL (el listado lo renderiza el servidor).
 * Los campos son no controlados: "Limpiar" los reinicia cambiando su `key`.
 */
export function InstitucionesFiltros({
  valores,
  zonas,
}: {
  valores: ValoresFiltroInstituciones;
  zonas: string[];
}) {
  const { aplicar, aplicarConDemora, pendiente } = useFiltrosUrl();
  const [reinicio, setReinicio] = useState(0);
  const hayFiltros = !!(valores.q || valores.tipo || valores.zona || valores.favoritas);

  return (
    <div role="search" aria-busy={pendiente} className="mb-5 flex flex-wrap items-center gap-2.5">
      <Input
        key={`q${reinicio}`}
        type="search"
        aria-label="Buscar por nombre"
        placeholder="Buscar por nombre"
        defaultValue={valores.q}
        onChange={(e) => aplicarConDemora("q", e.target.value)}
        className="min-w-[220px] flex-1"
      />
      <Select
        key={`t${reinicio}`}
        aria-label="Tipo de institución"
        defaultValue={valores.tipo}
        onChange={(e) => aplicar({ tipo: e.target.value })}
        className="w-auto max-w-[190px]"
      >
        <option value="">Todos los tipos</option>
        {TIPOS_INSTITUCION.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </Select>
      <Select
        key={`z${reinicio}`}
        aria-label="Zona"
        defaultValue={valores.zona}
        onChange={(e) => aplicar({ zona: e.target.value })}
        className="w-auto max-w-[170px]"
      >
        <option value="">Todas las zonas</option>
        {zonas.map((z) => (
          <option key={z} value={z}>
            {z}
          </option>
        ))}
      </Select>
      <button
        type="button"
        aria-pressed={valores.favoritas}
        onClick={() => aplicar({ favoritas: valores.favoritas ? "" : "1" })}
        className={cn(
          "inline-flex min-h-[42px] items-center gap-1.5 rounded-lg px-4 text-sm leading-none font-semibold transition-colors focus-visible:ring-[3px] focus-visible:ring-navy-700/30 focus-visible:outline-none",
          valores.favoritas
            ? "bg-navy-700 text-white hover:bg-navy-900"
            : "border border-borde bg-white text-tinta-2 hover:border-borde-fuerte hover:bg-superficie",
        )}
      >
        <span aria-hidden>★</span> Favoritas
      </button>
      {hayFiltros && (
        <button
          type="button"
          onClick={() => {
            setReinicio((n) => n + 1);
            aplicar({ q: "", tipo: "", zona: "", favoritas: "" });
          }}
          className="px-1 text-[13px] font-medium text-apagado underline-offset-2 hover:text-tinta hover:underline"
        >
          Limpiar filtros
        </button>
      )}
    </div>
  );
}
