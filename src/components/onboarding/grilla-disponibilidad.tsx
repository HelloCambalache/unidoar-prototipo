"use client";

import { useState } from "react";
import type { EstadoCeldaDisponibilidad, GrillaDisponibilidad } from "@/db/schema";
import { DIAS, DIAS_LARGO, FRANJAS, resumenDisponibilidad, siguienteEstadoCelda } from "@/lib/onboarding";
import { cn } from "@/lib/utils";

const COLOR_CELDA: Record<EstadoCeldaDisponibilidad, string> = {
  disponible: "bg-navy-700",
  convenir: "bg-[#8CA9BE]",
  ocupada: "bg-[#F0EFEA]",
};
const TEXTO_ESTADO: Record<EstadoCeldaDisponibilidad, string> = {
  disponible: "disponible",
  convenir: "a convenir",
  ocupada: "no disponible",
};

const FILA = "grid grid-cols-[86px_repeat(6,minmax(0,1fr))] gap-1.5 max-[520px]:grid-cols-[62px_repeat(6,minmax(0,1fr))] max-[520px]:gap-1";

/**
 * Grilla semanal de disponibilidad: 3 franjas × 6 días. Un toque marca "disponible", dos "a convenir",
 * tres lo dejan libre. Viaja en el formulario como JSON en un input oculto `nombre`.
 */
export function GrillaDisponibilidad({
  inicial,
  nombre = "grilla",
  error,
}: {
  inicial: GrillaDisponibilidad;
  nombre?: string;
  error?: string;
}) {
  const [grilla, setGrilla] = useState(inicial);
  const resumen = resumenDisponibilidad(grilla);

  const alternar = (franja: keyof GrillaDisponibilidad, dia: number) =>
    setGrilla((g) => ({ ...g, [franja]: g[franja].map((c, i) => (i === dia ? siguienteEstadoCelda(c) : c)) }));

  return (
    <div>
      <input type="hidden" name={nombre} value={JSON.stringify(grilla)} />
      <div
        role="group"
        aria-label="Disponibilidad semanal"
        className={cn("overflow-x-auto rounded-xl border bg-white p-4", error ? "border-[#dc2626]" : "border-borde")}
      >
        <div className={cn(FILA, "mb-2 text-xs leading-none text-apagado max-[520px]:text-[11px]")}>
          <span />
          {DIAS.map((d) => (
            <span key={d} className="text-center">
              {d}
            </span>
          ))}
        </div>
        {FRANJAS.map((f) => (
          <div key={f.clave} className={cn(FILA, "mb-1.5 max-[520px]:mb-1")}>
            <span className="self-center text-[13px] leading-none text-apagado max-[520px]:text-[11px]">{f.etiqueta}</span>
            {grilla[f.clave].map((estado, i) => (
              <button
                key={i}
                type="button"
                onClick={() => alternar(f.clave, i)}
                aria-label={`${DIAS_LARGO[i]}, ${f.etiqueta.toLowerCase()}: ${TEXTO_ESTADO[estado]}`}
                className={cn(
                  "h-[30px] rounded-md transition-colors focus-visible:ring-[3px] focus-visible:ring-navy-700/30 focus-visible:outline-none max-[520px]:h-[26px]",
                  COLOR_CELDA[estado],
                  estado === "ocupada" && "hover:bg-[#E3E1DC]",
                )}
              />
            ))}
          </div>
        ))}

        <div className="mt-2.5 flex flex-wrap gap-4 text-xs leading-none text-apagado">
          {(["disponible", "convenir", "ocupada"] as const).map((e) => (
            <span key={e} className="flex items-center gap-1.5">
              <span className={cn("inline-block size-2.5 rounded-[3px]", COLOR_CELDA[e])} />
              {e === "disponible" ? "Disponible" : e === "convenir" ? "A convenir" : "No podés"}
            </span>
          ))}
        </div>

        <div aria-live="polite" className="mt-3.5 border-t border-[#F0EFEA] pt-3.5">
          {resumen.length === 0 ? (
            <div className="text-[13.5px] leading-normal text-apagado">
              Marcá al menos un horario para que las instituciones sepan cuándo podés.
            </div>
          ) : (
            resumen.map((r) => (
              <div key={r.titulo} className="mb-1 flex gap-2 text-[13.5px] leading-relaxed text-tinta-2">
                <span style={{ background: r.color }} className="mt-1.5 size-2.5 flex-none rounded-[3px]" />
                <span>
                  <b className="font-semibold">{r.titulo}</b> {r.texto}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
      {error && (
        <p role="alert" className="mt-1.5 text-xs text-[#b91c1c]">
          {error}
        </p>
      )}
    </div>
  );
}
