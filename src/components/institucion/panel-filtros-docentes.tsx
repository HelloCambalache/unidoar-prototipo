"use client";

import Link from "next/link";
import { useState } from "react";
import { Icono } from "@/components/icons";
import { Input } from "@/components/ui/campos";
import { EtiquetaSeccion } from "@/components/ui/tarjeta";
import { normalizarTexto } from "@/lib/busqueda-ia";
import { CATEGORIAS, CATEGORIA_INFO, DISPONIBILIDAD } from "@/lib/catalogo";
import type { FiltrosDocentes } from "@/lib/filtros-docentes";
import { cn } from "@/lib/utils";
import { useFiltrosEnUrl } from "./usar-filtros-docentes";

const alternar = (lista: string[], valor: string) =>
  lista.includes(valor) ? lista.filter((v) => v !== valor) : [...lista, valor];

function FilaCasilla({
  etiqueta,
  marcada,
  cantidad,
  onChange,
}: {
  etiqueta: string;
  marcada: boolean;
  cantidad?: number;
  onChange: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm leading-snug text-tinta">
      <input type="checkbox" checked={marcada} onChange={onChange} className="size-4 flex-none accent-navy-700" />
      <span className="min-w-0">{etiqueta}</span>
      {cantidad !== undefined && <span className="ml-auto text-xs leading-none text-sutil">{cantidad}</span>}
    </label>
  );
}

const Divisor = () => <div className="mb-4 h-px bg-borde" />;

/**
 * Panel lateral de filtros. En desktop siempre está a la vista; por debajo de 760px queda plegado,
 * pegado arriba, y se abre con el botón "Filtros" (así se solapa con el listado en vez de empujarlo).
 */
