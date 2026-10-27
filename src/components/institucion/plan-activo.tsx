"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { Boton, BotonLink } from "@/components/ui/button";
import { DialogoModal } from "@/components/ui/dialogo-modal";
import { CODIGO_PLAN_INACTIVO, cartelDePlanSinPago, contenidoDelPopup, type DatosDelPopup, type MotivoDePlanInactivo } from "@/lib/plan-activo";
import { cn } from "@/lib/utils";

/*
 * Popup de pago del área de la institución (reglas y textos en src/lib/plan-activo.ts). Aparece cuando la persona INTENTA publicar una búsqueda,
 * invitar a postularse, publicar un curso o reabrir una búsqueda y el plan no está activo: porque es una cuenta nueva sin su primer pago o porque
 * tiene una factura vencida hace más de 15 días. Muestra el plan, lo que cuesta y cómo pagar (el pago lo registra el equipo: no hay cobro en línea).
 *
 * El servidor es quien decide (cada acción lo vuelve a exigir): la pantalla solo se adelanta con lo que sabía al cargar (`frenarSiHaceFalta`) y,
 * si el servidor frena algo que ella creía permitido, abre el popup con `atender` y se recarga para traer el estado de verdad.
 */

type ResultadoDeAccion = { ok: boolean; error?: string; codigo?: string } | null | undefined;

type Valor = {
  /** Por qué el plan no está activo según lo que la pantalla sabía al cargar (null: activo). */
  motivo: MotivoDePlanInactivo | null;
  /** Para preguntar ANTES de una acción: con el plan inactivo abre el popup y devuelve true (hay que frenar). */
  frenarSiHaceFalta: () => boolean;
  /** Abre el popup (lo usa el cartel). */
  mostrar: () => void;
  /** Para el resultado de una acción: si es el aviso de plan inactivo del servidor, abre el popup y devuelve true. */
  atender: (resultado: ResultadoDeAccion) => boolean;
};

// Fuera del área de la institución (o sin proveedor) todo sigue como antes: nada se frena ni se abre.
const SIN_PROVEEDOR: Valor = { motivo: null, frenarSiHaceFalta: () => false, mostrar: () => {}, atender: () => false };
const Contexto = createContext<Valor>(SIN_PROVEEDOR);

/** `const { frenarSiHaceFalta, atender } = usePlanActivo();` */
export function usePlanActivo() {
  return useContext(Contexto);
}

/** Va en el layout de la institución. `datos` es null cuando el plan está activo (no se calcula ni se manda nada más). */
export function PlanActivoProvider({ datos, children }: { datos: DatosDelPopup | null; children: React.ReactNode }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [mensajeDelServidor, setMensajeDelServidor] = useState<string | undefined>(undefined);
  const motivo = datos?.motivo ?? null;

  const cerrar = useCallback(() => setAbierto(false), []);
  const mostrar = useCallback(() => {
    setMensajeDelServidor(undefined);
    setAbierto(true);
  }, []);
  const frenarSiHaceFalta = useCallback(() => {
    if (!motivo) return false;
    mostrar();
    return true;
  }, [motivo, mostrar]);
  const atender = useCallback(
    (resultado: ResultadoDeAccion) => {
      if (!resultado || resultado.ok || resultado.codigo !== CODIGO_PLAN_INACTIVO) return false;
      setMensajeDelServidor(resultado.error);
      setAbierto(true);
      // La pantalla creía el plan activo: se recarga para traer el estado de verdad, y el popup pasa a mostrar el plan y el precio.
      if (!motivo) router.refresh();
      return true;
    },
    [motivo, router],
  );

  const valor = useMemo<Valor>(() => ({ motivo, frenarSiHaceFalta, mostrar, atender }), [motivo, frenarSiHaceFalta, mostrar, atender]);
  const contenido = contenidoDelPopup(motivo, datos, mensajeDelServidor);
  const whatsapp = datos?.whatsapp ?? null;

  return (
    <Contexto.Provider value={valor}>
      {children}
      <DialogoModal abierto={abierto} onCerrar={cerrar} titulo={contenido.titulo} ancho={620}>
        <p className="mt-0 mb-4 text-[14px] leading-normal text-tinta-2">{contenido.bajada}</p>
        {contenido.plan && (
          <div className="mb-4 rounded-interno border border-borde bg-superficie px-4 py-3.5">
            <div className="text-[11.5px] font-semibold tracking-[.06em] text-sutil uppercase">Tu plan</div>
            <div className="mt-0.5 text-[15px] leading-snug font-semibold">{contenido.plan.nombre}</div>
            {contenido.plan.precio && <div className="mt-1 text-[22px] leading-tight font-semibold tabular-nums">{contenido.plan.precio}</div>}
            {contenido.plan.semestre && <p className="m-0 mt-1.5 text-[13px] leading-normal text-apagado">{contenido.plan.semestre}</p>}
          </div>
        )}
        <h3 className="m-0 mb-1.5 text-[14px] font-semibold">Cómo pagar</h3>
        <ol className="m-0 mb-5 flex list-decimal flex-col gap-1.5 pl-5 text-[14px] leading-normal text-tinta-2">
          {contenido.pasos.map((paso) => (
            <li key={paso}>{paso}</li>
          ))}
        </ol>
        <div className="flex flex-wrap justify-end gap-2.5">
          <Boton variante="fantasma" className="mr-auto" onClick={cerrar}>
            Ahora no
          </Boton>
          <BotonLink href="/institucion/plan" variante="secundario" onClick={cerrar}>
            Plan y facturación
          </BotonLink>
          {whatsapp && (
            <BotonLink href={whatsapp} target="_blank" rel="noopener noreferrer" variante="secundario" onClick={cerrar}>
              WhatsApp
            </BotonLink>
          )}
          <BotonLink href="/contacto" variante="primario" onClick={cerrar}>
            Escribirnos
          </BotonLink>
        </div>
      </DialogoModal>
    </Contexto.Provider>
  );
}

/**
 * Cartel de una cuenta nueva que todavía no pagó (el de la factura vencida es `AvisoDeMora`, en el servidor): dice que el plan no está activo y
 * qué se frena. Sin ese caso no dibuja nada. En Plan y facturación (`enPlan`) lleva a Contacto en lugar de abrir el popup, que repetiría la pantalla.
 */
export function AvisoDePlanSinPago({ enPlan = false, className }: { enPlan?: boolean; className?: string }) {
  const { motivo, mostrar } = usePlanActivo();
  if (motivo !== "sin-pago") return null;
  const cartel = cartelDePlanSinPago();
  return (
    <section
      role="status"
      aria-label="Plan sin activar"
      className={cn(
        "mb-5 flex max-w-[980px] flex-wrap items-center justify-between gap-4 rounded-caja border border-[#F2D9B3] bg-[#FEF1DF] px-[18px] py-3.5",
        className,
      )}
    >
      <div className="min-w-[260px] flex-1 max-[560px]:min-w-0">
        <h2 className="m-0 mb-0.5 text-[15px] leading-snug font-semibold text-[#8A4B07]">{cartel.titulo}</h2>
        <p className="m-0 text-[13px] leading-normal text-[#8A4B07]">{cartel.texto}</p>
      </div>
      {enPlan ? (
        <BotonLink href="/contacto" variante="secundario" tamano="sm" className="flex-none">
          Escribirnos
        </BotonLink>
      ) : (
        <Boton variante="secundario" tamano="sm" className="flex-none" onClick={mostrar}>
          Cómo activarlo
        </Boton>
      )}
    </section>
  );
}
