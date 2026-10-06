"use client";

import { useState } from "react";
import { MAX_VALORES } from "@/lib/vitrina";

/**
 * Valores de la institución como etiquetas: se agregan escribiendo y apretando Enter (o saliendo del campo)
 * y se quitan con un clic sobre la etiqueta. Máximo 12, sin repetidos.
 */
export function VitrinaValores({
  valores,
  onCambiar,
  error,
}: {
  valores: string[];
  onCambiar: (nuevos: string[]) => void;
  error?: string;
}) {
  const [texto, setTexto] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);

  const agregar = () => {
    const v = texto.trim().replace(/\s+/g, " ");
    if (!v) {
      setTexto("");
      return;
    }
    if (v.length > 40) {
      setAviso("Cada valor puede tener hasta 40 caracteres.");
      return;
    }
    if (valores.length >= MAX_VALORES) {
      setAviso(`Podés cargar hasta ${MAX_VALORES} valores.`);
      return;
    }
    if (!valores.some((x) => x.toLowerCase() === v.toLowerCase())) onCambiar([...valores, v]);
    setTexto("");
    setAviso(null);
  };

  const mensaje = aviso ?? error;
  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5">
        {valores.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onCambiar(valores.filter((x) => x !== v))}
            aria-label={`Quitar el valor ${v}`}
            className="inline-flex cursor-pointer items-center gap-1 rounded-full bg-navy-50 px-2.5 py-[5px] text-xs leading-none font-semibold text-navy-700 transition-colors hover:bg-navy-100 focus-visible:ring-[3px] focus-visible:ring-navy-700/30 focus-visible:outline-none"
          >
            {v} <span aria-hidden>×</span>
          </button>
        ))}
        <input
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value);
            setAviso(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault(); // no enviar el formulario entero
              agregar();
            }
          }}
          onBlur={agregar}
          aria-label="Agregar un valor"
          placeholder="Escribí un valor y Enter"
          maxLength={60}
          className="h-[30px] w-[190px] rounded-xl border border-borde bg-white px-2.5 text-xs text-tinta placeholder:text-sutil focus:border-navy-700 focus:ring-[3px] focus:ring-navy-700/20 focus:outline-none"
        />
      </div>
      {mensaje && (
        <p role="alert" className="m-0 mt-1.5 text-xs text-[#b91c1c]">
          {mensaje}
        </p>
      )}
    </div>
  );
}
