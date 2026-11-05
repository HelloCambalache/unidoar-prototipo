"use client";

import { flushSync } from "react-dom";
import { Icono } from "@/components/icons";
import { Boton } from "@/components/ui/button";
import { ID_DE_RESULTADOS } from "@/lib/filtros-celular";
import { cn } from "@/lib/utils";

/*
 * Piezas del panel de filtros en el celular, compartidas por el buscador de profesionales (institución) y el de trabajo (profesional): el botón
 * «Filtros» que abre el panel y el pie con «Continuar» que lo cierra. En pantallas de más de 760 px no se ven (el panel está siempre abierto).
 * Las reglas puras (cuántos filtros hay, qué dice el pie) están en `src/lib/filtros-celular.ts`.
 */

/**
 * El botón que abre y cierra el panel. Es un botón de verdad, con borde y color de marca, y dice cuántos filtros hay puestos: con alguno
 * puesto se pinta lleno, para que se note de lejos que el listado está filtrado.
 */
export function BotonDeFiltros({
  abierto,
  activos,
  controla,
  onClick,
  ref,
}: {
  abierto: boolean;
  activos: number;
  /** `id` del cuerpo del panel que abre y cierra. */
  controla: string;
  onClick: () => void;
  ref?: React.Ref<HTMLButtonElement>;
}) {
  return (
    <button
      ref={ref}
      type="button"
      aria-expanded={abierto}
      aria-controls={controla}
      onClick={onClick}
      className={cn(
        "hidden min-h-12 w-full items-center gap-2.5 rounded-caja border-[1.5px] border-navy-700 px-3.5 text-[15px] leading-none font-semibold transition-colors max-[760px]:flex",
        "focus-visible:ring-[3px] focus-visible:ring-navy-700/30 focus-visible:outline-none",
        activos > 0 ? "bg-navy-700 text-white hover:bg-navy-900" : "bg-navy-50 text-navy-700 hover:bg-navy-100",
      )}
    >
      <Icono nombre="filtros" tamano={18} trazo={2} />
      Filtros
      {activos > 0 && (
        <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-white px-2 text-xs font-semibold text-navy-700">
          {activos}
        </span>
      )}
      <span className="ml-auto text-[13px] font-medium">{abierto ? "Cerrar" : "Elegir"}</span>
      <Icono nombre="chevron" tamano={16} trazo={2.2} className={cn("flex-none transition-transform duration-200", abierto && "rotate-180")} />
    </button>
  );
}

/**
 * El pie del panel abierto: «Continuar» cierra el panel y lleva a los resultados (los filtros ya se aplicaron al tocarlos). Queda pegado abajo
 * del panel aunque haya que desplazarse para ver todas las opciones. Con `resumen` dice cuántos resultados quedaron.
 */
export function PieDeFiltros({ resumen, onContinuar }: { resumen?: string; onContinuar: () => void }) {
  return (
    <div className="mt-4 hidden items-center gap-3 border-t border-borde bg-white pt-3 pb-1 max-[760px]:sticky max-[760px]:bottom-0 max-[760px]:z-10 max-[760px]:flex">
      {resumen && <p className="m-0 min-w-0 flex-1 text-[13px] leading-snug text-apagado">{resumen}</p>}
      <Boton variante="primario" onClick={onContinuar} className={resumen ? "flex-none" : "w-full"}>
        Continuar
      </Boton>
    </div>
  );
}

/**
 * Lo que hace «Continuar»: cierra el panel, devuelve el foco al botón «Filtros» (si no, el foco quedaría en un botón que ya no se ve) y lleva
 * la pantalla a los resultados. El panel se cierra ANTES de medir a dónde desplazarse (`flushSync`): plegado, el panel ocupa menos y los
 * resultados quedan más arriba.
 */
export function cerrarYVerResultados(cerrar: () => void, botonDeFiltros: HTMLElement | null) {
  flushSync(cerrar);
  botonDeFiltros?.focus({ preventScroll: true });
  const sinMovimiento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.getElementById(ID_DE_RESULTADOS)?.scrollIntoView({ behavior: sinMovimiento ? "auto" : "smooth", block: "start" });
}
