"use client";

import { useId, useState } from "react";
import { normalizar } from "@/lib/coincidencia";
import { cn } from "@/lib/utils";

const CHIP =
  "inline-flex items-center gap-1 rounded-full bg-[#F0EFEA] px-2.5 py-[5px] text-xs leading-none font-semibold text-tinta-2 transition-colors hover:bg-[#E6E4DD] focus-visible:ring-[3px] focus-visible:ring-navy-700/30 focus-visible:outline-none";

/**
 * Lista de etiquetas editable (zonas, asignaturas): tocar una la quita; "+ agregar" abre un campo con
 * sugerencias de la base. Con `soloSugerencias` solo se aceptan valores de la lista (las zonas).
 */
export function PerfilEtiquetas({
  items,
  onCambiar,
  sugerencias,
  soloSugerencias = false,
  textoAgregar,
  etiquetaCampo,
  max,
}: {
  items: string[];
  onCambiar: (nuevos: string[]) => void;
  sugerencias: string[];
  soloSugerencias?: boolean;
  textoAgregar: string;
  etiquetaCampo: string;
  max: number;
}) {
  const idLista = useId();
  const [abierto, setAbierto] = useState(false);
  const [valor, setValor] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);

  const cerrar = () => {
    setAbierto(false);
    setValor("");
    setAviso(null);
  };

  const confirmar = () => {
    const v = valor.trim();
    if (!v) return cerrar();
    const sugerida = sugerencias.find((s) => normalizar(s) === normalizar(v));
    if (soloSugerencias && !sugerida) {
      setAviso("Elegí una opción de la lista.");
      return;
    }
    const nueva = sugerida ?? v;
    if (items.length >= max) {
      setAviso(`Podés cargar hasta ${max}.`);
      return;
    }
    if (!items.some((i) => normalizar(i) === normalizar(nueva))) onCambiar([...items, nueva]);
    cerrar();
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {items.map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => onCambiar(items.filter((i) => i !== item))}
          aria-label={`Quitar ${item}`}
          className={cn(CHIP, "cursor-pointer")}
        >
          {item} <span aria-hidden>×</span>
        </button>
      ))}
      {abierto ? (
        <span className="inline-flex flex-col gap-1">
          <input
            autoFocus
            list={idLista}
            value={valor}
            aria-label={etiquetaCampo}
            placeholder="Escribí y elegí una opción"
            onChange={(e) => {
              setValor(e.target.value);
              setAviso(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault(); // no enviar el formulario entero
                confirmar();
              } else if (e.key === "Escape") {
                cerrar();
              }
            }}
            onBlur={() => {
              if (!valor.trim()) cerrar();
              else confirmar();
            }}
            className="h-[26px] w-[190px] rounded-xl border border-borde bg-white px-2 text-xs text-tinta placeholder:text-sutil focus:border-navy-700 focus:ring-[3px] focus:ring-navy-700/20 focus:outline-none"
          />
          <datalist id={idLista}>
            {sugerencias.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
          {aviso && (
            <span role="alert" className="text-[11px] leading-tight text-[#b91c1c]">
              {aviso}
            </span>
          )}
        </span>
      ) : (
        <button type="button" onClick={() => setAbierto(true)} className={cn(CHIP, "cursor-pointer")}>
          + {textoAgregar}
        </button>
      )}
    </div>
  );
}
