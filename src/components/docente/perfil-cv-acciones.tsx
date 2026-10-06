"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Boton } from "@/components/ui/button";

/**
 * Barra de arriba del CV imprimible (no sale en la impresión). Si se abrió con ?imprimir=1 —el botón
 * "Descargar CV en PDF" del perfil— abre el diálogo de impresión solo, donde se elige "Guardar como PDF".
 */
export function PerfilCvAcciones({ imprimirAlAbrir }: { imprimirAlAbrir: boolean }) {
  useEffect(() => {
    if (!imprimirAlAbrir) return;
    // Un respiro para que carguen la foto y las fuentes antes de armar las páginas.
    const espera = setTimeout(() => window.print(), 500);
    return () => clearTimeout(espera);
  }, [imprimirAlAbrir]);

  return (
    <div data-no-imprimir className="mx-auto mb-4 flex w-full max-w-[820px] flex-wrap items-center justify-between gap-3">
      <Link href="/docente/perfil" className="text-[13px] leading-none font-medium text-sutil hover:text-tinta">
        ‹ Volver a mi perfil
      </Link>
      <div className="flex items-center gap-3">
        <span className="text-xs leading-snug text-apagado">En el diálogo elegí “Guardar como PDF”.</span>
        <Boton onClick={() => window.print()}>Descargar CV en PDF</Boton>
      </div>
    </div>
  );
}
