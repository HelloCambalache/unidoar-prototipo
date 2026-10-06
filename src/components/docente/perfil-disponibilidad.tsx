"use client";

import type { EstadoCeldaDisponibilidad, GrillaDisponibilidad } from "@/db/schema";
import { DIAS, DIAS_LARGO, FRANJAS, resumenDisponibilidad, siguienteEstadoCelda } from "@/lib/onboarding";
import { cn } from "@/lib/utils";

const COLOR: Record<EstadoCeldaDisponibilidad, string> = {
  disponible: "bg-navy-700",
  convenir: "bg-[#8CA9BE]",
  ocupada: "bg-[#F0EFEA] hover:bg-[#E6E4DD]",
};
const TEXTO: Record<EstadoCeldaDisponibilidad, string> = {
  disponible: "disponible",
  convenir: "a convenir",
  ocupada: "ocupada",
};

const COLUMNAS =
  "grid grid-cols-[62px_repeat(6,minmax(0,1fr))] gap-1.5 min-[521px]:grid-cols-[90px_repeat(6,minmax(0,1fr))]";

/** Grilla editable franja × día. Cada toque cambia el casillero: disponible → a convenir → libre. */
export function PerfilDisponibilidad({
  grilla,
  onCambiar,
}: {
  grilla: GrillaDisponibilidad;
  onCambiar: (nueva: GrillaDisponibilidad) => void;
}) {
  const resumen = resumenDisponibilidad(grilla);

  const alternar = (clave: keyof GrillaDisponibilidad, i: number) =>
    onCambiar({ ...grilla, [clave]: grilla[clave].map((c, j) => (j === i ? siguienteEstadoCelda(c) : c)) });

  return (
    <div>
      <p className="m-0 mb-3.5 text-[13px] leading-normal text-apagado">
        Tocá cada casillero: una vez <b className="font-semibold text-tinta">disponible</b>, dos veces{" "}
        <b className="font-semibold text-tinta">a convenir</b>, tres veces lo dejás libre.
      </p>
      <div className={cn(COLUMNAS, "mb-2 text-xs leading-none text-apagado")} aria-hidden>
        <span />
        {DIAS.map((d) => (
          <span key={d} className="text-center">
            {d}
          </span>
        ))}
      </div>
      {FRANJAS.map((f) => (
        <div key={f.clave} className={cn(COLUMNAS, "mb-1.5")}>
          <span className="self-center text-[13px] leading-none text-apagado">{f.etiqueta}</span>
          {grilla[f.clave].map((estado, i) => (
            <button
              key={DIAS[i]}
              type="button"
              onClick={() => alternar(f.clave, i)}
              aria-label={`${f.etiqueta}, ${DIAS_LARGO[i]}: ${TEXTO[estado]}`}
              className={cn(
                "h-7 rounded-md transition-colors focus-visible:ring-[3px] focus-visible:ring-navy-700/30 focus-visible:outline-none",
                COLOR[estado],
              )}
            />
          ))}
        </div>
      ))}
      <div className="mt-2 flex flex-wrap gap-4 text-xs leading-none text-apagado" aria-hidden>
        {(["disponible", "convenir", "ocupada"] as const).map((e) => (
          <span key={e} className="flex items-center gap-1.5">
            <span className={cn("inline-block size-2.5 rounded-[3px]", COLOR[e].split(" ")[0])} />
            {e === "disponible" ? "Disponible" : e === "convenir" ? "A convenir" : "Ocupada"}
          </span>
        ))}
      </div>
      <div className="mt-3.5 border-t border-[#F0EFEA] pt-3.5">
        <div className="mb-2 text-[11px] leading-none font-semibold tracking-[.06em] text-sutil uppercase">
          Así se lee tu disponibilidad
        </div>
        {resumen.map((r) => (
          <div key={r.titulo} className="mb-1 flex gap-2 text-[13.5px] leading-[1.6] text-tinta-2">
            <span aria-hidden style={{ background: r.color }} className="mt-1.5 size-2.5 flex-none rounded-[3px]" />
            <span>
              <b className="font-semibold">{r.titulo}</b> {r.texto}
            </span>
          </div>
        ))}
        {resumen.length === 0 && (
          <div className="text-[13.5px] leading-normal text-apagado">
            Marcá al menos una franja para que las instituciones sepan cuándo podés.
          </div>
        )}
      </div>
    </div>
  );
}
