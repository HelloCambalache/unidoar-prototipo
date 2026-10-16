"use client";

import { useEffect, useId, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Diálogo de confirmación centrado (460px, 92vw máximo, scrim azul). Usa el `<dialog>` nativo: el navegador
 * se encarga del foco, de atrapar el Tab y del Escape. Los hijos solo existen mientras está abierto, así los
 * formularios de adentro arrancan limpios cada vez. El estado `abierto` lo maneja quien lo usa.
 */
export function DialogoModal({
  abierto,
  onCerrar,
  titulo,
  children,
  ancho = 460,
  className,
}: {
  abierto: boolean;
  onCerrar: () => void;
  /** Título visible (h2) y nombre accesible del diálogo. */
  titulo: string;
  children: React.ReactNode;
  ancho?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const idTitulo = useId();

  useEffect(() => {
    const dialogo = ref.current;
    if (!dialogo) return;
    if (abierto && !dialogo.open) dialogo.showModal();
    if (!abierto && dialogo.open) dialogo.close();
  }, [abierto]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={idTitulo}
      onClose={onCerrar}
      // Un clic sobre el scrim (el propio <dialog>, no su contenido) cierra.
      onClick={(e) => {
        if (e.target === e.currentTarget) onCerrar();
      }}
      style={{ width: ancho }}
      className={cn(
        "m-auto max-h-[92vh] max-w-[92vw] overflow-y-auto rounded-tarjeta border-0 bg-white p-0 text-tinta shadow-[0_20px_50px_rgba(0,0,0,.3)] backdrop:bg-navy-700/40",
        className,
      )}
    >
      {abierto && (
        <div className="p-[26px]">
          <h2 id={idTitulo} className="m-0 mb-2 text-[18px] leading-[1.3] font-semibold">
            {titulo}
          </h2>
          {children}
        </div>
      )}
    </dialog>
  );
}
