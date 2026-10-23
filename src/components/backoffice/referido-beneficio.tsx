"use client";

import { useTransition } from "react";
import { marcarBeneficioDeReferido } from "@/app/actions/backoffice-referidos";
import { Boton } from "@/components/ui/button";
import { useConfirmacion } from "@/components/ui/confirmacion";
import { useToast } from "@/components/ui/toast";
import { mesesTexto, type TipoDeBeneficio } from "@/lib/bonificacion";

/**
 * Marca que el equipo ya aplicó el beneficio de una recomendación (o lo deshace si fue un error). Al aplicarlo se elige cómo: meses
 * bonificados para quien paga mes a mes (si Planes los ofrece y su plan es mensual) o pack por adelantado, que se carga a mano al facturar.
 */
export function ReferidoBeneficio({
  referidoId,
  aplicado,
  mesesPorRecomendacion,
  motivoSinMeses,
  conDebito,
  referidor,
}: {
  referidoId: string;
  aplicado: boolean;
  /** Meses que se bonifican por recomendación según Planes (0: no se ofrecen). */
  mesesPorRecomendacion: number;
  /** Por qué no se puede bonificar meses a esta institución (por ejemplo, plan anual); null si se puede. */
  motivoSinMeses: string | null;
  /** La institución que recomendó tiene un débito automático autorizado: cada mes bonificado hay que devolverlo a mano en Mercado Pago. */
  conDebito: boolean;
  referidor: string;
}) {
  const toast = useToast();
  const pedirConfirmacion = useConfirmacion();
  const [pendiente, empezar] = useTransition();

  const enviar = (aplicar: boolean, tipo: TipoDeBeneficio) =>
    empezar(async () => {
      try {
        const r = await marcarBeneficioDeReferido(referidoId, aplicar, tipo);
        if (!r.ok) toast(r.error, "error");
        else toast(!aplicar ? "Beneficio devuelto a pendiente" : tipo === "meses" ? "Meses bonificados aplicados" : "Beneficio marcado como aplicado");
      } catch {
        toast("No pudimos actualizar el beneficio. Probá de nuevo.", "error");
      }
    });

  const bonificarMeses = async () => {
    if (conDebito) {
      const sigue = await pedirConfirmacion(
        `¿Bonificar ${mesesTexto(mesesPorRecomendacion)} a ${referidor}? Tiene débito automático: Mercado Pago va a seguir cobrando y el cobro de cada mes bonificado hay que devolverlo a mano desde Mercado Pago (te lo avisamos y queda en la pestaña Devoluciones).`,
      );
      if (!sigue) return;
    }
    enviar(true, "meses");
  };

  if (aplicado) {
    return (
      <Boton tamano="sm" variante="fantasma" disabled={pendiente} aria-busy={pendiente} onClick={() => enviar(false, "pack")}>
        Deshacer
      </Boton>
    );
  }

  const puedeMeses = mesesPorRecomendacion > 0 && !motivoSinMeses;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {puedeMeses && (
        <Boton tamano="sm" variante="exito" disabled={pendiente} aria-busy={pendiente} onClick={bonificarMeses}>
          ✓ Bonificar {mesesTexto(mesesPorRecomendacion)}
        </Boton>
      )}
      <Boton
        tamano="sm"
        variante={puedeMeses ? "secundario" : "exito"}
        disabled={pendiente}
        aria-busy={pendiente}
        title={!puedeMeses && motivoSinMeses ? motivoSinMeses : undefined}
        onClick={() => enviar(true, "pack")}
      >
        {puedeMeses ? "Pack por adelantado" : "✓ Marcar beneficio aplicado"}
      </Boton>
    </div>
  );
}
