"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { confirmarPagoDeLaBusquedaPuntual, iniciarPagoDeBusquedaPuntual } from "@/app/actions/pago-puntual";
import { Boton } from "@/components/ui/button";
import { useConfirmacion } from "@/components/ui/confirmacion";
import { Tarjeta } from "@/components/ui/tarjeta";
import { useToast } from "@/components/ui/toast";
import type { VueltaDelPago } from "@/lib/pago-semestre";
import { pesos } from "@/lib/planes";

/** Al volver de Mercado Pago se le pregunta hasta 8 veces, cada 2,5 s: el aviso del pago suele llegar en unos segundos. */
const INTENTOS_AL_VOLVER = 8;
const ESPERA_ENTRE_INTENTOS_MS = 2500;

export type OfertaDeBusquedaPuntual = {
  /** Pesos que se pagan (el servidor ya los calculó). */
  total: number;
  /** Cuántos días queda abierta la búsqueda una vez publicada. */
  vigenciaDias: number;
};

/**
 * Pagar UNA búsqueda con Mercado Pago (plan de búsqueda puntual): un pago único, no una suscripción. La persona va a Mercado Pago (ahí elige cómo pagar;
 * nosotros nunca vemos datos de tarjeta) y, cuando se aprueba, la búsqueda queda pagada y lista para publicar sola. Al volver se confirma sin que tenga que
 * tocar nada. Sin Mercado Pago disponible para la institución, la tarjeta no se muestra.
 */
export function PagoDeBusquedaPuntual({
  oferta,
  motivo,
  hayLinkPendiente,
  paraRevisar,
  vuelta,
  puedeGestionar,
}: {
  /** La búsqueda que se pagaría ahora; null si hoy no se ofrece. */
  oferta: OfertaDeBusquedaPuntual | null;
  /** Por qué no se ofrece (por ejemplo, ya tiene una búsqueda pagada sin publicar); null si simplemente no hay Mercado Pago. */
  motivo: string | null;
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
          const r = await confirmarPagoDeLaBusquedaPuntual();
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

  if (!oferta && !motivo && !paraRevisar && !vuelta && !hayLinkPendiente) return null;

  const pagar = async () => {
    if (!oferta) return;
    const ok = await pedirConfirmacion(
      `¿Pagar ${pesos(oferta.total)} por una búsqueda? Te llevamos a Mercado Pago para pagar. Cuando se apruebe el pago, tu búsqueda queda lista para publicar y, una vez publicada, queda abierta ${oferta.vigenciaDias} días.`,
    );
    if (!ok) return;
    empezar(async () => {
      try {
        const r = await iniciarPagoDeBusquedaPuntual();
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
        const r = await confirmarPagoDeLaBusquedaPuntual();
        if (!r.ok) toast(r.error, "error");
        else if (r.data.estado === "registrado") {
          toast("¡Listo! Registramos tu pago: ya podés publicar tu búsqueda.");
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
    <Tarjeta como="section" aria-labelledby="pago-puntual-titulo" className="mt-4 max-w-[980px] p-6">
      <h2 id="pago-puntual-titulo" className="mt-0 mb-1 font-display text-[17px] leading-tight font-bold text-tinta">
        Pagar una búsqueda con Mercado Pago
      </h2>

      {vuelta === "ok" && confirmando && (
        <p role="status" aria-live="polite" className="mt-1 mb-3 max-w-[62ch] text-[13.5px] leading-normal text-apagado">
          ¡Gracias! Estamos confirmando tu pago con Mercado Pago. Puede tardar unos segundos: esta pantalla se actualiza sola.
        </p>
      )}
      {vuelta === "ok" && !confirmando && (
        <p role="status" className="mt-1 mb-3 max-w-[62ch] rounded-caja bg-naranja-tint px-3.5 py-2.5 text-[13px] leading-normal text-naranja-ink">
          Todavía no nos llegó la confirmación de Mercado Pago. Si ya pagaste, puede tardar unos minutos: tu búsqueda queda lista apenas llegue, o tocá “Ya
          pagué” en un rato.
        </p>
      )}
      {vuelta === "pendiente" && (
        <p role="status" className="mt-1 mb-3 max-w-[62ch] rounded-caja bg-naranja-tint px-3.5 py-2.5 text-[13px] leading-normal text-naranja-ink">
          Tu pago está pendiente de acreditación en Mercado Pago (pasa con algunos medios de pago). Apenas se acredite, tu búsqueda queda lista para publicar.
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
            <span className="text-sm font-normal text-apagado"> por una búsqueda</span>
          </p>
          <p className="mt-0 mb-4 max-w-[62ch] text-[13.5px] leading-normal text-apagado">
            Es un pago único, no un débito mensual. Una vez publicada, tu búsqueda queda abierta {oferta.vigenciaDias} días y después se cierra sola. Te llevamos a
            Mercado Pago, donde elegís cómo pagar; nosotros nunca vemos los datos de tu tarjeta.
          </p>
          {puedeGestionar ? (
            <div className="flex flex-wrap gap-2.5">
              <Boton variante="primario" onClick={pagar} disabled={pendiente || confirmando} aria-busy={pendiente}>
                {pendiente ? "Abriendo Mercado Pago…" : "Pagar una búsqueda con Mercado Pago"}
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

      {!oferta && motivo && <p className="m-0 max-w-[62ch] text-[13.5px] leading-normal text-apagado">{motivo}</p>}

      {!oferta && !motivo && hayLinkPendiente && puedeGestionar && (
        <div className="mt-2 flex flex-wrap items-center gap-2.5">
          <p className="m-0 max-w-[52ch] text-[13px] leading-normal text-apagado">Tenés un pago de una búsqueda iniciado. Si ya pagaste, confirmalo para que se registre.</p>
          <Boton variante="secundario" onClick={verificar} disabled={pendiente}>
            Ya pagué
          </Boton>
        </div>
      )}
    </Tarjeta>
  );
}
