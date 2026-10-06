"use client";

import { useTransition } from "react";
import { marcarFacturasVencidas } from "@/app/actions/backoffice-cobros";
import { Boton } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

/**
 * La tabla ya muestra como vencida toda factura pendiente con la fecha pasada; este botón guarda ese estado
 * en la base, que es lo que ven las instituciones en su plan. Solo aparece si hay algo para marcar.
 */
export function CobroMarcarVencidas({ cantidad }: { cantidad: number }) {
  const toast = useToast();
  const [pendiente, empezar] = useTransition();
  if (cantidad === 0) return null;

  return (
    <Boton
      variante="secundario"
      disabled={pendiente}
      aria-busy={pendiente}
      title="Guarda como vencidas las facturas pendientes cuya fecha de cobro ya pasó"
      onClick={() =>
        empezar(async () => {
          try {
            const r = await marcarFacturasVencidas();
            if (!r.ok) toast(r.error, "error");
            else toast(r.data.cantidad === 1 ? "1 factura marcada como vencida" : `${r.data.cantidad} facturas marcadas como vencidas`);
          } catch {
            toast("No pudimos marcar las facturas. Probá de nuevo.", "error");
          }
        })
      }
    >
      {pendiente ? "Marcando…" : `Marcar vencidas (${cantidad})`}
    </Boton>
  );
}
