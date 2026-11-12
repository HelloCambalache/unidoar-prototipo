"use client";

import { Boton } from "@/components/ui/button";
import { Campo, Input, Select } from "@/components/ui/campos";
import { EtiquetaSeccion } from "@/components/ui/tarjeta";
import { EstadoVacio } from "@/components/app/estado-vacio";
import { ETIQUETA_OTRA_ASIGNATURA, MAX_LARGO_ASIGNATURA, OTRA_ASIGNATURA, sumarAsignatura } from "@/lib/asignaturas";
import { cn } from "@/lib/utils";
import { useState } from "react";

/**
 * Asignaturas del docente: primero el rubro, después la asignatura de ese rubro (catálogo de la tabla
 * `asignaturas`). Al elegir una se suma sola y el desplegable vuelve al placeholder, así se pueden agregar
 * varias del mismo rubro. Si la tuya no está, «Otra (escribir cuál)» (en el rubro o en la asignatura) abre un
 * campo para escribirla (ver `src/lib/asignaturas.ts`). Cada elegida viaja en el formulario como un input
 * `nombre` oculto.
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
  // Elegir «Otra» como asignatura de un rubro también abre el campo para escribir.
  const [escribiendo, setEscribiendo] = useState(false);
  const [escrita, setEscrita] = useState("");
  const [aviso, setAviso] = useState<string | undefined>();

  const grupo = grupos.find((g) => g.rubro === rubro);
  const libres = grupo?.items.filter((i) => !elegidas.includes(i)) ?? [];
  const catalogo = grupos.flatMap((g) => g.items);
  const modoTexto = rubro === OTRA_ASIGNATURA || escribiendo;

  const elegirRubro = (valor: string) => {
    setRubro(valor);
    setEscribiendo(false);
    setAviso(undefined);
  };

  const agregar = (asignatura: string) => {
    if (asignatura && !elegidas.includes(asignatura)) onCambio([...elegidas, asignatura]);
  };

  const agregarEscrita = () => {
    const r = sumarAsignatura(elegidas, escrita, catalogo);
    if (!r.ok) {
      setAviso(r.error);
      return;
    }
    onCambio(r.asignaturas);
    setEscrita("");
    setAviso(undefined);
  };

  return (
    <div>
      <div className="mb-5 flex gap-3 max-[640px]:flex-col max-[640px]:gap-3.5">
        <Campo etiqueta="Rubro" className="min-w-0 flex-1">
          <Select value={rubro} onChange={(e) => elegirRubro(e.target.value)}>
            <option value="">Elegí un rubro</option>
            {grupos.map((g) => (
              <option key={g.rubro} value={g.rubro}>
                {g.rubro}
              </option>
            ))}
            <option value={OTRA_ASIGNATURA}>{ETIQUETA_OTRA_ASIGNATURA}</option>
          </Select>
        </Campo>
        {modoTexto ? (
          <div className="flex min-w-0 flex-1 items-start gap-2">
            <Campo etiqueta="¿Cuál?" className="min-w-0 flex-1" error={aviso ?? error} ayuda="Escribí el nombre de la asignatura o disciplina.">
              <Input
                value={escrita}
                maxLength={MAX_LARGO_ASIGNATURA}
                placeholder="Ej. Pilates"
                autoComplete="off"
                onChange={(e) => {
                  setEscrita(e.target.value);
                  setAviso(undefined);
                }}
                onKeyDown={(e) => {
                  // Enter suma la asignatura; no envía el formulario del alta.
                  if (e.key === "Enter") {
                    e.preventDefault();
                    agregarEscrita();
                  }
                }}
                aria-invalid={Boolean(aviso ?? error)}
              />
            </Campo>
            {/* Alineado con el campo: la etiqueta de arriba ocupa ~20 px. */}
            <Boton variante="secundario" onClick={agregarEscrita} disabled={escrita.trim().length < 2} className="mt-[22px]">
              Agregar
            </Boton>
          </div>
        ) : (
          <Campo etiqueta="Asignatura o disciplina" className="min-w-0 flex-1" error={error}>
            <Select
              value=""
              disabled={!grupo}
              onChange={(e) => {
                if (e.target.value === OTRA_ASIGNATURA) setEscribiendo(true);
                else agregar(e.target.value);
              }}
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
              {grupo && <option value={OTRA_ASIGNATURA}>{ETIQUETA_OTRA_ASIGNATURA}</option>}
            </Select>
          </Campo>
        )}
      </div>

      <EtiquetaSeccion>Lo que elegiste</EtiquetaSeccion>
      {elegidas.length === 0 ? (
        <EstadoVacio
          titulo="Todavía no elegiste ninguna"
          texto="Elegí un rubro y después la asignatura."
          className="mb-[26px] rounded-interno border-[#CFCCC5] px-5 py-5"
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
