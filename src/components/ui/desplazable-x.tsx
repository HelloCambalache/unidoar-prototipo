"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Icono } from "@/components/icons";
import { cn } from "@/lib/utils";

const DEGRADADO = {
  lienzo: { izq: "bg-linear-to-r from-lienzo to-transparent", der: "bg-linear-to-l from-lienzo to-transparent" },
  blanco: { izq: "bg-linear-to-r from-white to-transparent", der: "bg-linear-to-l from-white to-transparent" },
} as const;

/**
 * Un contenedor con scroll horizontal que AVISA cuando hay contenido escondido: un degradado en el borde donde sigue y un botón para avanzar o volver.
 * Sin esto, en una computadora con la barra de scroll oculta (macOS, trackpad) un tablero o una tabla ancha se ve simplemente «cortada».
 * `fondo` es el color de lo que hay detrás (el degradado se funde con él); `className` va en la zona que se desplaza y `envoltorio` en la caja de afuera.
 */
export function DesplazableX({
  fondo = "lienzo",
  etiquetaMas = "Ver más",
  className,
  envoltorio,
  children,
}: {
  fondo?: keyof typeof DEGRADADO;
  etiquetaMas?: string;
  className?: string;
  envoltorio?: string;
  children: React.ReactNode;
}) {
  const zona = useRef<HTMLDivElement>(null);
  const [mas, setMas] = useState({ izq: false, der: false });

  const medir = useCallback(() => {
    const el = zona.current;
    if (!el) return;
    const escondido = el.scrollWidth - el.clientWidth;
    setMas({ izq: el.scrollLeft > 4, der: escondido - el.scrollLeft > 4 });
  }, []);

  useEffect(() => {
    const el = zona.current;
    if (!el) return;
    medir();
    // Cambia el ancho de la zona (se redimensiona la ventana) o el de lo que tiene adentro.
    const observador = new ResizeObserver(medir);
    observador.observe(el);
    for (const hijo of el.children) observador.observe(hijo);
    return () => observador.disconnect();
  }, [medir]);

  const mover = (hacia: 1 | -1) => {
    const el = zona.current;
    if (!el) return;
    const sinMovimiento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: hacia * Math.max(240, el.clientWidth * 0.8), behavior: sinMovimiento ? "auto" : "smooth" });
  };

  const boton =
    "pointer-events-auto absolute top-2 inline-flex size-9 items-center justify-center rounded-full border border-borde bg-white text-tinta-2 shadow-[0_2px_8px_rgba(31,36,33,.16)] transition-colors hover:border-borde-fuerte hover:text-tinta focus-visible:ring-[3px] focus-visible:ring-navy-700/30 focus-visible:outline-none";

  return (
    <div className={cn("relative", envoltorio)}>
      {/* `relative`: un texto `sr-only` de adentro (el de la columna de acciones de una tabla) tiene que quedar recortado por esta zona, no ensanchar la página. */}
      <div ref={zona} onScroll={medir} className={cn("relative overflow-x-auto", className)}>
        {children}
      </div>
      {mas.izq && (
        <div className={cn("pointer-events-none absolute inset-y-0 left-0 w-14", DEGRADADO[fondo].izq)}>
          <button type="button" onClick={() => mover(-1)} aria-label="Volver" className={cn(boton, "left-1")}>
            <Icono nombre="volver" tamano={16} trazo={2} />
          </button>
        </div>
      )}
      {mas.der && (
        <div className={cn("pointer-events-none absolute inset-y-0 right-0 w-14", DEGRADADO[fondo].der)}>
          <button type="button" onClick={() => mover(1)} aria-label={etiquetaMas} title={etiquetaMas} className={cn(boton, "right-1")}>
            <Icono nombre="flecha" tamano={16} trazo={2} />
          </button>
        </div>
      )}
    </div>
  );
}
