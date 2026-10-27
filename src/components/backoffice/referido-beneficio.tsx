"use client";

import { useTransition } from "react";
import { marcarBeneficioDeReferido } from "@/app/actions/backoffice-referidos";
import { Boton } from "@/components/ui/button";
import { useConfirmacion } from "@/components/ui/confirmacion";
import { useToast } from "@/components/ui/toast";
import { mesesBonificadosTexto, mesesTexto, TEXTO_DEL_TOPE } from "@/lib/bonificacion";

/**
 * Marca que el equipo ya aplicó el beneficio de una recomendación (o lo deshace si fue un error). Aplicarlo le suma a quien recomendó los meses
 * bonificados que fija Planes; se gastan de a uno por semestre (ver src/lib/bonificacion.ts).
 */
export function ReferidoBeneficio({
  referidoId,
  aplicado,
  mesesPorRecomendacion,
  conDebito,
  referidor,
}: {
  referidoId: string;
  aplicado: boolean;
  /** Meses que se bonifican por recomendación según Planes (0: no se pueden aplicar). */
  mesesPorRecomendacion: number;
  /** La institución que recomendó tiene un débito automático autorizado: el cobro del mes bonificado hay que devolverlo a mano en Mercado Pago. */
  conDebito: boolean;
  referidor: string;
}) {
  const toast = useToast();
  const pedirConfirmacion = useConfirmacion();
  const [pendiente, empezar] = useTransition();

  const enviar = (aplicar: boolean) =>
    empezar(async () => {
      try {
        const r = await marcarBeneficioDeReferido(referidoId, aplicar);
        if (!r.ok) toast(r.error, "error");
        else toast(aplicar ? "Beneficio aplicado" : "Beneficio devuelto a pendiente");
      } catch {
        toast("No pudimos actualizar el beneficio. Probá de nuevo.", "error");
      }
    });

  const aplicarBeneficio = async () => {
    const pregunta = conDebito
      ? `¿Aplicar ${mesesBonificadosTexto(mesesPorRecomendacion)} a ${referidor}? ${TEXTO_DEL_TOPE} Tiene débito automático: Mercado Pago va a seguir cobrando y el cobro del mes bonificado hay que devolverlo a mano desde Mercado Pago (te lo avisamos y queda en la pestaña Devoluciones).`
      : `¿Aplicar ${mesesBonificadosTexto(mesesPorRecomendacion)} a ${referidor}? ${TEXTO_DEL_TOPE}`;
    if (await pedirConfirmacion(pregunta)) enviar(true);
  };

  if (aplicado) {
    return (
      <Boton tamano="sm" variante="fantasma" disabled={pendiente} aria-busy={pendiente} onClick={() => enviar(false)}>
        Deshacer
      </Boton>
    );
  }

  if (mesesPorRecomendacion < 1) {
    return <span className="text-[13px] text-apagado">Activá los meses bonificados en Planes para poder aplicarlo.</span>;
  }

  return (
    <Boton tamano="sm" variante="exito" disabled={pendiente} aria-busy={pendiente} onClick={aplicarBeneficio}>
      ✓ Aplicar {mesesTexto(mesesPorRecomendacion)} bonificado{mesesPorRecomendacion === 1 ? "" : "s"}
    </Boton>
  );
}
