"use client";

import { useState, useTransition } from "react";
import { reactivarDocente, suspenderDocente } from "@/app/actions/backoffice-docentes";
import { Boton } from "@/components/ui/button";
import { Campo, Textarea } from "@/components/ui/campos";
import { useToast } from "@/components/ui/toast";

/**
 * Suspender / reactivar la cuenta de un docente. Suspender pide un motivo (queda en el registro y le llega al
 * docente); reactivar acepta una nota opcional. La acción vuelve a chequear todo en el servidor.
 */
export function DocAccionesCuenta({
  docenteId,
  nombre,
  suspendido,
  tieneCuenta,
}: {
  docenteId: string;
  nombre: string;
  suspendido: boolean;
  /** Sin cuenta (perfil de ejemplo) no hay a quién avisar ni acceso que bloquear: se aclara en pantalla. */
  tieneCuenta: boolean;
}) {
  const toast = useToast();
  const [pendiente, empezar] = useTransition();
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState("");
  const [error, setError] = useState<string | null>(null);
  const idCampo = `nota-cuenta-${docenteId}`;

  const cerrar = () => {
    setAbierto(false);
    setTexto("");
    setError(null);
  };

  const confirmar = () => {
    if (!suspendido && texto.trim().length < 5) {
      setError("Contá el motivo (mínimo 5 caracteres): queda en el registro y se le avisa al profesional.");
      document.getElementById(idCampo)?.focus();
      return;
    }
    setError(null);
    empezar(async () => {
      try {
        const r = suspendido ? await reactivarDocente(docenteId, { nota: texto }) : await suspenderDocente(docenteId, { motivo: texto });
        if (!r.ok) {
          setError(r.error);
          toast(r.error, "error");
          return;
        }
        toast(suspendido ? "Cuenta reactivada" : "Cuenta suspendida");
        cerrar();
      } catch {
        toast("No pudimos completar la acción. Probá de nuevo.", "error");
      }
    });
  };

  if (!abierto) {
    return (
      <Boton
        variante={suspendido ? "exito" : "secundario"}
        bloque
        onClick={() => setAbierto(true)}
        className={suspendido ? undefined : "text-[#8F3D28]"}
      >
        {suspendido ? "Reactivar cuenta" : "Suspender cuenta"}
      </Boton>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-borde bg-superficie p-3.5" aria-busy={pendiente}>
      <p className="m-0 text-[13px] leading-normal text-tinta-2">
        {suspendido
          ? `${nombre} va a poder volver a entrar a su cuenta.`
          : `${nombre} no va a poder entrar a su cuenta hasta que la reactives.`}
        {!tieneCuenta && " Es un perfil sin cuenta de acceso: no recibe aviso."}
      </p>
      <Campo
        etiqueta={suspendido ? "Nota (opcional)" : "Motivo"}
        requerido={!suspendido}
        ayuda="Queda en el registro del equipo."
        error={error ?? undefined}
      >
        <Textarea
          id={idCampo}
          value={texto}
          maxLength={500}
          rows={3}
          aria-invalid={error ? true : undefined}
          onChange={(e) => setTexto(e.target.value)}
        />
      </Campo>
      <div className="flex flex-wrap gap-2">
        <Boton tamano="sm" variante={suspendido ? "primario" : "peligro"} disabled={pendiente} onClick={confirmar}>
          {pendiente ? "Guardando…" : suspendido ? "Confirmar reactivación" : "Confirmar suspensión"}
        </Boton>
        <Boton tamano="sm" variante="fantasma" disabled={pendiente} onClick={cerrar}>
          Cancelar
        </Boton>
      </div>
    </div>
  );
}
