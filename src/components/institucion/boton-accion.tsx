"use client";

import { useTransition } from "react";
import { Boton, type BotonTamano, type BotonVariante } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

/**
 * Botón que ejecuta una server action ya atada a su recurso (`cerrarBusqueda.bind(null, id)`),
 * muestra el estado pendiente y avisa con un toast si salió bien o mal.
 */
export function BotonAccion({
  accion,
  children,
  exito,
  confirmar,
  variante = "secundario",
  tamano = "sm",
  className,
}: {
  accion: () => Promise<{ ok: boolean; error?: string }>;
  children: React.ReactNode;
  /** Texto del toast cuando sale bien. */
  exito?: string;
  /** Si está, pide confirmación nativa antes de ejecutar. */
  confirmar?: string;
  variante?: BotonVariante;
  tamano?: BotonTamano;
  className?: string;
}) {
  const [pendiente, empezar] = useTransition();
  const toast = useToast();

  const ejecutar = () => {
    if (confirmar && !window.confirm(confirmar)) return;
    empezar(async () => {
      try {
        const r = await accion();
        if (!r.ok) toast(r.error ?? "No pudimos completar la acción.", "error");
        else if (exito) toast(exito);
      } catch {
        toast("No pudimos completar la acción. Probá de nuevo.", "error");
      }
    });
  };

  return (
    <Boton variante={variante} tamano={tamano} className={className} disabled={pendiente} aria-busy={pendiente} onClick={ejecutar}>
      {children}
    </Boton>
  );
}
