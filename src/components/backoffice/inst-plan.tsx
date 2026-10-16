"use client";

import { useState, useTransition } from "react";
import { cambiarPlanInstitucion } from "@/app/actions/backoffice-instituciones";
import { Boton } from "@/components/ui/button";
import { DialogoModal } from "@/components/ui/dialogo-modal";
import { useToast } from "@/components/ui/toast";
import { crearPlanes, type CatalogoDePlanes, type PlanClave } from "@/lib/planes";
import { cn } from "@/lib/utils";

/**
 * "Plan actual" de la ficha con el selector de plan del prototipo. Guardar pide confirmación; el cambio se
 * hace en el servidor (actualiza el plan, deja auditoría y avisa a la institución) y no toca facturas.
 */
export function InstPlan({
  institucionId,
  nombre,
  catalogo,
  plan,
  proximoCobro,
}: {
  institucionId: string;
  nombre: string;
  /** Los planes vigentes (los lee el servidor de la base). */
  catalogo: CatalogoDePlanes;
  plan: PlanClave;
  /** Texto ya armado: "Próximo cobro el 10/10/2026 · $ 54.000" o "Sin cobros pendientes". */
  proximoCobro: string;
}) {
  const P = crearPlanes(catalogo);
  const toast = useToast();
  const [pendiente, empezar] = useTransition();
  const [editando, setEditando] = useState(false);
  const [elegido, setElegido] = useState<PlanClave>(plan);
  const [confirmando, setConfirmando] = useState(false);

  const cerrarTodo = () => {
    setConfirmando(false);
    setEditando(false);
  };

  const guardar = () =>
    empezar(async () => {
      try {
        const r = await cambiarPlanInstitucion(institucionId, elegido);
        if (!r.ok) {
          toast(r.error, "error");
          return;
        }
        toast(`Plan cambiado a ${P.planDe(elegido).label}`);
        cerrarTodo();
      } catch {
        toast("No pudimos cambiar el plan. Probá de nuevo.", "error");
      }
    });

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2.5 text-[11px] leading-none font-semibold tracking-[.06em] text-sutil uppercase">Plan actual</div>
          <div className="flex flex-wrap items-baseline gap-2.5">
            <span className="text-[20px] leading-tight font-semibold text-navy-700">{P.planDe(plan).label}</span>
            <span className="text-[15px] leading-none font-medium text-tinta-2">{P.precioDePlan(plan)}</span>
          </div>
          <div className="mt-1.5 text-[13px] leading-normal text-apagado">{proximoCobro}</div>
        </div>
        <Boton
          variante="secundario"
          aria-expanded={editando}
          onClick={() => {
            setElegido(plan);
            setEditando((v) => !v);
          }}
          className="border-navy-700 text-navy-700 hover:bg-navy-700 hover:text-white"
        >
          {editando ? "Cancelar" : "Editar plan"}
        </Boton>
      </div>

      {editando && (
        <div className="mt-[18px] border-t border-borde pt-[18px]">
          <fieldset className="m-0 mb-3.5 grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-2.5 border-0 p-0">
            <legend className="sr-only">Plan de la institución</legend>
            {P.clavesParaElegir(plan).map((clave) => (
              <label
                key={clave}
                className={cn(
                  "cursor-pointer rounded-caja border p-[14px_16px] transition-colors has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-navy-700/30",
                  elegido === clave ? "border-navy-700 bg-navy-50/50" : "border-borde hover:border-borde-fuerte",
                )}
              >
                <input
                  type="radio"
                  name="plan"
                  value={clave}
                  checked={elegido === clave}
                  onChange={() => setElegido(clave)}
                  className="sr-only"
                />
                <span className="mb-1.5 flex items-center justify-between gap-2">
                  <span className="text-sm leading-tight font-semibold">{P.planDe(clave).label}</span>
                  {elegido === clave && (
                    <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16214F" strokeWidth="2.6" strokeLinecap="round">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  )}
                </span>
                <span className="mb-1.5 block text-[18px] leading-none font-semibold">{P.precioDePlan(clave)}</span>
                <span className="block text-xs leading-[1.4] text-apagado">{P.planDe(clave).resumen}</span>
              </label>
            ))}
          </fieldset>
          <div className="flex gap-2.5">
            <Boton disabled={elegido === plan} onClick={() => setConfirmando(true)}>
              Guardar cambios
            </Boton>
            <Boton variante="secundario" onClick={() => setEditando(false)}>
              Cancelar
            </Boton>
          </div>
        </div>
      )}

      <DialogoModal abierto={confirmando} onCerrar={() => setConfirmando(false)} titulo={`¿Cambiar el plan de ${nombre}?`}>
        <p className="m-0 mb-1.5 text-sm leading-normal text-tinta-2">
          Pasa del <b className="font-semibold">{P.planDe(plan).label}</b> al <b className="font-semibold">{P.planDe(elegido).label}</b>{" "}
          ({P.precioDePlan(elegido)}).
        </p>
        <p className="m-0 mb-4 text-sm leading-normal text-apagado">
          Le avisamos a las personas de su equipo. Las facturas ya cargadas no se modifican: si hace falta, ajustalas desde
          Cobros.
        </p>
        <div className="flex gap-2.5">
          <Boton disabled={pendiente} onClick={guardar}>
            {pendiente ? "Guardando…" : "Confirmar cambio"}
          </Boton>
          <Boton variante="secundario" disabled={pendiente} onClick={() => setConfirmando(false)}>
            Volver
          </Boton>
        </div>
      </DialogoModal>
    </>
  );
}
