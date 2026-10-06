"use client";

import { useState } from "react";
import { Boton } from "@/components/ui/button";
import { Campo, Input } from "@/components/ui/campos";
import { normalizarTexto } from "@/lib/onboarding";

/**
 * Zonas donde trabaja el docente. Las sugerencias salen de la tabla `zonas`, pero se puede escribir
 * cualquier otra localidad (no hay que estar en el catálogo para postularse). Cada zona elegida viaja
 * en el formulario como un input `nombre` oculto.
 */
export function SelectorZonas({
  sugerencias,
  inicial,
  nombre = "zonas",
  maximo = 12,
  error,
}: {
  sugerencias: string[];
  inicial: string[];
  nombre?: string;
  maximo?: number;
  error?: string;
}) {
  const [zonas, setZonas] = useState(inicial);
  const [consulta, setConsulta] = useState("");

  const yaEsta = (z: string) => zonas.some((x) => normalizarTexto(x) === normalizarTexto(z));
  const q = normalizarTexto(consulta);
  const propuestas = sugerencias.filter((s) => !yaEsta(s) && (!q || normalizarTexto(s).includes(q))).slice(0, 6);
  const lleno = zonas.length >= maximo;

  const agregar = (texto: string) => {
    const limpio = texto.trim().replace(/\s+/g, " ");
    if (limpio.length < 2 || yaEsta(limpio) || lleno) return;
    // Si lo escrito coincide con una sugerencia, se usa su escritura canónica.
    const canonica = sugerencias.find((s) => normalizarTexto(s) === normalizarTexto(limpio));
    setZonas([...zonas, canonica ?? limpio.slice(0, 80)]);
    setConsulta("");
  };

  return (
    <div>
      <div className="flex items-end gap-2.5">
        <Campo etiqueta="Zonas donde trabajás" className="min-w-0 flex-1" error={error} ayuda={lleno ? `Llegaste al máximo de ${maximo} zonas.` : undefined}>
          <Input
            value={consulta}
            onChange={(e) => setConsulta(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                agregar(consulta);
              }
            }}
            placeholder="Escribí una zona o localidad"
            autoComplete="off"
            disabled={lleno}
            aria-invalid={Boolean(error)}
          />
        </Campo>
        <Boton variante="secundario" onClick={() => agregar(consulta)} disabled={lleno || consulta.trim().length < 2}>
          Agregar
        </Boton>
      </div>

      {propuestas.length > 0 && !lleno && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-sutil">{q ? "Coincidencias:" : "Sugeridas:"}</span>
          {propuestas.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => agregar(s)}
              className="rounded-full border border-borde bg-white px-3 py-1.5 text-[13px] leading-none text-tinta-2 transition-colors hover:border-navy-700 hover:text-navy-700 focus-visible:ring-[3px] focus-visible:ring-navy-700/30 focus-visible:outline-none"
            >
              + {s}
            </button>
          ))}
        </div>
      )}

      {zonas.length > 0 && (
        <ul className="m-0 mt-3 flex list-none flex-wrap gap-2 p-0">
          {zonas.map((z) => (
            <li key={z}>
              <input type="hidden" name={nombre} value={z} />
              <button
                type="button"
                onClick={() => setZonas(zonas.filter((x) => x !== z))}
                aria-label={`Quitar ${z}`}
                className="cursor-pointer rounded-full bg-navy-700 px-3.5 py-2 text-[13px] leading-none font-medium text-white transition-colors hover:bg-navy-900 focus-visible:ring-[3px] focus-visible:ring-navy-700/30 focus-visible:outline-none"
              >
                {z} ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
