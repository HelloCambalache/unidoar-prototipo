"use client";

import { useTransition } from "react";
import { marcarMensajeAtendido } from "@/app/actions/backoffice-mensajes";
import { Boton } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

/** Marca un mensaje como atendido (o lo devuelve a "sin atender"). */
export function MsjAtendido({ mensajeId, atendido }: { mensajeId: string; atendido: boolean }) {
  const toast = useToast();
  const [pendiente, empezar] = useTransition();

  return (
    <Boton
      tamano="sm"
      variante={atendido ? "fantasma" : "exito"}
      disabled={pendiente}
      aria-busy={pendiente}
      onClick={() =>
        empezar(async () => {
          try {
            const r = await marcarMensajeAtendido(mensajeId, !atendido);
            if (!r.ok) toast(r.error, "error");
            else toast(atendido ? "Mensaje devuelto a sin atender" : "Mensaje marcado como atendido");
          } catch {
            toast("No pudimos actualizar el mensaje. Probá de nuevo.", "error");
          }
        })
      }
    >
      {atendido ? "Marcar sin atender" : "✓ Marcar como atendido"}
    </Boton>
  );
}
