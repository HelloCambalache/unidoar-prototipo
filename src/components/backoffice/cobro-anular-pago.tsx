"use client";

import { useState, useTransition } from "react";
import { anularPago } from "@/app/actions/backoffice-cobros";
import { Boton } from "@/components/ui/button";
import { Campo, Casilla, Textarea } from "@/components/ui/campos";
import { DialogoModal } from "@/components/ui/dialogo-modal";
import { useToast } from "@/components/ui/toast";
import type { FacturaParaPago } from "./cobro-pago";

/**
 * "Anular pago" de una factura registrada como paga: la deja otra vez impaga. Pide el motivo (queda en el registro
 * del equipo) y deja elegir si se le avisa a la institución, que ya había recibido "registró tu pago".
 */
export function CobroAnularPago({ factura }: { factura: Pick<FacturaParaPago, "id" | "periodo" | "monto"> }) {
  const toast = useToast();
  const [pendiente, empezar] = useTransition();
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [avisar, setAvisar] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const abrir = () => {
    setMotivo("");
    setAvisar(true);
    setError(null);
    setAbierto(true);
  };

  const confirmar = () => {
    if (motivo.trim().length < 3) {
      setError("Contá el motivo: queda en el registro del equipo.");
      return;
    }
    setError(null);
    empezar(async () => {
      try {
        const r = await anularPago(factura.id, { motivo, avisar });
        if (!r.ok) {
          setError(r.campos?.motivo ?? r.error);
          toast(r.error, "error");
          return;
        }
        toast(r.data.eliminada ? `Pago de ${factura.periodo} anulado: la factura, que había creado ese pago, se eliminó.` : `Pago de ${factura.periodo} anulado`);
        setAbierto(false);
      } catch {
        toast("No pudimos anular el pago. Probá de nuevo.", "error");
      }
    });
  };

  return (
    <>
      <Boton variante="fantasma" tamano="sm" onClick={abrir} aria-label={`Anular el pago de ${factura.periodo}`}>
        Anular pago
      </Boton>
      <DialogoModal abierto={abierto} onCerrar={() => setAbierto(false)} titulo={`Anular el pago de ${factura.periodo}`}>
        <p className="m-0 mb-4 text-sm leading-normal text-apagado">
          {factura.monto}. Deja la factura como estaba antes del pago: si el pago la creó (no existía), se elimina; si era un semestre
          sobre una factura impaga, vuelve a ser la de un solo mes; y si ya existía, vuelve a figurar como impaga (vencida, si ya pasó su
          fecha) y se borran la fecha y el medio del pago. Usalo si se registró por error.
        </p>
        <div className="mb-3.5">
          <Campo etiqueta="Motivo" requerido error={error ?? undefined} ayuda="Queda en el registro del equipo.">
            <Textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              maxLength={300}
              rows={3}
              aria-invalid={!!error || undefined}
            />
          </Campo>
        </div>
        <Casilla checked={avisar} onChange={(e) => setAvisar(e.target.checked)} className="mb-5">
          Avisarle a la institución que corregimos el registro
        </Casilla>
        <div className="flex gap-2.5">
          <Boton variante="peligro" disabled={pendiente} onClick={confirmar}>
            {pendiente ? "Anulando…" : "Anular pago"}
          </Boton>
          <Boton variante="secundario" disabled={pendiente} onClick={() => setAbierto(false)}>
            Cancelar
          </Boton>
        </div>
      </DialogoModal>
    </>
  );
}
