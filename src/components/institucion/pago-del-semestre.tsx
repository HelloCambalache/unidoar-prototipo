"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { confirmarPagoDelSemestre, iniciarPagoDeSemestre } from "@/app/actions/pago-semestre";
import { Boton } from "@/components/ui/button";
import { useConfirmacion } from "@/components/ui/confirmacion";
import { Tarjeta } from "@/components/ui/tarjeta";
import { useToast } from "@/components/ui/toast";
import type { VueltaDelPago } from "@/lib/pago-semestre";
import { pesos } from "@/lib/planes";

/** Al volver de Mercado Pago se le pregunta hasta 8 veces, cada 2,5 s: el aviso del pago suele llegar en unos segundos. */
const INTENTOS_AL_VOLVER = 8;
const ESPERA_ENTRE_INTENTOS_MS = 2500;

export type OfertaDeSemestre = {
  /** Pesos que se pagan (el servidor ya los calculó). */
  total: number;
  /** "6 meses (octubre 2026 a marzo 2027)" */
  cobertura: string;
  mesesAPagar: number;
  meses: number;
  /** El semestre descuenta un mes bonificado por recomendar. */
  usaMesBonificado: boolean;
};

/**
 * Pagar el semestre por adelantado con Mercado Pago (pagás 5 meses y usás 6): UN pago único, no un débito mensual. La persona va a Mercado Pago
 * (ahí elige cómo pagar; nosotros nunca vemos datos de tarjeta) y, cuando se aprueba, el semestre queda registrado solo y no se le cobra nada hasta
 * que termine. Al volver se confirma sin que tenga que tocar nada. Sin Mercado Pago configurado (todavía no hay token) la tarjeta no se muestra.
 */
