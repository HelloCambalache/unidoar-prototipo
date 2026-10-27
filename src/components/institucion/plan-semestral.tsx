"use client";

import { useTransition } from "react";
import { elegirFormaDePago } from "@/app/actions/plan";
import { Boton } from "@/components/ui/button";
import { Insignia } from "@/components/ui/insignia";
import { Tarjeta } from "@/components/ui/tarjeta";
import { useToast } from "@/components/ui/toast";
import { textoDeSemestre, type FormaDePago, type resumenDeSemestre } from "@/lib/forma-de-pago";

/**
 * «Pago por semestre» (Plan y facturación de una institución con abono): pagar el semestre por adelantado (pagás 5 meses y usás 6) en lugar de mes
 * a mes. Es una preferencia: elegirla le avisa al equipo, que coordina el pago (transferencia o efectivo) y lo registra. Solo el dueño y los
 * administradores pueden cambiarla. No se muestra cuando ya tiene un semestre pago vigente (el panel de arriba ya dice hasta cuándo).
 */
export function PlanSemestral({
  forma,
  puedeGestionar,
  resumen,
}: {
  forma: FormaDePago;
  puedeGestionar: boolean;
  resumen: ReturnType<typeof resumenDeSemestre>;
}) {
  const toast = useToast();
  const [pendiente, empezar] = useTransition();
  const elegido = forma === "semestral";

  const cambiar = (nueva: FormaDePago) =>
    empezar(async () => {
      try {
        const r = await elegirFormaDePago(nueva);
        if (!r.ok) toast(r.error, "error");
        else toast(nueva === "semestral" ? "Listo: le avisamos al equipo para coordinar el pago del semestre" : "Volviste a pagar mes a mes");
      } catch {
        toast("No pudimos guardar tu elección. Probá de nuevo.", "error");
      }
    });

  return (
    <Tarjeta como="section" aria-labelledby="semestre-titulo" className="mt-4 max-w-[980px] p-6">
      <div className="mb-1 flex flex-wrap items-center gap-2.5">
        <h2 id="semestre-titulo" className="m-0 font-display text-[17px] leading-tight font-bold text-tinta">
          Pago por semestre
        </h2>
        {elegido && <Insignia className="bg-verde-tint text-verde">Elegido</Insignia>}
      </div>
      <p className="mt-0 mb-4 max-w-[62ch] text-[13.5px] leading-normal text-apagado">
        {elegido
          ? `Elegiste pagar el semestre por adelantado. ${textoDeSemestre(resumen)} El equipo coordina el pago con vos (transferencia o efectivo) y lo registra: hasta entonces seguís con tu abono mensual.`
          : `Si preferís no pagar todos los meses, podés abonar el semestre de una vez. ${textoDeSemestre(resumen)} El pago es por transferencia o en efectivo y lo coordina el equipo.`}
      </p>
      {puedeGestionar ? (
        elegido ? (
          <Boton variante="secundario" onClick={() => cambiar("mensual")} disabled={pendiente} aria-busy={pendiente}>
            {pendiente ? "Guardando…" : "Prefiero pagar mes a mes"}
          </Boton>
        ) : (
          <Boton variante="primario" onClick={() => cambiar("semestral")} disabled={pendiente} aria-busy={pendiente}>
            {pendiente ? "Guardando…" : "Quiero pagar por semestre"}
          </Boton>
        )
      ) : (
        <p className="m-0 text-[12.5px] leading-normal text-apagado">Solo el dueño y los administradores del equipo pueden cambiarlo.</p>
      )}
    </Tarjeta>
  );
}
