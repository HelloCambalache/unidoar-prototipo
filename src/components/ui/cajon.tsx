"use client";

import { useEffect } from "react";
import { cn } from "@/lib/utils";

/**
 * Cajón lateral (drawer) que entra por la derecha: 440px, 92vw máximo, scrim azul.
 * Se cierra con Escape, con el scrim o con "✕ Cerrar". El estado lo maneja quien lo usa.
 */
export function Cajon({
  abierto,
  onCerrar,
  titulo,
  children,
  ancho = 440,
}: {
  abierto: boolean;
  onCerrar: () => void;
  /** Para lectores de pantalla; el título visible va dentro de `children`. */
  titulo: string;
  children: React.ReactNode;
  ancho?: number;
}) {
  useEffect(() => {
    if (!abierto) return;
    const alTeclear = (e: KeyboardEvent) => e.key === "Escape" && onCerrar();
    document.addEventListener("keydown", alTeclear);
    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", alTeclear);
      document.body.style.overflow = previo;
    };
  }, [abierto, onCerrar]);

  if (!abierto) return null;
  return (
    <>
      <div onClick={onCerrar} className="fixed inset-0 z-50 bg-navy-700/35" aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        style={{ width: ancho }}
        className={cn(
          "fixed top-0 right-0 z-[51] flex h-screen max-w-[92vw] flex-col overflow-y-auto bg-white p-[26px] shadow-[-8px_0_24px_rgba(22,33,79,.18)]",
          "animate-slide-in-right",
        )}
      >
        <button
          type="button"
          onClick={onCerrar}
          className="mb-[18px] inline-block self-start text-[13px] font-medium text-sutil hover:text-tinta"
        >
          ✕ Cerrar
        </button>
        {children}
      </div>
    </>
  );
}
