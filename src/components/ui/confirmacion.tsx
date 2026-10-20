"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { Boton } from "@/components/ui/button";
import { DialogoModal } from "@/components/ui/dialogo-modal";
import { dividirMensaje } from "@/lib/confirmacion";

type Pedir = (mensaje: string) => Promise<boolean>;

// Sin proveedor (no debería pasar: está en el layout raíz) se cae al cuadro nativo.
const Contexto = createContext<Pedir>(async (mensaje) => (typeof window !== "undefined" ? window.confirm(mensaje) : false));

/**
 * Confirmación propia, en lugar del `window.confirm` del navegador: el cuadro nativo no se muestra en los navegadores embebidos (el panel de
 * la app, algunos navegadores de celular) y ahí devuelve "no" sin avisar, con lo que el botón parece no hacer nada. Es un `<dialog>` nativo
 * (foco, Tab y Escape resueltos por el navegador). El foco arranca en "Cancelar", para que un Enter apurado no confirme algo que no se
 * puede deshacer.
 */
export function ConfirmacionProvider({ children }: { children: React.ReactNode }) {
  const [mensaje, setMensaje] = useState<string | null>(null);
  const resolver = useRef<((respuesta: boolean) => void) | null>(null);

  const pedir = useCallback<Pedir>((texto) => {
    return new Promise<boolean>((resolve) => {
      // Si ya había una pregunta abierta, esa se descarta como "no".
      resolver.current?.(false);
      resolver.current = resolve;
      setMensaje(texto);
    });
  }, []);

  const responder = (respuesta: boolean) => {
    resolver.current?.(respuesta);
    resolver.current = null;
    setMensaje(null);
  };

  const { titulo, detalle } = dividirMensaje(mensaje ?? "");

  return (
    <Contexto.Provider value={pedir}>
      {children}
      <DialogoModal abierto={mensaje !== null} onCerrar={() => responder(false)} titulo={titulo}>
        {detalle && <p className="mt-0 mb-5 text-[14px] leading-normal text-tinta-2">{detalle}</p>}
        <div className={detalle ? "flex flex-wrap justify-end gap-2.5" : "mt-5 flex flex-wrap justify-end gap-2.5"}>
          <Boton variante="secundario" onClick={() => responder(false)}>
            Cancelar
          </Boton>
          <Boton variante="primario" onClick={() => responder(true)}>
            Confirmar
          </Boton>
        </div>
      </DialogoModal>
    </Contexto.Provider>
  );
}

/** `const pedirConfirmacion = useConfirmacion(); if (!(await pedirConfirmacion("¿Borrar a Ana? Esto no se puede deshacer."))) return;` */
export function useConfirmacion() {
  return useContext(Contexto);
}
