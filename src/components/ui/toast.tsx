"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Tono = "exito" | "error" | "info";
type ToastItem = { id: number; texto: string; tono: Tono };

const Contexto = createContext<(texto: string, tono?: Tono) => void>(() => {});

/** Confirmaciones efímeras arriba a la derecha (se van solas a los ~2,2 s). */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const siguiente = useRef(0);

  const mostrar = useCallback((texto: string, tono: Tono = "exito") => {
    const id = ++siguiente.current;
    setItems((prev) => [...prev, { id, texto, tono }]);
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), tono === "error" ? 4000 : 2200);
  }, []);

  return (
    <Contexto.Provider value={mostrar}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed top-4 right-4 z-[100] flex flex-col gap-2">
        {items.map((t) => (
          <div
            key={t.id}
            role={t.tono === "error" ? "alert" : "status"}
            className={cn(
              "pointer-events-auto max-w-[340px] rounded-[10px] px-4 py-3 text-[13.5px] leading-snug font-medium shadow-[0_8px_24px_rgba(31,36,33,.22)]",
              t.tono === "exito" && "bg-navy-700 text-white",
              t.tono === "error" && "bg-[#b91c1c] text-white",
              t.tono === "info" && "bg-tinta text-white",
            )}
          >
            {t.texto}
          </div>
        ))}
      </div>
    </Contexto.Provider>
  );
}

/** `const toast = useToast(); toast("Invitación enviada");` */
export function useToast() {
  return useContext(Contexto);
}
