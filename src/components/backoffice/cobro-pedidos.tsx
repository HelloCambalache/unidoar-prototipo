"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { aprobarPedidoDePlan, rechazarPedidoDePlan } from "@/app/actions/backoffice-cobros";
import { Boton } from "@/components/ui/button";
import { Campo, Textarea } from "@/components/ui/campos";
import { DialogoModal } from "@/components/ui/dialogo-modal";
import { useToast } from "@/components/ui/toast";
import { etiquetaPeriodo, nombreDePlan, precioDePlan } from "@/lib/cobros";

export type PedidoVista = {
  id: string;
  institucionId: string;
  institucion: string;
  planActual: string;
  planSolicitado: string;
  /** Plan que tiene hoy la institución (puede no coincidir con `planActual` si lo cambiaron después del pedido). */
  planVigente: string;
  /** "hace 2 días" */
  cuando: string;
};

type Abierto = { pedido: PedidoVista; accion: "aprobar" | "rechazar" } | null;

/**
 * Pedidos de cambio de plan que dejan las instituciones desde /institucion/plan. Aprobar actualiza el plan,
 * deja lista la factura del mes y avisa; rechazar pide una nota que ve la institución. Ambas pasan por el servidor,
 * que vuelve a chequear que el pedido siga pendiente.
 */
export function CobroPedidos({ pedidos }: { pedidos: PedidoVista[] }) {
  const toast = useToast();
  const [pendiente, empezar] = useTransition();
  const [abierto, setAbierto] = useState<Abierto>(null);
  const [nota, setNota] = useState("");
  const [error, setError] = useState<string | null>(null);

  const cerrar = () => {
    setAbierto(null);
    setNota("");
    setError(null);
  };

  const confirmar = () => {
    if (!abierto) return;
    const { pedido, accion } = abierto;
    if (accion === "rechazar" && nota.trim().length < 3) {
      setError("Contale a la institución por qué (mínimo 3 caracteres).");
      return;
    }
    setError(null);
    empezar(async () => {
      try {
        if (accion === "rechazar") {
          const r = await rechazarPedidoDePlan(pedido.id, nota);
          if (!r.ok) {
            setError(r.error);
            toast(r.error, "error");
            return;
          }
          toast("Pedido rechazado. Le avisamos a la institución.");
        } else {
          const r = await aprobarPedidoDePlan(pedido.id, nota);
          if (!r.ok) {
            setError(r.error);
            toast(r.error, "error");
            return;
          }
          const f = r.data.factura;
          toast(
            f.resultado === "creada"
              ? `Plan actualizado. Se cargó la factura de ${etiquetaPeriodo(f.periodo).toLowerCase()}.`
              : f.resultado === "actualizada"
                ? `Plan actualizado. Se ajustó la factura de ${etiquetaPeriodo(f.periodo).toLowerCase()}.`
                : "Plan actualizado. La factura de este mes no se tocó.",
          );
        }
        cerrar();
      } catch {
        toast("No pudimos completar la acción. Probá de nuevo.", "error");
      }
    });
  };

  if (pedidos.length === 0) {
    return <p className="m-0 text-[13px] leading-normal text-apagado">No hay pedidos de cambio de plan pendientes.</p>;
  }

  const rechazando = abierto?.accion === "rechazar";

  return (
    <>
      <ul className="m-0 flex list-none flex-col overflow-hidden rounded-ud border border-borde bg-white p-0">
        {pedidos.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-borde px-[18px] py-3.5 last:border-b-0">
            <div className="min-w-[240px] flex-1">
              <div className="text-sm leading-snug">
                <Link href={`/backoffice/cobros/${p.institucionId}`} className="font-semibold text-tinta hover:text-naranja">
                  {p.institucion}
                </Link>{" "}
                pide pasar de <b className="font-semibold">{nombreDePlan(p.planActual)}</b> a{" "}
                <b className="font-semibold">{nombreDePlan(p.planSolicitado)}</b> ({precioDePlan(p.planSolicitado)})
              </div>
              <div className="mt-0.5 text-xs leading-snug text-sutil">
                {p.cuando}
                {p.planVigente !== p.planActual && (
                  <span className="text-[#8A4B07]"> · Ojo: hoy está en {nombreDePlan(p.planVigente)}, no en {nombreDePlan(p.planActual)}</span>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Boton tamano="sm" onClick={() => setAbierto({ pedido: p, accion: "aprobar" })}>
                Aprobar
              </Boton>
              <Boton tamano="sm" variante="secundario" onClick={() => setAbierto({ pedido: p, accion: "rechazar" })}>
                Rechazar
              </Boton>
            </div>
          </li>
        ))}
      </ul>

      <DialogoModal
        abierto={!!abierto}
        onCerrar={cerrar}
        titulo={
          abierto
            ? rechazando
              ? `¿Rechazar el pedido de ${abierto.pedido.institucion}?`
              : `¿Aprobar el pedido de ${abierto.pedido.institucion}?`
            : ""
        }
      >
        {abierto && (
          <>
            <p className="m-0 mb-4 text-sm leading-normal text-apagado">
              {rechazando
                ? "El plan no cambia. Le avisamos a la institución con la nota que escribas."
                : `Pasa al ${nombreDePlan(abierto.pedido.planSolicitado)} (${precioDePlan(abierto.pedido.planSolicitado)}) y se deja la factura de este mes con ese plan: se carga si no existe y se ajusta si está impaga; si ya está paga, el nuevo plan rige desde el mes que viene. Le avisamos a la institución.`}
            </p>
            <div className="mb-4">
              <Campo
                etiqueta={rechazando ? "Nota para la institución" : "Nota (opcional)"}
                requerido={rechazando}
                error={error ?? undefined}
                ayuda={rechazando ? undefined : "Queda en el registro del equipo."}
              >
                <Textarea value={nota} maxLength={500} rows={3} onChange={(e) => setNota(e.target.value)} aria-invalid={!!error || undefined} />
              </Campo>
            </div>
            <div className="flex gap-2.5">
              <Boton variante={rechazando ? "peligro" : "primario"} disabled={pendiente} onClick={confirmar}>
                {pendiente ? "Guardando…" : rechazando ? "Rechazar pedido" : "Aprobar pedido"}
              </Boton>
              <Boton variante="secundario" disabled={pendiente} onClick={cerrar}>
                Cancelar
              </Boton>
            </div>
          </>
        )}
      </DialogoModal>
    </>
  );
}
