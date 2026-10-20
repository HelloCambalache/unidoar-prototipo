"use client";

import { useTransition } from "react";
import { verificarTitulo } from "@/app/actions/backoffice-verificacion";
import { Boton } from "@/components/ui/button";
import { useConfirmacion } from "@/components/ui/confirmacion";
import { useToast } from "@/components/ui/toast";

/**
 * Valida el título de un profesional que ya estaba verificado (quien estudiaba, se recibió y lo subió desde Mi perfil).
 * Se muestra en la ficha solo cuando hay un título cargado sin validar; el servidor lo vuelve a comprobar.
 */
export function DocVerificarTitulo({ docenteId, nombre }: { docenteId: string; nombre: string }) {
  const toast = useToast();
  const pedirConfirmacion = useConfirmacion();
  const [pendiente, empezar] = useTransition();

  const verificar = async () => {
    if (!(await pedirConfirmacion(`¿Confirmás que revisaste el título de ${nombre}? Las instituciones lo van a ver como verificado.`))) return;
    empezar(async () => {
      try {
        const r = await verificarTitulo(docenteId);
        if (r.ok) toast("Título verificado");
        else toast(r.error, "error");
      } catch {
        toast("No pudimos completar la acción. Probá de nuevo.", "error");
      }
    });
  };

  return (
    <Boton tamano="sm" variante="secundario" disabled={pendiente} onClick={verificar}>
      {pendiente ? "Guardando…" : "Verificar título"}
    </Boton>
  );
}
