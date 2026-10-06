"use client";

import { useState } from "react";
import { useFiltrosUrl } from "@/components/docente/filtros-url";
import { Select } from "@/components/ui/campos";
import { PERIODO_POR_DEFECTO, type PeriodoClave } from "@/lib/backoffice-operacion";

/** Selector de período de Operación: vive en la URL (?periodo=), así el tablero se puede compartir. */
export function OpSelectorPeriodo({
  actual,
  opciones,
}: {
  actual: PeriodoClave;
  opciones: { clave: PeriodoClave; etiqueta: string }[];
}) {
  const { aplicar, pendiente } = useFiltrosUrl();
  const [valor, setValor] = useState<string>(actual);
  return (
    <Select
      aria-label="Período"
      aria-busy={pendiente}
      value={valor}
      className="max-w-[190px]"
      onChange={(e) => {
        setValor(e.target.value);
        aplicar({ periodo: e.target.value === PERIODO_POR_DEFECTO ? "" : e.target.value });
      }}
    >
      {opciones.map((o) => (
        <option key={o.clave} value={o.clave}>
          {o.etiqueta}
        </option>
      ))}
    </Select>
  );
}
