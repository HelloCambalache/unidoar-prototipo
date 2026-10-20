"use client";

import { useState, useTransition } from "react";
import { activarDebitoAutomatico, cancelarDebitoAutomatico, continuarDebitoAutomatico } from "@/app/actions/suscripcion";
import { BotonAccion } from "@/components/institucion/boton-accion";
import { Boton } from "@/components/ui/button";
import { Campo, Input } from "@/components/ui/campos";
import { Insignia } from "@/components/ui/insignia";
import { Tarjeta } from "@/components/ui/tarjeta";
import { useToast } from "@/components/ui/toast";
import { ETIQUETA_SUSCRIPCION } from "@/lib/debito-automatico";
import { pesos } from "@/lib/planes";
import { etiquetaPeriodo } from "@/lib/cobros";
import type { DebitoVista } from "@/lib/queries/suscripcion-vista";

/**
 * "Débito automático" con Mercado Pago: la institución lo autoriza una sola vez (carga su tarjeta en Mercado Pago, nosotros nunca la
 * vemos) y Mercado Pago cobra el plan cada mes. Acá se activa, se retoma si quedó a medias y se cancela. Si Mercado Pago no está
 * configurado (todavía no hay token), la tarjeta no se muestra.
 */
export function PlanDebito({ datos, volvioDeMercadoPago }: { datos: DebitoVista; volvioDeMercadoPago: boolean }) {
  const toast = useToast();
  const [pendiente, empezar] = useTransition();
  const [email, setEmail] = useState(datos.emailSugerido);
  const [errorEmail, setErrorEmail] = useState<string | null>(null);

  if (!datos.disponible) return null;

  const irAMercadoPago = (url: string | null | undefined) => {
    if (url) window.location.assign(url);
  };

  const activar = () => {
    setErrorEmail(null);
    empezar(async () => {
      try {
        const r = await activarDebitoAutomatico(email);
        if (!r.ok) {
          if (r.campos?.email) setErrorEmail(r.campos.email);
          else toast(r.error, "error");
          return;
        }
        irAMercadoPago(r.data.url);
      } catch {
        toast("No pudimos activar el débito automático. Probá de nuevo.", "error");
      }
    });
  };

  const continuar = () => {
    empezar(async () => {
      try {
        const r = await continuarDebitoAutomatico();
        if (!r.ok) toast(r.error, "error");
        else if (r.data.url) irAMercadoPago(r.data.url);
        else toast("Tu débito automático ya está activo.");
      } catch {
        toast("No pudimos conectarnos con Mercado Pago. Probá de nuevo.", "error");
      }
    });
  };

  const { suscripcion } = datos;
  const estado = suscripcion?.estado ?? null;

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
          <p className="mt-0 mb-4 max-w-[62ch] text-[13.5px] leading-normal text-apagado">
            Autorizalo una sola vez y Mercado Pago cobra tu plan
            {datos.montoActual ? ` (${pesos(datos.montoActual)} por mes)` : ""} en tu tarjeta cada mes. Cargás la tarjeta en Mercado Pago:
            nosotros nunca la vemos ni la guardamos. Podés cancelarlo cuando quieras.
          </p>
          {estado === "cancelada" && (
            <p className="mt-0 mb-4 text-[13px] leading-normal text-apagado">El débito automático anterior está cancelado. Podés activarlo de nuevo.</p>
          )}
          {datos.puedeGestionar ? (
            <div className="flex flex-wrap items-end gap-3">
              <Campo etiqueta="Mail de tu cuenta de Mercado Pago" error={errorEmail ?? undefined} className="min-w-[260px] flex-[1_1_300px]">
                <Input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={120} />
              </Campo>
              <Boton variante="primario" onClick={activar} disabled={pendiente} aria-busy={pendiente}>
                {pendiente ? "Abriendo Mercado Pago…" : "Activar débito automático"}
              </Boton>
            </div>
          ) : (
            <p className="m-0 text-[12.5px] leading-normal text-apagado">Solo el dueño y los administradores del equipo pueden activarlo.</p>
          )}
        </>
      )}

      {estado === "pendiente" && (
        <>
          <p className="mt-0 mb-4 max-w-[62ch] text-[13.5px] leading-normal text-apagado">
            {volvioDeMercadoPago
              ? "Estamos confirmando tu autorización con Mercado Pago. Puede tardar unos minutos: si ya la completaste, tocá “Ya lo autoricé” para actualizar."
              : "Falta un paso: cargar tu tarjeta y autorizar el débito en Mercado Pago. Hasta entonces no se cobra nada."}
          </p>
          {datos.puedeGestionar && (
            <div className="flex flex-wrap gap-2.5">
              <Boton variante="primario" onClick={continuar} disabled={pendiente} aria-busy={pendiente}>
                {pendiente ? "Un momento…" : volvioDeMercadoPago ? "Ya lo autoricé" : "Continuar en Mercado Pago"}
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
          <p className="mt-0 mb-3 text-[13px] leading-normal text-apagado">Cuenta de Mercado Pago: {suscripcion.email}</p>
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
