"use client";

import { useState, useTransition } from "react";
import { cancelarSolicitudPlan, solicitarCambioPlan } from "@/app/actions/plan";
import { BotonAccion } from "@/components/institucion/boton-accion";
import { Boton } from "@/components/ui/button";
import { Insignia } from "@/components/ui/insignia";
import { useConfirmacion } from "@/components/ui/confirmacion";
import { useToast } from "@/components/ui/toast";
import { crearPlanes, pesos, type AcuerdoDePrecio, type CatalogoDePlanes, type PlanClave } from "@/lib/planes";
import { cn } from "@/lib/utils";

/**
 * Plan actual, próximo cobro y "Cambiar de plan". Todavía no hay pasarela de pago: elegir un plan no cobra
 * ni cambia nada, deja un pedido que el equipo de UNIDOAR confirma (se muestra acá hasta que lo atienda).
 */
export function PlanPanel({
  catalogo,
  plan,
  tipo,
  sedes,
  acuerdo,
  semestrePagoHasta,
  proximoCobro,
  medioPago,
  vencidas,
  solicitud,
  puedeCambiar,
}: {
  /** Los planes vigentes (los lee el servidor de la base). */
  catalogo: CatalogoDePlanes;
  plan: PlanClave;
  /** El tipo de la institución: de ahí sale el arancel que puede pedir (ver `planesParaPedir`). */
  tipo: string;
  /** Cuántas sedes tiene la institución: con más de una, el monto suma las adicionales. */
  sedes: number;
  /** El precio acordado con la institución (abono o convenio a medida), si lo tiene; sin acuerdo paga el de lista. */
  acuerdo: AcuerdoDePrecio | null;
  /** Si un semestre pagado al contado cubre el mes en curso, hasta qué mes ("marzo 2027"). */
  semestrePagoHasta: string | null;
  /** "10 de octubre de 2026 · $ 54.000" */
  proximoCobro: string | null;
  medioPago: string | null;
  vencidas: number;
  solicitud: { id: string; planSolicitado: PlanClave; cuando: string } | null;
  puedeCambiar: boolean;
}) {
  const P = crearPlanes(catalogo);
  const toast = useToast();
  const pedirConfirmacion = useConfirmacion();
  const [abierto, setAbierto] = useState(false);
  const [pendiente, empezar] = useTransition();
  const actual = P.planDe(plan);
  // Con más de una sede lo que se paga por período no es el precio del plan: se muestra el total y de dónde sale.
  const desglose = P.desgloseDeMonto(plan, sedes, acuerdo);
  // Con un precio acordado (o varias sedes) lo que se paga por período no es el precio de lista del plan: se muestra el total y de dónde sale.
  const mostrarTotal = desglose.sedes > 1 || desglose.acordado;
  const conVariasSedes = desglose.sedes > 1;
  const sedesAdicionales = `${desglose.adicionales} ${desglose.adicionales === 1 ? "sede adicional" : "sedes adicionales"}`;

  const pedir = async (destino: PlanClave) => {
    const p = P.planDe(destino);
    // El plan por sede es un convenio: no tiene un precio de lista para mostrar (la página pública también dice «A convenir»).
    const precio = p.porSede ? "a convenir según el volumen" : `${pesos(p.precio)}${P.sufijoDePrecio(destino)}`;
    // Una fundadora que pasa a otro plan pierde lo de fundadora (el valor, la insignia y su lugar en la portada) y su lugar se libera: se le avisa antes.
    const avisoDeFundadora = P.esFundador(plan)
      ? " Ojo: dejás de ser institución fundadora (el valor de fundadora, la insignia y tu logo en la portada) y tu lugar queda libre para otra."
      : "";
    const ok = await pedirConfirmacion(
      `¿Pedir el cambio al ${p.label} (${precio})? No se cobra ni se modifica nada ahora: el equipo de UNIDOAR te confirma el cambio y el cobro.${avisoDeFundadora}`,
    );
    if (!ok) return;
    empezar(async () => {
      try {
        const r = await solicitarCambioPlan(destino);
        if (!r.ok) toast(r.error, "error");
        else {
          toast("Pedido enviado: el equipo te confirma el cambio y el cobro.");
          setAbierto(false);
        }
      } catch {
        toast("No pudimos enviar el pedido. Probá de nuevo.", "error");
      }
    });
  };

  return (
    <>
      <div className="flex max-w-[980px] items-center justify-between gap-4 rounded-tarjeta bg-navy-700 p-6 text-white max-[860px]:flex-col max-[860px]:items-start">
        <div>
          <div className="mb-2.5">
            <Insignia className="bg-white/[.14] text-navy-100">{actual.label}</Insignia>
          </div>
          <div className="text-[26px] leading-[1.2] font-semibold">
            {pesos(mostrarTotal ? desglose.total : actual.precio)}
            <span className="text-sm leading-none font-normal text-white/60">{P.sufijoDePrecio(plan)}</span>
          </div>
          {desglose.acordado && (
            <div className="mt-1 text-[13px] leading-normal text-white/65">
              {desglose.convenio
                ? `Convenio acordado con UNIDOAR: un monto fijo, sin importar las sedes${conVariasSedes ? ` (${desglose.sedes} sedes)` : ""}.`
                : `Precio acordado con UNIDOAR${conVariasSedes ? "" : " (el de lista era " + pesos(actual.precio) + ")"}.`}
            </div>
          )}
          {conVariasSedes && !desglose.convenio && (
            <div className="mt-1 text-[13px] leading-normal text-white/65">
              {actual.porSede
                ? `${desglose.sedes} sedes × ${pesos(desglose.base)}`
                : `Sede principal ${pesos(desglose.base)} + ${sedesAdicionales} de ${pesos(desglose.precioAdicional)}`}
            </div>
          )}
          <div className="mt-1.5 text-[13px] leading-normal text-white/65">
            {semestrePagoHasta
              ? `Semestre pago hasta ${semestrePagoHasta}: no se te cobra nada hasta entonces.`
              : proximoCobro
                ? `Próximo cobro: ${proximoCobro}`
                : "No tenés cobros programados por ahora."}
          </div>
          {medioPago && <div className="mt-0.5 text-[13px] leading-normal text-white/65">Medio de pago: {medioPago}</div>}
        </div>
        {puedeCambiar && !solicitud && (
          <Boton
            variante="fantasma"
            aria-expanded={abierto}
            onClick={() => setAbierto((v) => !v)}
            className="border-white/35 text-white hover:bg-white/10 hover:text-white max-[860px]:w-full"
          >
            Cambiar de plan
          </Boton>
        )}
        {!puedeCambiar && (
          <p className="m-0 max-w-[260px] text-[12.5px] leading-normal text-white/65 max-[860px]:max-w-none">
            Solo el dueño y los administradores del equipo pueden cambiar de plan.
          </p>
        )}
      </div>

      {vencidas > 0 && (
        <p role="status" className="mt-4 mb-0 max-w-[980px] rounded-caja bg-naranja-tint px-3.5 py-2.5 text-[13px] leading-normal text-naranja-ink">
          {vencidas === 1 ? "Tenés 1 factura vencida." : `Tenés ${vencidas} facturas vencidas.`} Revisá el detalle en el historial de
          facturación.
        </p>
      )}

      {solicitud && (
        <div
          role="status"
          className="mt-4 flex max-w-[980px] flex-wrap items-center justify-between gap-3 rounded-caja border border-verde-borde bg-verde-tint px-[18px] py-4"
        >
          <div className="min-w-0 flex-[1_1_320px]">
            <div className="mb-1 text-sm leading-[1.3] font-semibold text-verde">
              Pedido enviado: el equipo te confirma el cambio y el cobro
            </div>
            <div className="text-[13px] leading-normal text-tinta-2">
              Pediste pasar al {P.planDe(solicitud.planSolicitado).label} · {solicitud.cuando}. Hasta que lo confirmen seguís con el{" "}
              {actual.label} y no se te cobra nada distinto.
            </div>
          </div>
          {puedeCambiar && (
            <BotonAccion
              accion={cancelarSolicitudPlan.bind(null, solicitud.id)}
              exito="Pedido cancelado"
              confirmar="¿Cancelar el pedido de cambio de plan?"
            >
              Cancelar pedido
            </BotonAccion>
          )}
        </div>
      )}

      {abierto && puedeCambiar && !solicitud && (
        <div className="mt-5 flex max-w-[1180px] flex-wrap gap-4">
          {P.planesParaPedir(tipo, sedes, plan).map((clave) => {
            const p = P.planDe(clave);
            const esActual = clave === plan;
            return (
              <div
                key={clave}
                className={cn(
                  "min-w-[220px] flex-1 rounded-tarjeta bg-white p-5",
                  esActual ? "border-2 border-navy-700" : "border border-borde",
                )}
              >
                {esActual && (
                  <div className="mb-2.5">
                    <Insignia className="bg-navy-700 text-white">Actual</Insignia>
                  </div>
                )}
                <div className="mb-1 text-base leading-[1.2] font-semibold">{p.label}</div>
                <div className="mb-2.5 text-2xl leading-none font-semibold">
                  {p.porSede ? (
                    <>
                      A convenir<span className="text-[13px] font-normal text-apagado"> según el volumen</span>
                    </>
                  ) : (
                    <>
                      {pesos(p.precio)}
                      <span className="text-[13px] font-normal text-apagado">{P.sufijoDePrecio(clave)}</span>
                    </>
                  )}
                </div>
                <p className={cn("m-0 text-[13px] leading-normal text-apagado", !esActual && "mb-3.5")}>{p.detalle}</p>
                {!esActual && (
                  <Boton variante="secundario" tamano="sm" onClick={() => pedir(clave)} disabled={pendiente} aria-busy={pendiente}>
                    {pendiente ? "Enviando…" : "Elegir"}
                  </Boton>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
