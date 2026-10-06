"use client";

import { Input, Select } from "@/components/ui/campos";
import { useFiltrosUrl } from "@/components/docente/filtros-url";
import { cn } from "@/lib/utils";

/** Buscador, modalidad y "solo los que ya me inscribí": van a la URL, el listado lo arma el servidor. */
export function CursoFiltros({
  q,
  modalidad,
  soloInscripto,
}: {
  q: string;
  modalidad: string;
  soloInscripto: boolean;
}) {
  const { aplicar, aplicarConDemora, pendiente } = useFiltrosUrl();

  return (
    <div role="search" aria-busy={pendiente} className="mb-[18px] flex flex-wrap items-center gap-2.5">
      <Input
        type="search"
        aria-label="Buscar por curso o institución"
        placeholder="Buscar por curso o institución"
        defaultValue={q}
        onChange={(e) => aplicarConDemora("q", e.target.value)}
        className="min-w-[220px] max-w-[340px] flex-1"
      />
      <Select
        aria-label="Modalidad"
        defaultValue={modalidad}
        onChange={(e) => aplicar({ modalidad: e.target.value })}
        className="w-auto max-w-[190px]"
      >
        <option value="">Todas las modalidades</option>
        <option value="Presencial">Presencial</option>
        <option value="Online">Online</option>
      </Select>
      <button
        type="button"
        aria-pressed={soloInscripto}
        onClick={() => aplicar({ inscripto: soloInscripto ? "" : "1" })}
        className={cn(
          "inline-flex min-h-[42px] flex-none items-center gap-1.5 rounded-lg px-4 text-[13px] leading-none font-semibold whitespace-nowrap transition-colors focus-visible:ring-[3px] focus-visible:ring-navy-700/30 focus-visible:outline-none",
          soloInscripto
            ? "bg-navy-700 text-white hover:bg-navy-900"
            : "border border-borde bg-white text-tinta-2 hover:border-borde-fuerte hover:bg-superficie",
        )}
      >
        Solo los que ya me inscribí
      </button>
    </div>
  );
}
