"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Boton } from "@/components/ui/button";

/**
 * Barra de arriba del comprobante imprimible (no sale en la impresión). Si se abrió con ?imprimir=1 —el link
 * "Descargar" del historial— abre el diálogo de impresión solo, donde se elige "Guardar como PDF".
 */
export function PlanFacturaAcciones({ imprimirAlAbrir }: { imprimirAlAbrir: boolean }) {
  useEffect(() => {
    if (!imprimirAlAbrir) return;
    // Un respiro para que carguen las fuentes antes de armar la página.
    const espera = setTimeout(() => window.print(), 500);
    return () => clearTimeout(espera);
  }, [imprimirAlAbrir]);

  return (
    <div data-no-imprimir className="mx-auto mb-4 flex w-full max-w-[820px] flex-wrap items-center justify-between gap-3">
      <Link href="/institucion/plan" className="text-[13px] leading-none font-medium text-sutil hover:text-tinta">
        ‹ Volver a Plan y facturación
      </Link>
      <div className="flex items-center gap-3">
        <span className="text-xs leading-snug text-apagado">En el diálogo elegí “Guardar como PDF”.</span>
        <Boton onClick={() => window.print()}>Descargar PDF</Boton>
      </div>
    </div>
  );
}
