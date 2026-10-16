"use client";

import { useState, useTransition } from "react";
import { reabrirRevision } from "@/app/actions/backoffice-verificacion";
import { Boton } from "@/components/ui/button";
import { Campo, Textarea } from "@/components/ui/campos";
import { useToast } from "@/components/ui/toast";
import { MENSAJE_REAPERTURA } from "@/lib/backoffice-docentes";

/**
 * "Reabrir la revisión" de un profesional rechazado: pasa a «Corrección pedida» y puede volver a subir su documentación (al
 * guardar vuelve a la cola). Es la salida de un rechazo: la persona no puede editar nada y, como su cuenta existe, tampoco
 * registrarse de nuevo. El mensaje es opcional; sin uno se le manda el texto de siempre. La acción vuelve a chequear todo.
 */
export function DocReabrirRevision({ docenteId, nombre }: { docenteId: string; nombre: string }) {
  const toast = useToast();
  const [pendiente, empezar] = useTransition();
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState("");
  const [error, setError] = useState<string | null>(null);

  const cerrar = () => {
    setAbierto(false);
    setTexto("");
    setError(null);
  };

  const confirmar = () => {
    setError(null);
    empezar(async () => {
      try {
        const r = await reabrirRevision(docenteId, { mensaje: texto });
        if (!r.ok) {
          setError(r.error);
          toast(r.error, "error");
          return;
        }
        toast("Revisión reabierta: le avisamos a la persona");
        cerrar();
      } catch {
        toast("No pudimos completar la acción. Probá de nuevo.", "error");
      }
    });
  };

  if (!abierto) {
    return (
      <Boton variante="primario" bloque onClick={() => setAbierto(true)}>
        Reabrir la revisión
      </Boton>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-caja border border-borde bg-superficie p-3.5" aria-busy={pendiente}>
      <p className="m-0 text-[13px] leading-normal text-tinta-2">
        {nombre} va a poder volver a subir su documentación y, cuando la guarde, vuelve a la cola de verificación. Le llega un aviso y un
        mail.
      </p>
      <Campo etiqueta="Mensaje para la persona (opcional)" ayuda="Si lo dejás vacío, le decimos que subió de nuevo la documentación que haga falta." error={error ?? undefined}>
        <Textarea
          value={texto}
          maxLength={500}
          rows={3}
          placeholder={MENSAJE_REAPERTURA}
          aria-invalid={error ? true : undefined}
          onChange={(e) => setTexto(e.target.value)}
        />
      </Campo>
      <div className="flex flex-wrap gap-2">
        <Boton tamano="sm" disabled={pendiente} onClick={confirmar}>
          {pendiente ? "Guardando…" : "Confirmar y avisar"}
        </Boton>
        <Boton tamano="sm" variante="fantasma" disabled={pendiente} onClick={cerrar}>
          Cancelar
        </Boton>
      </div>
    </div>
  );
}
