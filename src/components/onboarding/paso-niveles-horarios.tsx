"use client";

import { useActionState, useState } from "react";
import { guardarNivelesYHorarios } from "@/app/actions/onboarding";
import type { GrillaDisponibilidad as Grilla } from "@/db/schema";
import { Boton } from "@/components/ui/button";
import { Campo, Input } from "@/components/ui/campos";
import { AlertaError, EnlaceVolver, SeccionPaso, TituloPaso } from "@/components/onboarding/elementos";
import { GrillaDisponibilidad } from "@/components/onboarding/grilla-disponibilidad";
import { ID_FORMULARIO_ONBOARDING, NIVELES_ESTANDAR } from "@/lib/onboarding";
import { cn } from "@/lib/utils";

/** "¿A quiénes y cuándo?": niveles (con "Otros" de texto libre) y grilla semanal de disponibilidad. */
export function PasoNivelesHorarios({
  inicial,
}: {
  inicial: { niveles: string[]; incluyeOtro: boolean; otros: string; grilla: Grilla };
}) {
  const [estado, accion, pendiente] = useActionState(guardarNivelesYHorarios, null);
  const [niveles, setNiveles] = useState(inicial.niveles);
  const [incluyeOtro, setIncluyeOtro] = useState(inicial.incluyeOtro);
  const campos = estado && !estado.ok ? (estado.campos ?? {}) : {};

  const tile = "flex cursor-pointer items-center justify-center rounded-xl border-2 bg-white px-2.5 py-4 text-center text-[15px] leading-snug font-semibold text-tinta transition-colors has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-navy-700/30";
  const alternar = (n: string) => setNiveles((previos) => (previos.includes(n) ? previos.filter((x) => x !== n) : [...previos, n]));

  return (
    <form id={ID_FORMULARIO_ONBOARDING} action={accion}>
      <input type="hidden" name="destino" defaultValue="continuar" />
      <TituloPaso
        grande
        titulo="¿A quiénes y cuándo?"
        bajada="Con qué niveles trabajás y en qué franjas podés. Podés marcar más de uno en cada caso."
        className="mb-[18px]"
      />

      <SeccionPaso titulo="¿En qué niveles podés trabajar?" bajada="Podés marcar más de uno." className="mb-0">
        <div role="group" aria-label="Niveles" className="mb-3 grid grid-cols-5 gap-2.5 max-[880px]:grid-cols-3 max-[520px]:grid-cols-2">
          {NIVELES_ESTANDAR.map((n) => {
            const marcado = niveles.includes(n);
            return (
              <label key={n} className={cn(tile, marcado ? "border-navy-700" : "border-borde")}>
                <input type="checkbox" name="niveles" value={n} checked={marcado} onChange={() => alternar(n)} className="sr-only" />
                {n}
              </label>
            );
          })}
          <label className={cn(tile, incluyeOtro ? "border-navy-700" : "border-borde")}>
            <input type="checkbox" name="incluyeOtro" checked={incluyeOtro} onChange={() => setIncluyeOtro((v) => !v)} className="sr-only" />
            Otros
          </label>
        </div>
        {campos.niveles && (
          <p role="alert" className="mb-3 text-xs text-[#b91c1c]">
            {campos.niveles}
          </p>
        )}
        {incluyeOtro ? (
          <Campo etiqueta="¿Con qué otro nivel trabajás?" className="mb-6" error={campos.otrosNiveles}>
            <Input
              name="otrosNiveles"
              placeholder="Ej. Educación especial, formación profesional"
              maxLength={120}
              defaultValue={inicial.otros}
              aria-invalid={Boolean(campos.otrosNiveles)}
            />
          </Campo>
        ) : (
          <div className="h-3" />
        )}
      </SeccionPaso>

      <SeccionPaso
        titulo="¿Qué días y en qué horarios podés?"
        bajada={
          <>
            Tocá cada casillero para marcarlo: una vez <strong className="font-semibold text-tinta">disponible</strong>, dos veces{" "}
            <strong className="font-semibold text-tinta">a convenir</strong>, tres veces lo dejás libre.
          </>
        }
      >
        <GrillaDisponibilidad inicial={inicial.grilla} error={campos.grilla} />
      </SeccionPaso>

      <AlertaError className="mb-3.5">{estado && !estado.ok && Object.keys(campos).length === 0 ? estado.error : undefined}</AlertaError>
      <Boton type="submit" variante="cta" bloque disabled={pendiente} className="min-h-12 text-base">
        {pendiente ? "Guardando…" : "Continuar"}
      </Boton>
      <div className="mt-3.5">
        <EnlaceVolver href="/onboarding/docente/2" />
      </div>
    </form>
  );
}
