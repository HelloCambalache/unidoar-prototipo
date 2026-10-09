"use client";

import { useState, useTransition } from "react";
import { cargarFactura } from "@/app/actions/backoffice-cobros";
import { Boton } from "@/components/ui/button";
import { Campo, Input, Select } from "@/components/ui/campos";
import { DialogoModal } from "@/components/ui/dialogo-modal";
import { useToast } from "@/components/ui/toast";
import { clavesParaElegir, etiquetaPeriodo, fechaCobroDelPeriodo, MEDIOS_PAGO, montoDePlan, precioDePlan } from "@/lib/cobros";
import { PLANES, pesos, type PlanClave } from "@/lib/planes";

const PERIODO_VALIDO = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * Carga la factura de un mes. El monto sale del plan elegido (lo calcula el servidor) y la factura queda pendiente:
 * si la fecha de cobro ya pasó, se ve como vencida. No se puede repetir el mes de una institución.
 */
export function CobroNuevaFactura({
  institucionId,
  plan,
  diaCobro,
  medioPago,
  periodoSugerido,
}: {
  institucionId: string;
  plan: PlanClave;
  diaCobro: number | null;
  medioPago: string | null;
  /** Primer mes que todavía no tiene factura ("2026-11"). */
  periodoSugerido: string;
}) {
  const toast = useToast();
  const [pendiente, empezar] = useTransition();
  const [abierto, setAbierto] = useState(false);
  const medioInicial = (MEDIOS_PAGO as readonly string[]).includes(medioPago ?? "") ? (medioPago as string) : "";

  const [periodo, setPeriodo] = useState(periodoSugerido);
  const [planElegido, setPlanElegido] = useState<PlanClave>(plan);
  const [fecha, setFecha] = useState(() => fechaCobroDelPeriodo(periodoSugerido, diaCobro));
  const [fechaEditada, setFechaEditada] = useState(false);
  const [medio, setMedio] = useState(medioInicial);
  const [errores, setErrores] = useState<Record<string, string>>({});

  const abrir = () => {
    setPeriodo(periodoSugerido);
    setPlanElegido(plan);
    setFecha(fechaCobroDelPeriodo(periodoSugerido, diaCobro));
    setFechaEditada(false);
    setMedio(medioInicial);
    setErrores({});
    setAbierto(true);
  };

  const cambiarPeriodo = (valor: string) => {
    setPeriodo(valor);
    // Mientras nadie toque la fecha, sigue al mes elegido con el día de cobro de la institución.
    if (!fechaEditada && PERIODO_VALIDO.test(valor)) setFecha(fechaCobroDelPeriodo(valor, diaCobro));
  };

  const guardar = () => {
    setErrores({});
    empezar(async () => {
      try {
        const r = await cargarFactura(institucionId, { periodo, plan: planElegido, fechaCobro: fecha, medio });
        if (!r.ok) {
          setErrores(r.campos ?? { _: r.error });
          toast(r.error, "error");
          return;
        }
        toast(`Factura de ${etiquetaPeriodo(periodo).toLowerCase()} cargada`);
        setAbierto(false);
      } catch {
        toast("No pudimos cargar la factura. Probá de nuevo.", "error");
      }
    });
  };

  return (
    <>
      <Boton variante="secundario" bloque onClick={abrir}>
        Cargar factura
      </Boton>
      <DialogoModal abierto={abierto} onCerrar={() => setAbierto(false)} titulo="Cargar una factura">
        <p className="m-0 mb-4 text-sm leading-normal text-apagado">
          Queda pendiente hasta que registres el pago. El monto sale del plan que elijas.
        </p>
        <div className="mb-4 grid grid-cols-2 gap-3 max-[520px]:grid-cols-1">
          <Campo etiqueta="Período" requerido error={errores.periodo}>
            <Input
              type="month"
              value={periodo}
              pattern="\d{4}-\d{2}"
              placeholder="2026-11"
              onChange={(e) => cambiarPeriodo(e.target.value)}
              aria-invalid={!!errores.periodo || undefined}
            />
          </Campo>
          <Campo etiqueta="Fecha de cobro" requerido error={errores.fechaCobro}>
            <Input
              type="date"
              value={fecha}
              onChange={(e) => {
                setFecha(e.target.value);
                setFechaEditada(true);
              }}
              aria-invalid={!!errores.fechaCobro || undefined}
            />
          </Campo>
          <Campo etiqueta="Plan" requerido error={errores.plan}>
            <Select value={planElegido} onChange={(e) => setPlanElegido(e.target.value as PlanClave)}>
              {clavesParaElegir(plan).map((c) => (
                <option key={c} value={c}>
                  {PLANES[c].label} · {precioDePlan(c)}
                </option>
              ))}
            </Select>
          </Campo>
          <Campo etiqueta="Medio de pago" error={errores.medio} ayuda="Opcional">
            <Select value={medio} onChange={(e) => setMedio(e.target.value)}>
              <option value="">Sin definir</option>
              {MEDIOS_PAGO.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </Select>
          </Campo>
        </div>
        <p className="m-0 mb-4 rounded-lg bg-superficie px-3.5 py-2.5 text-[13px] leading-normal text-tinta-2">
          Monto de la factura: <b className="font-semibold">{pesos(montoDePlan(planElegido))}</b>
          {PLANES[planElegido].porSede && " por sede: multiplicalo por las sedes de la red al registrar el pago."}
        </p>
        {errores._ && (
          <p role="alert" className="m-0 mb-3 text-xs text-[#b91c1c]">
            {errores._}
          </p>
        )}
        <div className="flex gap-2.5">
          <Boton disabled={pendiente} onClick={guardar}>
            {pendiente ? "Cargando…" : "Cargar factura"}
          </Boton>
          <Boton variante="secundario" disabled={pendiente} onClick={() => setAbierto(false)}>
            Cancelar
          </Boton>
        </div>
      </DialogoModal>
    </>
  );
}
