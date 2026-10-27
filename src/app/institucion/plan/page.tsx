import type { Metadata } from "next";
import { EncabezadoPagina } from "@/components/app/encabezado-pagina";
import { MesesBonificados } from "@/components/institucion/meses-bonificados";
import { PlanDebito } from "@/components/institucion/plan-debito";
import { PlanHistorial } from "@/components/institucion/plan-historial";
import { PlanPanel } from "@/components/institucion/plan-panel";
import { PlanPuntual } from "@/components/institucion/plan-puntual";
import { PlanSemestral } from "@/components/institucion/plan-semestral";
import { getDb } from "@/db";
import { requerirInstitucion } from "@/lib/auth";
import { puedePagarSemestre, resumenDeSemestre } from "@/lib/forma-de-pago";
import { catalogoParaNavegador, crearPlanes, esClavePlan, pesos } from "@/lib/planes";
import { datosDePlan } from "@/lib/queries/plan";
import { mesesDe } from "@/lib/queries/bonificaciones";
import { formaDePagoDe } from "@/lib/queries/forma-de-pago";
import { catalogoDePlanes } from "@/lib/queries/planes";
import { creditosDe, saldoDeBusquedas } from "@/lib/queries/puntuales";
import { datosDeDebito } from "@/lib/queries/suscripcion-vista";

export const metadata: Metadata = { title: "Plan y facturación" };

/** Un número de recurso de Mercado Pago: letras, números, guion y guion bajo. */
const ID_DE_MERCADO_PAGO = /^[0-9A-Za-z_-]{1,64}$/;

export default async function PlanYFacturacion({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { usuario, institucion } = await requerirInstitucion();
  const [datos, catalogo, debito, { preapproval_id: preapprovalId, sin }, saldo, creditos, mesesGanados, formaDePago] = await Promise.all([
    datosDePlan(institucion, usuario.id),
    catalogoDePlanes(),
    datosDeDebito(institucion, usuario.id),
    searchParams,
    saldoDeBusquedas(getDb(), institucion.id),
    creditosDe(getDb(), institucion.id),
    mesesDe(institucion.id),
    formaDePagoDe(institucion.id),
  ]);
  const P = crearPlanes(catalogo);
  const esPuntual = P.esPuntual(datos.plan);
  // Una página que el plan no incluye (cursos, buscador de profesionales) manda acá con ?sin=: se le explica por qué.
  const faltante = sin === "cursos" ? "la difusión de cursos" : sin === "buscador" ? "el buscador y la base de profesionales" : null;
  // Mercado Pago agrega `preapproval_id` al volver de suscribirse: es la señal de que la persona viene de ahí. El número no se cree: la
  // acción solo lo usa si su plan es de esta institución.
  const vuelta = typeof preapprovalId === "string" && ID_DE_MERCADO_PAGO.test(preapprovalId) ? preapprovalId : null;

  return (
    <>
      <EncabezadoPagina
        titulo="Plan y facturación"
        bajada="Tu plan, el medio de pago y las facturas anteriores."
      />
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
      {/* Con un semestre ya pago el panel de arriba dice hasta cuándo: no hace falta ofrecerlo de nuevo. */}
      {puedePagarSemestre(P, datos.plan) && !datos.semestrePagoHasta && esClavePlan(datos.plan) && (
        <PlanSemestral
          forma={formaDePago}
          puedeGestionar={debito.puedeGestionar}
          resumen={resumenDeSemestre(P, datos.plan, datos.sedes, datos.acuerdo)}
        />
      )}
      <PlanDebito datos={debito} suscripcionDeLaVuelta={vuelta} />
      <PlanHistorial facturas={datos.facturas} />
    </>
  );
}
