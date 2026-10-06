"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { EtapaPostulacion } from "@/db/schema";
import { ETAPAS_MOVIBLES } from "@/lib/postulaciones";
import { ETAPA_MENU } from "@/lib/pipeline";
import { cn } from "@/lib/utils";

type Posicion = { left: number; top?: number; bottom?: number };

const ITEM =
  "flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-[13px] font-medium leading-none text-tinta hover:bg-superficie focus-visible:bg-superficie focus-visible:outline-none";

/**
 * Menú "⋯" de cada tarjeta: mover de etapa sin arrastrar, contratar o descartar. Es la
 * alternativa accesible (teclado y lector de pantalla) al drag & drop. Se dibuja en un portal
 * con posición fija para no quedar recortado por el scroll horizontal del tablero.
 */
export function MenuEtapas({
  nombre,
  postulacionId,
  etapa,
  onMover,
  onDescartar,
}: {
  nombre: string;
  postulacionId: string;
  etapa: EtapaPostulacion;
  onMover: (etapa: EtapaPostulacion) => void;
  onDescartar: () => void;
}) {
  const [posicion, setPosicion] = useState<Posicion | null>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const abierto = posicion !== null;

  const abrir = () => {
    const rect = boton.current?.getBoundingClientRect();
    if (!rect) return;
    const left = Math.max(8, Math.min(rect.right - 210, window.innerWidth - 218));
    // Si abajo no entra el menú (≈ 290px), se abre hacia arriba.
    setPosicion(
      window.innerHeight - rect.bottom > 300
        ? { left, top: rect.bottom + 4 }
        : { left, bottom: window.innerHeight - rect.top + 4 },
    );
  };

  const cerrar = (devolverFoco = false) => {
    setPosicion(null);
    if (devolverFoco) boton.current?.focus();
  };

  useEffect(() => {
    if (!abierto) return;
    menu.current?.querySelector<HTMLElement>('[role^="menuitem"]')?.focus({ preventScroll: true });
    const clicAfuera = (e: MouseEvent) => {
      const objetivo = e.target as Node;
      if (!menu.current?.contains(objetivo) && !boton.current?.contains(objetivo)) setPosicion(null);
    };
    const cerrarPorMovimiento = () => setPosicion(null);
    document.addEventListener("mousedown", clicAfuera);
    window.addEventListener("resize", cerrarPorMovimiento);
    window.addEventListener("scroll", cerrarPorMovimiento, true);
    return () => {
      document.removeEventListener("mousedown", clicAfuera);
      window.removeEventListener("resize", cerrarPorMovimiento);
      window.removeEventListener("scroll", cerrarPorMovimiento, true);
    };
  }, [abierto]);

  const alTeclear = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      cerrar(true);
    } else if (e.key === "Tab") {
      setPosicion(null);
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const items = [...(menu.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ?? [])];
      const i = items.indexOf(document.activeElement as HTMLElement);
      const siguiente = e.key === "ArrowDown" ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
      items[siguiente]?.focus();
    }
  };

  return (
    <>
      <button
        ref={boton}
        type="button"
        aria-label={`Cambiar de etapa a ${nombre}`}
        aria-haspopup="menu"
        aria-expanded={abierto}
        onClick={() => (abierto ? cerrar() : abrir())}
        className="inline-flex size-7 flex-none items-center justify-center rounded-md text-apagado transition-colors hover:bg-black/5 hover:text-tinta focus-visible:ring-[3px] focus-visible:ring-navy-700/30 focus-visible:outline-none"
      >
        <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="5" cy="12" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="19" cy="12" r="1.8" />
        </svg>
      </button>
      {posicion &&
        createPortal(
          <div
            ref={menu}
            role="menu"
            aria-label={`Mover a ${nombre}`}
            onKeyDown={alTeclear}
            style={{ position: "fixed", left: posicion.left, top: posicion.top, bottom: posicion.bottom }}
            className="z-[70] w-[210px] overflow-hidden rounded-lg border border-borde bg-white py-1 shadow-[0_10px_24px_rgba(31,36,33,.18)]"
          >
            <div className="px-3.5 pt-2 pb-1 text-[11px] leading-none font-semibold tracking-[.06em] text-sutil uppercase">
              Mover a
            </div>
            {ETAPAS_MOVIBLES.map((e) => (
              <button
                key={e}
                type="button"
                role="menuitemradio"
                aria-checked={e === etapa}
                onClick={() => {
                  cerrar(true);
                  if (e !== etapa) onMover(e);
                }}
                className={cn(ITEM, e === etapa && "font-semibold text-navy-700")}
              >
                <span className="w-3.5 text-navy-700">{e === etapa ? "✓" : ""}</span>
                {ETAPA_MENU[e]}
              </button>
            ))}
            <Link
              role="menuitem"
              href={`/institucion/contratar?postulacion=${postulacionId}`}
              onClick={() => setPosicion(null)}
              className={cn(ITEM, "border-t border-borde")}
            >
              <span className="w-3.5" />
              Contratar…
            </Link>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                cerrar(true);
                onDescartar();
              }}
              className={cn(ITEM, "text-[#b91c1c]")}
            >
              <span className="w-3.5" />
              Descartar
            </button>
          </div>,
          document.body,
        )}
    </>
  );
}
