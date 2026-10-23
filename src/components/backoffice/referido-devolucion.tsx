"use client";

import { useTransition } from "react";
import { marcarDevolucionDeMes } from "@/app/actions/backoffice-referidos";
import { Boton } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

/** Marca que el equipo ya devolvió, desde Mercado Pago, el cobro de un mes bonificado por recomendar (o lo desmarca si fue un error). */
export function ReferidoDevolucion({ mesId, devuelto }: { mesId: string; devuelto: boolean }) {
  const toast = useToast();
  const [pendiente, empezar] = useTransition();

  return (
    <Boton
      tamano="sm"
      variante={devuelto ? "fantasma" : "exito"}
      disabled={pendiente}
      aria-busy={pendiente}
      onClick={() =>
        empezar(async () => {
          try {
            const r = await marcarDevolucionDeMes(mesId, !devuelto);
            if (!r.ok) toast(r.error, "error");
            else toast(devuelto ? "Devolución desmarcada" : "Devolución marcada como hecha");
          } catch {
            toast("No pudimos actualizar la devolución. Probá de nuevo.", "error");
          }
        })
      }
    >
      {devuelto ? "Deshacer" : "✓ Ya la devolví"}
    </Boton>
  );
}
