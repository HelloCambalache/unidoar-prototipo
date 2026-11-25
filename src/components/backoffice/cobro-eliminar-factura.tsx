"use client";

import { useState, useTransition } from "react";
import { eliminarFactura } from "@/app/actions/backoffice-cobros";
import { Boton } from "@/components/ui/button";
import { Campo, Textarea } from "@/components/ui/campos";
import { DialogoModal } from "@/components/ui/dialogo-modal";
import { useToast } from "@/components/ui/toast";
import { advertenciasAlEliminarFactura } from "@/lib/cobros";
import type { FacturaParaPago } from "./cobro-pago";

/**
 * «Eliminar» una factura impaga: quita la deuda (por ejemplo la de una institución que se anotó en el arancel equivocado y nunca pagó). Pide el
 * motivo —queda en el registro del equipo, con una copia de lo que se borró— y avisa lo que conviene saber antes: la del mes en curso se vuelve a
 * crear sola, y quitar la deuda no habilita a quien nunca pagó. No se le avisa a la institución.
 */
export function CobroEliminarFactura({
  factura,
  periodo,
  periodoActual,
  otrasFacturas,
  sinPagos,
}: {
  factura: Pick<FacturaParaPago, "id" | "periodo" | "monto">;
  /** El período de la factura, «AAAA-MM» (la etiqueta de `factura.periodo` es para mostrar). */
  periodo: string;
  periodoActual: string;
  /** Cuántas otras facturas tiene la institución. */
  otrasFacturas: number;
  /** Si la institución no tiene ninguna factura paga. */
  sinPagos: boolean;
}) {
  const toast = useToast();
  const [pendiente, empezar] = useTransition();
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);

  const advertencias = advertenciasAlEliminarFactura({ periodo }, { periodoActual, otrasFacturas, sinPagos });

  const abrir = () => {
    setMotivo("");
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
        const r = await eliminarFactura(factura.id, { motivo });
        if (!r.ok) {
          setError(r.campos?.motivo ?? r.error);
          toast(r.error, "error");
          return;
        }
        toast(`Factura de ${factura.periodo} eliminada`);
        setAbierto(false);
      } catch {
        toast("No pudimos eliminar la factura. Probá de nuevo.", "error");
      }
    });
  };

  return (
    <>
      <Boton variante="fantasma" tamano="sm" onClick={abrir} aria-label={`Eliminar la factura de ${factura.periodo}`}>
        Eliminar
      </Boton>
      <DialogoModal abierto={abierto} onCerrar={() => setAbierto(false)} titulo={`Eliminar la factura de ${factura.periodo}`}>
        <p className="m-0 mb-3 text-sm leading-normal text-apagado">
          {factura.monto}, impaga. Se borra la factura y deja de figurar como deuda (en la ficha de la institución, en lo que ve ella y en los avisos de
          vencimiento). Usalo si se cargó o se generó por error, por ejemplo con un arancel equivocado. No se le avisa a la institución.
        </p>
        {advertencias.map((texto) => (
          <p
            key={texto}
            role="note"
            className="m-0 mb-3 rounded-caja border border-[#F2D9B3] bg-[#FEF1DF] px-3.5 py-2.5 text-[13px] leading-normal text-[#8A4B07]"
          >
            {texto}
          </p>
        ))}
        <div className="mb-5">
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
        <div className="flex gap-2.5">
          <Boton variante="peligro" disabled={pendiente} onClick={confirmar}>
            {pendiente ? "Eliminando…" : "Eliminar factura"}
          </Boton>
          <Boton variante="secundario" disabled={pendiente} onClick={() => setAbierto(false)}>
            Cancelar
          </Boton>
        </div>
      </DialogoModal>
    </>
  );
}
