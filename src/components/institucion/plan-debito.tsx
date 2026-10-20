"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { activarDebitoAutomatico, cancelarDebitoAutomatico, confirmarDebitoAutomatico } from "@/app/actions/suscripcion";
import { BotonAccion } from "@/components/institucion/boton-accion";
import { Boton } from "@/components/ui/button";
import { Insignia } from "@/components/ui/insignia";
import { Tarjeta } from "@/components/ui/tarjeta";
import { useToast } from "@/components/ui/toast";
import { ETIQUETA_SUSCRIPCION } from "@/lib/debito-automatico";
import { pesos } from "@/lib/planes";
import { etiquetaPeriodo } from "@/lib/cobros";
import type { DebitoVista } from "@/lib/queries/suscripcion-vista";

/** Al volver de Mercado Pago se le pregunta hasta 8 veces, cada 2,5 s: el aviso suele llegar en unos 3 segundos. */
const INTENTOS_AL_VOLVER = 8;
const ESPERA_ENTRE_INTENTOS_MS = 2500;

/**
 * "Débito automático" con Mercado Pago: la institución lo autoriza una sola vez (inicia sesión y carga su tarjeta en Mercado Pago, nosotros
 * nunca la vemos) y Mercado Pago cobra el plan cada mes. Acá se activa, se confirma al volver y se cancela. Si Mercado Pago no está
 * configurado (todavía no hay token), la tarjeta no se muestra. No se pide ningún mail: la suscripción la crea Mercado Pago con la cuenta
 * con la que la persona entre.
 */