export function PanelFiltrosDocentes({
  ruta,
  filtros: delServidor,
  disciplinas,
  zonasSugeridas,
  limpiarHref,
  hayFiltros,
}: {
  ruta: string;
  filtros: FiltrosDocentes;
  disciplinas: { nombre: string; cantidad: number }[];
  zonasSugeridas: string[];
  limpiarHref: string;
  hayFiltros: boolean;
}) {
  const { filtros, aplicar, pendiente } = useFiltrosEnUrl(ruta, delServidor);
  const [abierto, setAbierto] = useState(false);
  const [nuevaZona, setNuevaZona] = useState("");

  const agregarZona = () => {
    const zona = nuevaZona.trim();
    if (!zona) return;
    setNuevaZona("");
    if (filtros.zonas.some((z) => normalizarTexto(z) === normalizarTexto(zona))) return;
    aplicar({ zonas: [...filtros.zonas, zona] });
  };

  const sugeridas = zonasSugeridas.filter((z) => !filtros.zonas.includes(z));

  return (
    <section
      aria-label="Filtros"
      className={cn(
        "w-[250px] flex-none rounded-ud border border-borde bg-white p-[18px] transition-opacity",
        "max-[760px]:sticky max-[760px]:top-0 max-[760px]:z-30 max-[760px]:max-h-[82vh] max-[760px]:w-full max-[760px]:overflow-auto max-[760px]:px-4 max-[760px]:py-3.5",
        pendiente && "opacity-70",
      )}
    >
      <button
        type="button"
        aria-expanded={abierto}
        aria-controls="cuerpo-filtros-docentes"
        onClick={() => setAbierto((v) => !v)}
        className="hidden w-full items-center justify-between gap-2 rounded text-sm leading-none font-semibold text-tinta max-[760px]:flex"
      >
        Filtros
        <Icono nombre="chevron" tamano={14} trazo={2.2} className={cn("transition-transform duration-200", abierto && "rotate-180")} />
      </button>

      <div id="cuerpo-filtros-docentes" className={cn("max-[760px]:mt-3.5", !abierto && "max-[760px]:hidden")}>
        <div className="mb-4 flex items-center justify-between max-[760px]:justify-end">
          <span className="text-sm leading-none font-semibold max-[760px]:hidden">Filtros</span>
          {hayFiltros && (
            <Link href={limpiarHref} className="text-xs leading-none font-medium text-naranja hover:underline">
              Limpiar
            </Link>
          )}
        </div>

        <div className="mb-[18px] flex flex-col gap-2">
          <EtiquetaSeccion className="mb-0">Categoría</EtiquetaSeccion>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {[null, ...CATEGORIAS].map((c) => {
              const activa = filtros.categoria === c;
              return (
                <button
                  key={c ?? "todas"}
                  type="button"
                  aria-pressed={activa}
                  // Cambiar de categoría vacía la lista de disciplinas: cambia el catálogo que se ofrece.
                  onClick={() => aplicar({ categoria: c, disciplinas: [] })}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs leading-none font-semibold transition-colors",
                    activa ? "bg-navy-700 text-white" : "bg-[#F0EFEA] text-apagado hover:text-tinta",
                  )}
                >
                  {c ? CATEGORIA_INFO[c].label : "Todas"}
                </button>
              );
            })}
          </div>
        </div>
        <Divisor />

        <details className="group mb-[18px]" open={filtros.disciplinas.length > 0}>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 py-0.5 text-[11px] leading-none font-semibold tracking-[.06em] text-sutil uppercase select-none hover:text-tinta [&::-webkit-details-marker]:hidden">
            Subcategoría
            <Icono nombre="chevron" tamano={13} trazo={2.2} className="transition-transform duration-200 group-open:rotate-180" />
          </summary>
          <div className="flex max-h-[264px] flex-col gap-2 overflow-auto pt-2.5">
            {disciplinas.map((d) => (
              <FilaCasilla
                key={d.nombre}
                etiqueta={d.nombre}
                cantidad={d.cantidad}
                marcada={filtros.disciplinas.includes(d.nombre)}
                onChange={() => aplicar({ disciplinas: alternar(filtros.disciplinas, d.nombre) })}
              />
            ))}
            {disciplinas.length === 0 && <p className="m-0 text-[13px] text-apagado">No hay disciplinas cargadas.</p>}
          </div>
        </details>
        <Divisor />

        <div className="mb-[18px] flex flex-col gap-2">
          <EtiquetaSeccion className="mb-0">Zona de trabajo</EtiquetaSeccion>
          {filtros.zonas.length > 0 && (
            <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
              {filtros.zonas.map((z) => (
                <li key={z}>
                  <button
                    type="button"
                    onClick={() => aplicar({ zonas: filtros.zonas.filter((x) => x !== z) })}
                    aria-label={`Quitar la zona ${z}`}
                    className="inline-flex items-center gap-1 rounded-full bg-navy-50 px-2.5 py-[5px] text-xs leading-none font-semibold text-navy-700 hover:bg-navy-100"
                  >
                    {z} ×
                  </button>
                </li>
              ))}
            </ul>
          )}
          <Input
            aria-label="Agregar una zona"
            placeholder="Agregar partido o barrio"
            list="zonas-sugeridas-docentes"
            value={nuevaZona}
            onChange={(e) => setNuevaZona(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                agregarZona();
              }
            }}
            onBlur={agregarZona}
            className="px-2.5 py-2 text-[13px]"
          />
          <datalist id="zonas-sugeridas-docentes">
            {sugeridas.map((z) => (
              <option key={z} value={z} />
            ))}
          </datalist>
        </div>
        <Divisor />

        <div className="flex flex-col gap-[9px]">
          <EtiquetaSeccion className="mb-0">Disponibilidad</EtiquetaSeccion>
          {DISPONIBILIDAD.map((d) => (
            <FilaCasilla
              key={d}
              etiqueta={d}
              marcada={filtros.disponibilidad.includes(d)}
              onChange={() => aplicar({ disponibilidad: alternar(filtros.disponibilidad, d) })}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
