import type { Metadata } from "next";
import { EncabezadoPagina } from "@/components/app/encabezado-pagina";
import { PlanDebito } from "@/components/institucion/plan-debito";
import { PlanHistorial } from "@/components/institucion/plan-historial";
import { PlanPanel } from "@/components/institucion/plan-panel";
import { requerirInstitucion } from "@/lib/auth";
import { pesos } from "@/lib/planes";
import { datosDePlan } from "@/lib/queries/plan";
import { catalogoDePlanes } from "@/lib/queries/planes";
import { datosDeDebito } from "@/lib/queries/suscripcion-vista";

export const metadata: Metadata = { title: "Plan y facturación" };

/** Un número de recurso de Mercado Pago: letras, números, guion y guion bajo. */
const ID_DE_MERCADO_PAGO = /^[0-9A-Za-z_-]{1,64}$/;

export default async function PlanYFacturacion({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { usuario, institucion } = await requerirInstitucion();
  const [datos, catalogo, debito, { preapproval_id: preapprovalId }] = await Promise.all([
    datosDePlan(institucion, usuario.id),
    catalogoDePlanes(),
    datosDeDebito(institucion, usuario.id),
    searchParams,
  ]);
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
        catalogo={catalogo}
        plan={datos.plan}
        proximoCobro={datos.proxima ? `${datos.proxima.fechaCobroLarga} · ${pesos(datos.proxima.monto)}` : null}
        medioPago={institucion.medioPago}
        vencidas={datos.vencidas}
        solicitud={datos.solicitud}
        puedeCambiar={datos.puedeCambiar}
      />
      <PlanDebito datos={debito} suscripcionDeLaVuelta={vuelta} />
      <PlanHistorial facturas={datos.facturas} />
    </>
  );
}