export function PagoDelSemestre({
  oferta,
  hayLinkPendiente,
  paraRevisar,
  vuelta,
  puedeGestionar,
}: {
  /** El semestre que se pagaría ahora; null si hoy no se ofrece (sin Mercado Pago, plan sin abono, meses ya pagos…). */
  oferta: OfertaDeSemestre | null;
  /** Ya creó un link de pago y todavía no se acreditó nada. */
  hayLinkPendiente: boolean;
  /** Se aprobó un pago que no se pudo registrar solo: lo está resolviendo el equipo. */
  paraRevisar: boolean;
  /** Cómo terminó el paso por Mercado Pago, si la persona acaba de volver de ahí. */
  vuelta: VueltaDelPago | null;
  puedeGestionar: boolean;
}) {
  const toast = useToast();
  const router = useRouter();
  const pedirConfirmacion = useConfirmacion();
  const [pendiente, empezar] = useTransition();
  const debeConfirmar = vuelta === "ok" || vuelta === "pendiente";
  const [confirmando, setConfirmando] = useState(debeConfirmar);

  // Al volver de pagar se mira solo si el pago ya se acreditó (el aviso de Mercado Pago puede tardar unos segundos). Son pocas vueltas: no es un bucle.
  useEffect(() => {
    if (!debeConfirmar) return;
    let cancelado = false;
    (async () => {
      for (let intento = 0; intento < INTENTOS_AL_VOLVER && !cancelado; intento++) {
        try {
          const r = await confirmarPagoDelSemestre();
          if (cancelado) return;
          if (r.ok && (r.data.estado === "registrado" || r.data.estado === "revisar")) {
            router.replace("/institucion/plan");
            router.refresh();
            return;
          }
          if (r.ok && r.data.estado === "sin-pendientes") break;
        } catch {
          // Se reintenta en la próxima vuelta.
        }
        await new Promise((resolver) => setTimeout(resolver, ESPERA_ENTRE_INTENTOS_MS));
      }
      if (!cancelado) setConfirmando(false);
    })();
    return () => {
      cancelado = true;
    };
  }, [debeConfirmar, router]);

  if (!oferta && !paraRevisar && !vuelta && !hayLinkPendiente) return null;

  const pagar = async () => {
    if (!oferta) return;
    const ok = await pedirConfirmacion(
      `¿Pagar ${pesos(oferta.total)} por ${oferta.cobertura}? Te llevamos a Mercado Pago para pagar. Cuando se apruebe el pago, tu semestre queda registrado y no se te cobra nada hasta que termine.`,
    );
    if (!ok) return;
    empezar(async () => {
      try {
        const r = await iniciarPagoDeSemestre();
        if (!r.ok) {
          toast(r.error, "error");
          return;
        }
        window.location.assign(r.data.url);
      } catch {
        toast("No pudimos armar el pago. Probá de nuevo.", "error");
      }
    });
  };

  const verificar = () => {
    empezar(async () => {
      try {
        const r = await confirmarPagoDelSemestre();
        if (!r.ok) toast(r.error, "error");
        else if (r.data.estado === "registrado") {
          toast("¡Listo! Registramos tu pago del semestre.");
          router.refresh();
        } else if (r.data.estado === "revisar") {
          toast("Recibimos tu pago y el equipo lo está revisando.");
          router.refresh();
        } else toast("Todavía no vemos el pago en Mercado Pago. Puede tardar unos minutos: probá de nuevo en un rato.");
      } catch {
        toast("No pudimos conectarnos con Mercado Pago. Probá de nuevo.", "error");
      }
    });
  };

  return (
    <Tarjeta como="section" aria-labelledby="semestre-titulo" className="mt-4 max-w-[980px] p-6">
      <h2 id="semestre-titulo" className="mt-0 mb-1 font-display text-[17px] leading-tight font-bold text-tinta">
        Pagar el semestre por adelantado
      </h2>

      {vuelta === "ok" && confirmando && (
        <p role="status" aria-live="polite" className="mt-1 mb-3 max-w-[62ch] text-[13.5px] leading-normal text-apagado">
          ¡Gracias! Estamos confirmando tu pago con Mercado Pago. Puede tardar unos segundos: esta pantalla se actualiza sola.
        </p>
      )}
      {vuelta === "ok" && !confirmando && (
        <p role="status" className="mt-1 mb-3 max-w-[62ch] rounded-caja bg-naranja-tint px-3.5 py-2.5 text-[13px] leading-normal text-naranja-ink">
          Todavía no nos llegó la confirmación de Mercado Pago. Si ya pagaste, puede tardar unos minutos: tu semestre se registra solo apenas llegue, o tocá
          “Ya pagué” en un rato.
        </p>
      )}
      {vuelta === "pendiente" && (
        <p role="status" className="mt-1 mb-3 max-w-[62ch] rounded-caja bg-naranja-tint px-3.5 py-2.5 text-[13px] leading-normal text-naranja-ink">
          Tu pago está pendiente de acreditación en Mercado Pago (pasa con algunos medios de pago). Apenas se acredite, tu semestre se registra solo.
        </p>
      )}
      {vuelta === "error" && (
        <p role="status" className="mt-1 mb-3 max-w-[62ch] rounded-caja bg-naranja-tint px-3.5 py-2.5 text-[13px] leading-normal text-naranja-ink">
          El pago no se completó y no se te cobró nada. Podés intentarlo de nuevo cuando quieras.
        </p>
      )}
      {paraRevisar && (
        <p role="status" className="mt-1 mb-3 max-w-[62ch] rounded-caja bg-naranja-tint px-3.5 py-2.5 text-[13px] leading-normal text-naranja-ink">
          Recibimos tu pago y el equipo de UNIDOAR lo está revisando para registrarlo. No hace falta que pagues de nuevo: si pasa un día sin novedades,
          escribinos desde Contacto.
        </p>
      )}

      {oferta && (
        <>
          <p className="mt-0 mb-1 text-[22px] leading-[1.2] font-semibold text-tinta">
            {pesos(oferta.total)}
            <span className="text-sm font-normal text-apagado"> por {oferta.meses} meses</span>
          </p>
          <p className="mt-0 mb-4 max-w-[62ch] text-[13.5px] leading-normal text-apagado">
            Pagás {oferta.mesesAPagar} de {oferta.meses} meses{oferta.usaMesBonificado ? " (uno es el mes bonificado que ganaste por recomendar)" : ""} y
            quedás cubierto {oferta.cobertura}: no se te cobra nada más hasta entonces. Es un pago único, no un débito mensual. Te llevamos a Mercado
            Pago, donde elegís cómo pagar; nosotros nunca vemos los datos de tu tarjeta.
          </p>
          {puedeGestionar ? (
            <div className="flex flex-wrap gap-2.5">
              <Boton variante="primario" onClick={pagar} disabled={pendiente || confirmando} aria-busy={pendiente}>
                {pendiente ? "Abriendo Mercado Pago…" : "Pagar el semestre con Mercado Pago"}
              </Boton>
              {(hayLinkPendiente || (vuelta === "ok" && !confirmando)) && (
                <Boton variante="secundario" onClick={verificar} disabled={pendiente}>
                  Ya pagué
                </Boton>
              )}
            </div>
          ) : (
            <p className="m-0 text-[12.5px] leading-normal text-apagado">Solo el dueño y los administradores del equipo pueden pagar el plan.</p>
          )}
        </>
      )}

      {!oferta && hayLinkPendiente && puedeGestionar && (
        <div className="mt-2 flex flex-wrap items-center gap-2.5">
          <p className="m-0 max-w-[52ch] text-[13px] leading-normal text-apagado">Tenés un pago del semestre iniciado. Si ya pagaste, confirmalo para que se registre.</p>
          <Boton variante="secundario" onClick={verificar} disabled={pendiente}>
            Ya pagué
          </Boton>
        </div>
      )}
    </Tarjeta>
  );
}
