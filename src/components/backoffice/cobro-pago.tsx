"use client";

import { useState, useTransition } from "react";
import { registrarPago } from "@/app/actions/backoffice-cobros";
import { Boton, type BotonTamano, type BotonVariante } from "@/components/ui/button";
import { Campo, Input, Select } from "@/components/ui/campos";
import { DialogoModal } from "@/components/ui/dialogo-modal";
import { useToast } from "@/components/ui/toast";
import { DIAS_MAXIMOS_PAGO_ATRASADO, errorDeFechaDePago, hoyAR, MEDIOS_PAGO } from "@/lib/cobros";

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
 * Botón "Registrar pago" de una factura impaga. Pide el medio con el que se pagó y la fecha en que llegó el pago
 * (hoy por defecto); el servidor marca la factura como pagada, deja auditoría y le avisa a la institución.
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
  const [fecha, setFecha] = useState(() => hoyAR());
  const [errorFecha, setErrorFecha] = useState<string | null>(null);

  const abrir = () => {
    setMedio(inicial);
    setFecha(hoyAR());
    setError(null);
    setErrorFecha(null);
    setAbierto(true);
  };

  const confirmar = () => {
    const falloFecha = fecha ? errorDeFechaDePago(fecha, hoyAR()) : "Elegí la fecha del pago.";
    setError(medio ? null : "Elegí el medio de pago.");
    setErrorFecha(falloFecha);
    if (!medio || falloFecha) return;
    empezar(async () => {
      try {
        const r = await registrarPago(factura.id, medio, fecha);
        if (!r.ok) {
          // Un error de fecha va junto al campo de fecha; el resto, junto al medio.
          if (r.campos?.fecha) setErrorFecha(r.campos.fecha);
          else setError(r.error);
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
          {factura.monto} · {factura.vencida ? "venció" : "vence"} el {factura.vence}. Elegí cómo y cuándo llegó el pago; le
          avisamos a la institución.
        </p>
        <div className="mb-3.5">
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
        <div className="mb-4">
          <Campo
            etiqueta="Fecha del pago"
            requerido
            error={errorFecha ?? undefined}
            ayuda="Por defecto, hoy. Cambiala si el pago llegó antes."
          >
            <Input
              type="date"
              value={fecha}
              max={hoyAR()}
              min={new Date(Date.parse(`${hoyAR()}T00:00:00Z`) - DIAS_MAXIMOS_PAGO_ATRASADO * 86_400_000)
                .toISOString()
                .slice(0, 10)}
              onChange={(e) => setFecha(e.target.value)}
              aria-invalid={!!errorFecha || undefined}
            />
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
