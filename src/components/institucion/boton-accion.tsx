"use client";

import { useTransition } from "react";
import { usePlanActivo } from "@/components/institucion/plan-activo";
import { Boton, type BotonTamano, type BotonVariante } from "@/components/ui/button";
import { useConfirmacion } from "@/components/ui/confirmacion";
import { useToast } from "@/components/ui/toast";

/**
 * Botón que ejecuta una server action ya atada a su recurso (`cerrarBusqueda.bind(null, id)`),
 * muestra el estado pendiente y avisa con un toast si salió bien o mal. Si el servidor responde que el plan no está activo
 * (`codigo: "plan-inactivo"`), en lugar del toast abre el popup de pago.
 */
export function BotonAccion({
  accion,
  children,
  exito,
  confirmar,
  requierePlan,
  variante = "secundario",
  tamano = "sm",
  className,
}: {
  accion: () => Promise<{ ok: boolean; error?: string; codigo?: string }>;
  children: React.ReactNode;
  /** Texto del toast cuando sale bien. */
  exito?: string;
  /** Si está, pide confirmación (diálogo propio, no el del navegador) antes de ejecutar. */
  confirmar?: string;
  /** La acción necesita el plan activo (publicar de nuevo una búsqueda): sin él abre el popup de pago en lugar de ejecutar. */
  requierePlan?: boolean;
  variante?: BotonVariante;
  tamano?: BotonTamano;
  className?: string;
}) {
  const [pendiente, empezar] = useTransition();
  const toast = useToast();
  const pedirConfirmacion = useConfirmacion();
  const { frenarSiHaceFalta, atender } = usePlanActivo();

  const ejecutar = async () => {
    if (requierePlan && frenarSiHaceFalta()) return;
    if (confirmar && !(await pedirConfirmacion(confirmar))) return;
    empezar(async () => {
      try {
        const r = await accion();
        if (!r.ok) {
          if (!atender(r)) toast(r.error ?? "No pudimos completar la acción.", "error");
        } else if (exito) toast(exito);
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
