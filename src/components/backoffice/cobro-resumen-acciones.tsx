"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Boton } from "@/components/ui/button";

/**
 * Barra de arriba del resumen de cuenta (no sale en la impresión). Si se abrió con ?imprimir=1 —el botón
 * "Descargar resumen" de Cobros— abre el diálogo de impresión solo, donde se elige "Guardar como PDF".
 */
export function CobroResumenAcciones({ volverHref, imprimirAlAbrir }: { volverHref: string; imprimirAlAbrir: boolean }) {
  useEffect(() => {
    if (!imprimirAlAbrir) return;
    // Un respiro para que carguen las fuentes antes de armar las páginas.
    const espera = setTimeout(() => window.print(), 500);
    return () => clearTimeout(espera);
  }, [imprimirAlAbrir]);

  return (
    <div data-no-imprimir className="mx-auto mb-4 flex w-full max-w-[820px] flex-wrap items-center justify-between gap-3">
      <Link href={volverHref} className="text-[13px] leading-none font-medium text-sutil hover:text-tinta">
        ‹ Volver a cobros
      </Link>
      <div className="flex items-center gap-3">
        <span className="text-xs leading-snug text-apagado">En el diálogo elegí “Guardar como PDF”.</span>
        <Boton onClick={() => window.print()}>Descargar resumen en PDF</Boton>
      </div>
    </div>
  );
}
