"use client";

import { useState, useTransition } from "react";
import { registrarPago } from "@/app/actions/backoffice-cobros";
import { Boton, type BotonTamano, type BotonVariante } from "@/components/ui/button";
import { Campo, Select } from "@/components/ui/campos";
import { DialogoModal } from "@/components/ui/dialogo-modal";
import { useToast } from "@/components/ui/toast";
import { MEDIOS_PAGO } from "@/lib/cobros";

export type FacturaParaPago = {
  id: string;
  /** "Septiembre 2026" */
  periodo: string;
  /** "$ 89.000" */
  monto: string;
  /** "12/09/2026" */
  vence: string;
  vencida: boolean;
};

/**
 * Botón "Registrar pago" de una factura impaga. Pide el medio con el que se pagó y registra el pago con la
 * fecha de hoy (el servidor marca la factura como pagada, deja auditoría y le avisa a la institución).
 */
export function CobroPago({
  factura,
  medioInicial,
  variante = "secundario",
  tamano = "sm",
  bloque,
  children = "Registrar pago",
}: {
  factura: FacturaParaPago;
  /** Medio habitual de la institución, para dejarlo preseleccionado. */
  medioInicial?: string | null;
  variante?: BotonVariante;
  tamano?: BotonTamano;
  bloque?: boolean;
  children?: React.ReactNode;
}) {
  const toast = useToast();
  const [pendiente, empezar] = useTransition();
  const [abierto, setAbierto] = useState(false);
  const inicial = (MEDIOS_PAGO as readonly string[]).includes(medioInicial ?? "") ? (medioInicial as string) : "";
  const [medio, setMedio] = useState(inicial);
  const [error, setError] = useState<string | null>(null);

  const abrir = () => {
    setMedio(inicial);
    setError(null);
    setAbierto(true);
  };

  const confirmar = () => {
    if (!medio) {
      setError("Elegí el medio de pago.");
      return;
    }
    setError(null);
    empezar(async () => {
      try {
        const r = await registrarPago(factura.id, medio);
        if (!r.ok) {
          setError(r.error);
          toast(r.error, "error");
          return;
        }
        toast(`Pago de ${factura.periodo} registrado`);
        setAbierto(false);
      } catch {
        toast("No pudimos registrar el pago. Probá de nuevo.", "error");
      }
    });
  };

  return (
    <>
      <Boton variante={variante} tamano={tamano} bloque={bloque} onClick={abrir}>
        {children}
      </Boton>
      <DialogoModal abierto={abierto} onCerrar={() => setAbierto(false)} titulo={`Registrar el pago de ${factura.periodo}`}>
        <p className="m-0 mb-4 text-sm leading-normal text-apagado">
          {factura.monto} · {factura.vencida ? "venció" : "vence"} el {factura.vence}. Se registra con la fecha de hoy y le
          avisamos a la institución.
        </p>
        <div className="mb-4">
          <Campo etiqueta="Medio de pago" requerido error={error ?? undefined}>
            <Select value={medio} onChange={(e) => setMedio(e.target.value)} aria-invalid={!!error || undefined}>
              <option value="">Elegí un medio</option>
              {MEDIOS_PAGO.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </Select>
          </Campo>
        </div>
        <div className="flex gap-2.5">
          <Boton disabled={pendiente} onClick={confirmar}>
            {pendiente ? "Registrando…" : "Registrar pago"}
          </Boton>
          <Boton variante="secundario" disabled={pendiente} onClick={() => setAbierto(false)}>
            Cancelar
          </Boton>
        </div>
      </DialogoModal>
    </>
  );
}