export function PlanDebito({ datos, suscripcionDeLaVuelta }: { datos: DebitoVista; suscripcionDeLaVuelta: string | null }) {
  const toast = useToast();
  const router = useRouter();
  const [pendiente, empezar] = useTransition();

  const { suscripcion } = datos;
  const estado = suscripcion?.estado ?? null;
  const activa = estado === "autorizada" || estado === "pausada";
  const [confirmando, setConfirmando] = useState(!!suscripcionDeLaVuelta && !activa);

  // Al volver de Mercado Pago la suscripción puede tardar unos segundos en llegar: se confirma sola, sin que la persona tenga que tocar nada.
  useEffect(() => {
    if (!suscripcionDeLaVuelta || activa) return;
    let cancelado = false;
    (async () => {
      for (let intento = 0; intento < INTENTOS_AL_VOLVER && !cancelado; intento++) {
        try {
          const r = await confirmarDebitoAutomatico(suscripcionDeLaVuelta);
          if (cancelado) return;
          if (r.ok && r.data.activo) {
            router.replace("/institucion/plan");
            router.refresh();
            return;
          }
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
  }, [suscripcionDeLaVuelta, activa, router]);

  if (!datos.disponible) return null;

  const activar = () => {
    empezar(async () => {
      try {
        const r = await activarDebitoAutomatico();
        if (!r.ok) {
          toast(r.error, "error");
          return;
        }
        if (r.data.url) window.location.assign(r.data.url);
      } catch {
        toast("No pudimos activar el débito automático. Probá de nuevo.", "error");
      }
    });
  };

  const actualizar = () => {
    empezar(async () => {
      try {
        const r = await confirmarDebitoAutomatico(suscripcionDeLaVuelta ?? undefined);
        if (!r.ok) toast(r.error, "error");
        else if (r.data.activo) {
          toast("Tu débito automático está activo.");
          router.refresh();
        } else toast("Todavía no vemos tu suscripción en Mercado Pago. Puede tardar unos minutos: probá de nuevo en un rato.");
      } catch {
        toast("No pudimos conectarnos con Mercado Pago. Probá de nuevo.", "error");
      }
    });
  };

  const sinConfirmar = !!suscripcionDeLaVuelta && !confirmando && !activa;

  return (
    <Tarjeta como="section" aria-labelledby="debito-titulo" className="mt-4 max-w-[980px] p-6">
      <div className="mb-1 flex flex-wrap items-center gap-2.5">
        <h2 id="debito-titulo" className="m-0 font-display text-[17px] leading-tight font-bold text-tinta">
          Débito automático
        </h2>
        {estado && estado !== "cancelada" && (
          <Insignia className={estado === "autorizada" ? "bg-verde-tint text-verde" : "bg-naranja-tint text-naranja-ink"}>
            {ETIQUETA_SUSCRIPCION[estado]}
          </Insignia>
        )}
      </div>

      {!datos.planDebitable && (
        <p className="m-0 text-[13.5px] leading-normal text-apagado">
          Tu plan es anual: se paga por adelantado, así que no tiene débito automático.
        </p>
      )}

      {datos.planDebitable && (!suscripcion || estado === "cancelada") && (
        <>
          {confirmando ? (
            <p role="status" aria-live="polite" className="m-0 max-w-[62ch] text-[13.5px] leading-normal text-apagado">
              Estamos confirmando tu suscripción con Mercado Pago. Puede tardar unos segundos: esta pantalla se actualiza sola.
            </p>
          ) : (
            <>
              <p className="mt-0 mb-4 max-w-[62ch] text-[13.5px] leading-normal text-apagado">
                Autorizalo una sola vez y Mercado Pago cobra tu plan
                {datos.montoActual ? ` (${pesos(datos.montoActual)} por mes)` : ""} en tu tarjeta cada mes. Te llevamos a Mercado Pago: ahí iniciás
                sesión con tu cuenta y cargás la tarjeta. Nosotros nunca la vemos ni la guardamos. Podés cancelarlo cuando quieras.
              </p>
              {datos.primerCobro && (
                <p className="mt-0 mb-4 max-w-[62ch] text-[13px] leading-normal text-tinta-2">
                  Este mes ya figura pago: hoy no se te cobra nada y Mercado Pago recién cobra el {datos.primerCobro}.
                </p>
              )}
              {estado === "cancelada" && (
                <p className="mt-0 mb-4 text-[13px] leading-normal text-apagado">El débito automático anterior está cancelado. Podés activarlo de nuevo.</p>
              )}
              {sinConfirmar && (
                <p role="status" className="mt-0 mb-4 max-w-[62ch] text-[13px] leading-normal text-apagado">
                  Todavía no nos llegó la confirmación de Mercado Pago. Si ya te suscribiste, puede tardar unos minutos: tocá “Actualizar” en un rato.
                </p>
              )}
              {datos.activarDesde ? (
                <p className="m-0 max-w-[62ch] text-[13px] leading-normal text-tinta-2">
                  Este mes ya figura pago: para no cobrarte dos veces, vas a poder activar el débito automático desde el {datos.activarDesde}.
                </p>
              ) : datos.puedeGestionar ? (
                <div className="flex flex-wrap gap-2.5">
                  <Boton variante="primario" onClick={activar} disabled={pendiente} aria-busy={pendiente}>
                    {pendiente ? "Abriendo Mercado Pago…" : "Activar débito automático"}
                  </Boton>
                  {(datos.planReciente || sinConfirmar) && (
                    <Boton variante="secundario" onClick={actualizar} disabled={pendiente}>
                      {sinConfirmar ? "Actualizar" : "Ya me suscribí"}
                    </Boton>
                  )}
                </div>
              ) : (
                <p className="m-0 text-[12.5px] leading-normal text-apagado">Solo el dueño y los administradores del equipo pueden activarlo.</p>
              )}
            </>
          )}
        </>
      )}

      {estado === "pendiente" && (
        <>
          <p className="mt-0 mb-4 max-w-[62ch] text-[13.5px] leading-normal text-apagado">
            Mercado Pago todavía está confirmando tu suscripción. Puede tardar unos minutos y hasta entonces no se cobra nada.
          </p>
          {datos.puedeGestionar && (
            <div className="flex flex-wrap gap-2.5">
              <Boton variante="primario" onClick={actualizar} disabled={pendiente} aria-busy={pendiente}>
                {pendiente ? "Un momento…" : "Actualizar"}
              </Boton>
              <BotonAccion accion={cancelarDebitoAutomatico} exito="Débito automático cancelado" confirmar="¿Cancelar el débito automático que quedó a medias?">
                Cancelar
              </BotonAccion>
            </div>
          )}
        </>
      )}

      {suscripcion && (estado === "autorizada" || estado === "pausada") && (
        <>
          <p className="mt-0 mb-1 text-[14px] leading-normal text-tinta">
            {estado === "autorizada"
              ? `Mercado Pago cobra ${pesos(suscripcion.monto)} cada mes en la tarjeta que autorizaste.`
              : "Tu débito automático está en pausa en Mercado Pago: este mes no se cobra solo."}
          </p>
          {estado === "autorizada" && suscripcion.proximoCobro && (
            <p className="mt-0 mb-1 text-[13px] leading-normal text-apagado">Próximo cobro: {suscripcion.proximoCobro}</p>
          )}
          {suscripcion.email && <p className="mt-0 mb-3 text-[13px] leading-normal text-apagado">Cuenta de Mercado Pago: {suscripcion.email}</p>}
          {datos.rechazo && (
            <p role="status" className="mt-0 mb-3 rounded-caja bg-naranja-tint px-3.5 py-2.5 text-[13px] leading-normal text-naranja-ink">
              Mercado Pago no pudo cobrar {datos.rechazo.periodo ? etiquetaPeriodo(datos.rechazo.periodo) : "el último mes"} y lo va a volver a
              intentar. Revisá el medio de pago en tu cuenta de Mercado Pago.
            </p>
          )}
          {datos.puedeGestionar ? (
            <BotonAccion
              accion={cancelarDebitoAutomatico}
              exito="Débito automático cancelado"
              confirmar="¿Cancelar el débito automático? Mercado Pago deja de cobrar y los pagos del plan pasan a hacerse por otro medio."
            >
              Cancelar débito automático
            </BotonAccion>
          ) : (
            <p className="m-0 text-[12.5px] leading-normal text-apagado">Solo el dueño y los administradores del equipo pueden cancelarlo.</p>
          )}
        </>
      )}
    </Tarjeta>
  );
}
