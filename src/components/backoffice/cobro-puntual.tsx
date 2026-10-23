"use client";

import { useState, useTransition } from "react";
import { anularPagoDeBusquedaPuntual, registrarPagoDeBusquedaPuntual } from "@/app/actions/backoffice-puntuales";
import { Boton } from "@/components/ui/button";
import { Campo, Casilla, Input, Select, Textarea } from "@/components/ui/campos";
import { DialogoModal } from "@/components/ui/dialogo-modal";
import { useToast } from "@/components/ui/toast";
import { DIAS_MAXIMOS_PAGO_ATRASADO, errorDeFechaDePago, hoyAR, MEDIOS_PUNTUAL } from "@/lib/cobros";

/**
 * «Registrar pago de búsqueda puntual»: la institución con el plan sin abono pagó UNA búsqueda (por transferencia, efectivo, etc.) y queda con una
 * búsqueda pagada para publicar. El monto lo calcula el servidor (el del plan o el acordado); acá se muestra para ver qué se va a registrar.
 */
export function CobroPuntualPago({
  institucionId,
  monto,
  vigenciaDias,
}: {
  institucionId: string;
  /** Lo que cuesta la búsqueda para esta institución, ya escrito ("$ 110.000"). */
  monto: string;
  vigenciaDias: number;
}) {
  const toast = useToast();
  const [pendiente, empezar] = useTransition();
  const [abierto, setAbierto] = useState(false);
  const [medio, setMedio] = useState<(typeof MEDIOS_PUNTUAL)[number]>("Transferencia");
  const [fecha, setFecha] = useState(() => hoyAR());
  const [nota, setNota] = useState("");
  const [avisar, setAvisar] = useState(true);
  const [errores, setErrores] = useState<Record<string, string>>({});

  const abrir = () => {
    setMedio("Transferencia");
    setFecha(hoyAR());
    setNota("");
    setAvisar(true);
    setErrores({});
    setAbierto(true);
  };

  const guardar = () => {
    const falloFecha = fecha ? errorDeFechaDePago(fecha, hoyAR()) : "Elegí la fecha del pago.";
    if (falloFecha) {
      setErrores({ fecha: falloFecha });
      return;
    }
    setErrores({});
    empezar(async () => {
      try {
        const r = await registrarPagoDeBusquedaPuntual(institucionId, { medio, fecha, nota, avisar });
        if (!r.ok) {
          setErrores(r.campos ?? { _: r.error });
          toast(r.error, "error");
          return;
        }
        toast("Pago registrado: la institución ya puede publicar su búsqueda");
        setAbierto(false);
      } catch {
        toast("No pudimos registrar el pago. Probá de nuevo.", "error");
      }
    });
  };

  return (
    <>
      <Boton variante="primario" bloque onClick={abrir}>
        Registrar pago de búsqueda puntual
      </Boton>
      <DialogoModal abierto={abierto} onCerrar={() => setAbierto(false)} titulo="Registrar el pago de una búsqueda puntual">
        <p className="m-0 mb-4 text-sm leading-normal text-apagado">
          La institución pagó <b className="font-semibold text-tinta">{monto}</b> por una búsqueda. Al registrarlo queda con una búsqueda pagada para publicar:
          se publica una vez y queda abierta {vigenciaDias} días.
        </p>
        <div className="mb-4 grid grid-cols-2 gap-3 max-[520px]:grid-cols-1">
          <Campo etiqueta="Cómo pagó" requerido error={errores.medio}>
            <Select value={medio} onChange={(e) => setMedio(e.target.value as (typeof MEDIOS_PUNTUAL)[number])}>
              {MEDIOS_PUNTUAL.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </Select>
          </Campo>
          <Campo etiqueta="Fecha del pago" requerido error={errores.fecha} ayuda="Por defecto, hoy. Cambiala si lo recibiste antes.">
            <Input
              type="date"
              value={fecha}
              max={hoyAR()}
              min={new Date(Date.parse(`${hoyAR()}T00:00:00Z`) - DIAS_MAXIMOS_PAGO_ATRASADO * 86_400_000)
                .toISOString()
                .slice(0, 10)}
              onChange={(e) => setFecha(e.target.value)}
              aria-invalid={!!errores.fecha || undefined}
            />
          </Campo>
          <Campo etiqueta="Nota" error={errores.nota} ayuda="Optativa. Por ejemplo, el número de recibo." className="min-[521px]:col-span-2">
            <Input value={nota} maxLength={120} onChange={(e) => setNota(e.target.value)} aria-invalid={!!errores.nota || undefined} />
          </Campo>
        </div>
        <Casilla checked={avisar} onChange={(e) => setAvisar(e.target.checked)} className="mb-4">
          Avisarle a la institución que registramos su pago
        </Casilla>
        {errores._ && (
          <p role="alert" className="m-0 mb-3 text-xs text-[#b91c1c]">
            {errores._}
          </p>
        )}
        <div className="flex gap-2.5">
          <Boton disabled={pendiente} onClick={guardar}>
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

/** «Anular» el pago de una búsqueda puntual que todavía no se usó: pide el motivo (queda en la actividad) y deja elegir si se avisa. */
export function CobroPuntualAnular({ creditoId, monto }: { creditoId: string; monto: string }) {
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
        const r = await anularPagoDeBusquedaPuntual(creditoId, { motivo, avisar });
        if (!r.ok) {
          setError(r.campos?.motivo ?? r.error);
          toast(r.error, "error");
          return;
        }
        toast("Pago anulado");
        setAbierto(false);
      } catch {
        toast("No pudimos anular el pago. Probá de nuevo.", "error");
      }
    });
  };

  return (
    <>
      <Boton variante="fantasma" tamano="sm" onClick={abrir} aria-label={`Anular el pago de ${monto}`}>
        Anular
      </Boton>
      <DialogoModal abierto={abierto} onCerrar={() => setAbierto(false)} titulo="Anular el pago de la búsqueda">
        <p className="m-0 mb-4 text-sm leading-normal text-apagado">
          {monto}. La institución pierde esa búsqueda pagada (todavía no la publicó). Usalo si se registró por error.
        </p>
        <div className="mb-3.5">
          <Campo etiqueta="Motivo" requerido error={error ?? undefined} ayuda="Queda en el registro del equipo.">
            <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={300} rows={3} aria-invalid={!!error || undefined} />
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
