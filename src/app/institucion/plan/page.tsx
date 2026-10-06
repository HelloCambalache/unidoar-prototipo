import type { Metadata } from "next";
import { EncabezadoPagina } from "@/components/app/encabezado-pagina";
import { PlanHistorial } from "@/components/institucion/plan-historial";
import { PlanPanel } from "@/components/institucion/plan-panel";
import { requerirInstitucion } from "@/lib/auth";
import { pesos } from "@/lib/planes";
import { datosDePlan } from "@/lib/queries/plan";

export const metadata: Metadata = { title: "Plan y facturación" };

export default async function PlanYFacturacion() {
  const { usuario, institucion } = await requerirInstitucion();
  const datos = await datosDePlan(institucion, usuario.id);

  return (
    <>
      <EncabezadoPagina
        titulo="Plan y facturación"
        bajada="Tu plan, el medio de pago y las facturas anteriores."
      />
      <PlanPanel
        plan={datos.plan}
        proximoCobro={datos.proxima ? `${datos.proxima.fechaCobroLarga} · ${pesos(datos.proxima.monto)}` : null}
        medioPago={institucion.medioPago}
        vencidas={datos.vencidas}
        solicitud={datos.solicitud}
        puedeCambiar={datos.puedeCambiar}
      />
      <PlanHistorial facturas={datos.facturas} />
    </>
  );
}
