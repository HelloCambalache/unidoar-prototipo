import type { Metadata } from "next";
import { EncabezadoPagina } from "@/components/app/encabezado-pagina";
import { AvisoDeMora } from "@/components/institucion/aviso-de-mora";
import { AvisoDePlanSinPago } from "@/components/institucion/plan-activo";
import { MesesBonificados } from "@/components/institucion/meses-bonificados";
import { PagoDelSemestre } from "@/components/institucion/pago-del-semestre";
import { PlanDebito } from "@/components/institucion/plan-debito";
import { PlanHistorial } from "@/components/institucion/plan-historial";
import { PlanPanel } from "@/components/institucion/plan-panel";
import { PlanPuntual } from "@/components/institucion/plan-puntual";
import { getDb } from "@/db";
import { requerirInstitucion } from "@/lib/auth";
import { mercadoPagoActivo } from "@/lib/mercadopago-config";
import { vueltaDelPago } from "@/lib/pago-semestre";
import { catalogoParaNavegador, crearPlanes, pesos } from "@/lib/planes";
import { pagoPorMercadoPagoDisponiblePara } from "@/lib/queries/mercadopago-modo";
import { datosDePagoDeSemestre } from "@/lib/queries/pago-semestre";
import { datosDePlan } from "@/lib/queries/plan";
import { mesesDe } from "@/lib/queries/bonificaciones";
import { moraDeInstitucion } from "@/lib/queries/mora";
import { formaDePagoDe } from "@/lib/queries/forma-de-pago";
import { catalogoDePlanes } from "@/lib/queries/planes";
import { creditosDe, saldoDeBusquedas } from "@/lib/queries/puntuales";
import { datosDeDebito } from "@/lib/queries/suscripcion-vista";

export const metadata: Metadata = { title: "Plan y facturación" };

/** Un número de recurso de Mercado Pago: letras, números, guion y guion bajo. */
const ID_DE_MERCADO_PAGO = /^[0-9A-Za-z_-]{1,64}$/;

export default async function PlanYFacturacion({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { usuario, institucion } = await requerirInstitucion();
  const [datos, catalogo, debito, { preapproval_id: preapprovalId, sin, pago_semestre: pagoSemestreVuelta }, saldo, creditos, mesesGanados, formaDePago, mora] = await Promise.all([
    datosDePlan(institucion, usuario.id),
    catalogoDePlanes(),
    datosDeDebito(institucion, usuario.id),
    searchParams,
    saldoDeBusquedas(getDb(), institucion.id),
    creditosDe(getDb(), institucion.id),
    mesesDe(institucion.id),
    formaDePagoDe(institucion.id),
    moraDeInstitucion(institucion),
  ]);
  const P = crearPlanes(catalogo);
  const esPuntual = P.esPuntual(datos.plan);
  // Una página que el plan no incluye (cursos, buscador de profesionales) manda acá con ?sin=: se le explica por qué.
  const faltante = sin === "cursos" ? "la difusión de cursos" : sin === "buscador" ? "el buscador y la base de profesionales" : null;
  // Mercado Pago agrega `preapproval_id` al volver de suscribirse: es la señal de que la persona viene de ahí. El número no se cree: la
  // acción solo lo usa si su plan es de esta institución.
  const vuelta = typeof preapprovalId === "string" && ID_DE_MERCADO_PAGO.test(preapprovalId) ? preapprovalId : null;

  // Pagar el semestre por Mercado Pago (un pago único): solo si Mercado Pago está activo y es para esta institución (con un token de prueba, solo las de
  // ejemplo), y mientras no haya ya un semestre pago. El monto lo calcula el servidor; el navegador solo lo muestra.
  const mercadoPagoDisponible = mercadoPagoActivo() && (await pagoPorMercadoPagoDisponiblePara(institucion));
  const pagoSemestre = await datosDePagoDeSemestre(institucion.id, mercadoPagoDisponible && !datos.semestrePagoHasta);
  const vueltaDelPagoDelSemestre = mercadoPagoDisponible ? vueltaDelPago(pagoSemestreVuelta) : null;

  return (
    <>
      <EncabezadoPagina
        titulo="Plan y facturación"
        bajada="Tu plan, el medio de pago y las facturas anteriores."
      />
      <AvisoDeMora mora={mora} enPlan />
      <AvisoDePlanSinPago enPlan />
      <PlanPanel
        // El valor de fundadora solo lo ve quien tiene ese plan: a las demás instituciones no les viaja en el código de la página.
        catalogo={catalogoParaNavegador(catalogo, { sinPrecioDeFundador: datos.plan !== "fundador" })}
        plan={datos.plan}
        tipo={institucion.tipo}
        sedes={datos.sedes}
        acuerdo={datos.acuerdo}
        semestrePagoHasta={datos.semestrePagoHasta}
        proximoCobro={datos.proxima ? `${datos.proxima.fechaCobroLarga} · ${pesos(datos.proxima.monto)}` : null}
        medioPago={institucion.medioPago}
        vencidas={datos.vencidas}
        solicitud={datos.solicitud}
        puedeCambiar={datos.puedeCambiar}
        formaDePago={formaDePago}
        conMercadoPago={pagoSemestre.cotizacion !== null}
      />
      <PagoDelSemestre
        oferta={
          pagoSemestre.cotizacion
            ? {
                total: pagoSemestre.cotizacion.monto,
                cobertura: pagoSemestre.cotizacion.cobertura,
                mesesAPagar: pagoSemestre.cotizacion.mesesAPagar,
                meses: pagoSemestre.cotizacion.meses,
                usaMesBonificado: pagoSemestre.cotizacion.usaMesBonificado,
              }
            : null
        }
        hayLinkPendiente={pagoSemestre.hayLinkPendiente}
        paraRevisar={pagoSemestre.paraRevisar}
        vuelta={vueltaDelPagoDelSemestre}
        puedeGestionar={datos.puedeCambiar}
      />
      {faltante && esPuntual && (
        <p role="status" className="mt-4 mb-0 max-w-[980px] rounded-caja bg-naranja-tint px-3.5 py-2.5 text-[13px] leading-normal text-naranja-ink">
          Tu plan de búsqueda puntual no incluye {faltante}: son parte del abono mensual. Si los necesitás, pedí el cambio de plan.
        </p>
      )}
      {esPuntual && (
        <PlanPuntual
          creditos={creditos}
          disponibles={saldo.disponibles}
          abiertas={saldo.abiertas}
          vigenciaDias={P.condiciones.puntual.vigenciaDias}
          precio={pesos(P.montoDePlan(datos.plan, 1, datos.acuerdo))}
          incluyeCursos={P.incluye(datos.plan, "cursos")}
          incluyeBuscador={P.incluye(datos.plan, "buscador")}
        />
      )}
      <MesesBonificados meses={mesesGanados} className="mt-5 max-w-[980px] p-[22px]" />
      <PlanDebito datos={debito} suscripcionDeLaVuelta={vuelta} />
      <PlanHistorial facturas={datos.facturas} />
    </>
  );
}
