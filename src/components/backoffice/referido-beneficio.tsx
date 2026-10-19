"use client";

import { useTransition } from "react";
import { marcarBeneficioDeReferido } from "@/app/actions/backoffice-referidos";
import { Boton } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

/** Marca que el equipo ya aplicó el beneficio de una recomendación (o lo deshace si fue un error). */
export function ReferidoBeneficio({ referidoId, aplicado }: { referidoId: string; aplicado: boolean }) {
  const toast = useToast();
  const [pendiente, empezar] = useTransition();

  return (
    <Boton
      tamano="sm"
      variante={aplicado ? "fantasma" : "exito"}
      disabled={pendiente}
      aria-busy={pendiente}
      onClick={() =>
        empezar(async () => {
          try {
            const r = await marcarBeneficioDeReferido(referidoId, !aplicado);
            if (!r.ok) toast(r.error, "error");
            else toast(aplicado ? "Beneficio devuelto a pendiente" : "Beneficio marcado como aplicado");
          } catch {
            toast("No pudimos actualizar el beneficio. Probá de nuevo.", "error");
          }
        })
      }
    >
      {aplicado ? "Deshacer" : "✓ Marcar beneficio aplicado"}
    </Boton>
  );
}
