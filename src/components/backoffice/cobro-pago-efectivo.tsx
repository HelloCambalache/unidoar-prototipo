"use client";

import { useState, useTransition } from "react";
import { registrarPagoEnEfectivo } from "@/app/actions/backoffice-cobros";
import { Boton } from "@/components/ui/button";
import { Campo, Casilla, Input, Select } from "@/components/ui/campos";
import { DialogoModal } from "@/components/ui/dialogo-modal";
import { useToast } from "@/components/ui/toast";
import { DIAS_MAXIMOS_PAGO_ATRASADO, errorDeFechaDePago, etiquetaPeriodo, hoyAR, situacionDelMes } from "@/lib/cobros";
import { CLAVES_PLAN, crearPlanes, pesos, type CatalogoDePlanes, type PlanClave } from "@/lib/planes";

const PERIODO_VALIDO = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Lo mínimo de cada factura de la institución que hace falta para saber qué pasa con el mes elegido. */
export type FacturaDelMes = { periodo: string; pagada: boolean; monto: number };

/**
 * "Registrar pago en efectivo": un solo paso, sin cargar antes la factura. Si el mes elegido ya tiene una factura impaga el pago
 * se registra sobre ella; si no tiene, se crea ya paga con el monto del plan. Un mes que ya está pago no se puede repetir. El
 * monto lo calcula el servidor; acá solo se muestra para que quien lo registra vea qué va a pasar.
 */
export function CobroPagoEfectivo({
  institucionId,
  sedes,
  catalogo,
  plan,
  periodoSugerido,
  facturas,
}: {
  institucionId: string;
  /** Cuántas sedes tiene la institución (el monto de un plan por sede se multiplica por esto). */
  sedes: number;
  /** Los planes vigentes (los lee el servidor de la base). */
  catalogo: CatalogoDePlanes;
  plan: PlanClave;
  /** Mes que se propone: la factura impaga más antigua o, si no hay, el primer mes sin factura ("2026-11"). */
  periodoSugerido: string;
  facturas: FacturaDelMes[];
}) {
  const P = crearPlanes(catalogo);
  const toast = useToast();
  const [pendiente, empezar] = useTransition();
  const [abierto, setAbierto] = useState(false);
  const [periodo, setPeriodo] = useState(periodoSugerido);
  const [planElegido, setPlanElegido] = useState<PlanClave>(plan);
  const [fecha, setFecha] = useState(() => hoyAR());
  const [nota, setNota] = useState("");
  const [avisar, setAvisar] = useState(true);
  const [errores, setErrores] = useState<Record<string, string>>({});

  const abrir = () => {
    setPeriodo(periodoSugerido);
    setPlanElegido(plan);
    setFecha(hoyAR());
    setNota("");
    setAvisar(true);
    setErrores({});
    setAbierto(true);
  };

  const factura = PERIODO_VALIDO.test(periodo) ? facturas.find((f) => f.periodo === periodo) : undefined;
  const situacion = situacionDelMes(factura ? { estado: factura.pagada ? "pagada" : "pendiente" } : null);
  const monto = factura ? factura.monto : P.montoDePlan(planElegido, sedes);

  const guardar = () => {
    const falloFecha = fecha ? errorDeFechaDePago(fecha, hoyAR()) : "Elegí la fecha del pago.";
    if (falloFecha) {
      setErrores({ fecha: falloFecha });
      return;
    }
    setErrores({});
    empezar(async () => {
      try {
        const r = await registrarPagoEnEfectivo(institucionId, { periodo, plan: planElegido, fecha, nota, avisar });
        if (!r.ok) {
          setErrores(r.campos ?? { _: r.error });
          toast(r.error, "error");
          return;
        }
        toast(`Pago en efectivo de ${etiquetaPeriodo(periodo).toLowerCase()} registrado`);
        setAbierto(false);
      } catch {
        toast("No pudimos registrar el pago. Probá de nuevo.", "error");
      }
    });
  };

  const aviso =
    situacion === "pagada"
      ? { clase: "bg-[#F6E6E0] text-[#8F3D28]", texto: `${etiquetaPeriodo(periodo)} ya figura como pago. Elegí otro mes.` }
      : situacion === "impaga"
        ? { clase: "bg-superficie text-tinta-2", texto: `Ya hay una factura de ${etiquetaPeriodo(periodo)} por ${pesos(monto)}: el pago se registra sobre esa factura.` }
        : PERIODO_VALIDO.test(periodo)
          ? { clase: "bg-superficie text-tinta-2", texto: `Se crea la factura de ${etiquetaPeriodo(periodo)} por ${pesos(monto)} y queda paga.` }
          : null;

  return (
    <>
      <Boton variante="secundario" bloque onClick={abrir}>
        Registrar pago en efectivo
      </Boton>
      <DialogoModal abierto={abierto} onCerrar={() => setAbierto(false)} titulo="Registrar un pago en efectivo">
        <p className="m-0 mb-4 text-sm leading-normal text-apagado">
          Para cuando la institución pagó en mano. No hace falta cargar antes la factura.
        </p>
        <div className="mb-4 grid grid-cols-2 gap-3 max-[520px]:grid-cols-1">
          <Campo etiqueta="Mes que se paga" requerido error={errores.periodo}>
            <Input
              type="month"
              value={periodo}
              pattern="\d{4}-\d{2}"
              placeholder="2026-11"
              onChange={(e) => setPeriodo(e.target.value)}
              aria-invalid={!!errores.periodo || undefined}
            />
          </Campo>
          <Campo
            etiqueta="Fecha del pago"
            requerido
            error={errores.fecha}
            ayuda="Por defecto, hoy. Cambiala si lo recibiste antes."
          >
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
          <Campo
            etiqueta="Plan"
            requerido
            error={errores.plan}
            ayuda={situacion === "impaga" ? "Se usa el de la factura que ya existe." : undefined}
          >
            <Select
              value={planElegido}
              disabled={situacion === "impaga"}
              onChange={(e) => setPlanElegido(e.target.value as PlanClave)}
            >
              {CLAVES_PLAN.map((c) => (
                <option key={c} value={c}>
                  {P.planDe(c).label} · {P.precioDePlan(c)}
                </option>
              ))}
            </Select>
          </Campo>
          <Campo etiqueta="Nota" error={errores.nota} ayuda="Optativa. Por ejemplo, el número de recibo.">
            <Input value={nota} maxLength={120} onChange={(e) => setNota(e.target.value)} aria-invalid={!!errores.nota || undefined} />
          </Campo>
        </div>
        {aviso && <p className={`m-0 mb-4 rounded-lg px-3.5 py-2.5 text-[13px] leading-normal ${aviso.clase}`}>{aviso.texto}</p>}
        <Casilla checked={avisar} onChange={(e) => setAvisar(e.target.checked)} className="mb-4">
          Avisarle a la institución que registramos su pago
        </Casilla>
        {errores._ && (
          <p role="alert" className="m-0 mb-3 text-xs text-[#b91c1c]">
            {errores._}
          </p>
        )}
        <div className="flex gap-2.5">
          <Boton disabled={pendiente || situacion === "pagada" || !PERIODO_VALIDO.test(periodo)} onClick={guardar}>
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
