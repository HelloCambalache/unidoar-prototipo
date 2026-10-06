"use client";

import { Campo, Select } from "@/components/ui/campos";
import { EtiquetaSeccion } from "@/components/ui/tarjeta";
import { EstadoVacio } from "@/components/app/estado-vacio";
import { cn } from "@/lib/utils";
import { useState } from "react";

/**
 * Asignaturas del docente: primero el rubro, después la asignatura de ese rubro (catálogo de la tabla
 * `asignaturas`). Al elegir una se suma sola y el desplegable vuelve al placeholder, así se pueden agregar
 * varias del mismo rubro. Cada elegida viaja en el formulario como un input `nombre` oculto.
 */
export function SelectorAsignaturas({
  grupos,
  elegidas,
  onCambio,
  nombre = "asignaturas",
  error,
}: {
  grupos: { rubro: string; items: string[] }[];
  elegidas: string[];
  onCambio: (siguientes: string[]) => void;
  nombre?: string;
  error?: string;
}) {
  const [rubro, setRubro] = useState("");
  const grupo = grupos.find((g) => g.rubro === rubro);
  const libres = grupo?.items.filter((i) => !elegidas.includes(i)) ?? [];

  const agregar = (asignatura: string) => {
    if (asignatura && !elegidas.includes(asignatura)) onCambio([...elegidas, asignatura]);
  };

  return (
    <div>
      <div className="mb-5 flex gap-3 max-[640px]:flex-col max-[640px]:gap-3.5">
        <Campo etiqueta="Rubro" className="min-w-0 flex-1">
          <Select value={rubro} onChange={(e) => setRubro(e.target.value)}>
            <option value="">Elegí un rubro</option>
            {grupos.map((g) => (
              <option key={g.rubro} value={g.rubro}>
                {g.rubro}
              </option>
            ))}
          </Select>
        </Campo>
        <Campo etiqueta="Asignatura o disciplina" className="min-w-0 flex-1" error={error}>
          <Select
            value=""
            disabled={!grupo || libres.length === 0}
            onChange={(e) => agregar(e.target.value)}
            aria-invalid={Boolean(error)}
          >
            <option value="">
              {!grupo ? "Primero elegí un rubro" : libres.length === 0 ? "Ya sumaste todas las de este rubro" : "Elegí una asignatura"}
            </option>
            {libres.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </Select>
        </Campo>
      </div>

      <EtiquetaSeccion>Lo que elegiste</EtiquetaSeccion>
      {elegidas.length === 0 ? (
        <EstadoVacio
          titulo="Todavía no elegiste ninguna"
          texto="Elegí un rubro y después la asignatura."
          className="mb-[26px] rounded-[10px] border-[#CFCCC5] px-5 py-5"
        />
      ) : (
        <ul className={cn("m-0 mb-[26px] flex list-none flex-wrap gap-2 p-0")}>
          {elegidas.map((a) => (
            <li key={a}>
              <input type="hidden" name={nombre} value={a} />
              <button
                type="button"
                onClick={() => onCambio(elegidas.filter((x) => x !== a))}
                aria-label={`Quitar ${a}`}
                className="cursor-pointer rounded-full bg-navy-700 px-4 py-2.5 text-sm leading-none font-medium text-white transition-colors hover:bg-navy-900 focus-visible:ring-[3px] focus-visible:ring-navy-700/30 focus-visible:outline-none"
              >
                {a} ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
