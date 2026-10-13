import type { Metadata } from "next";
import { EncabezadoPagina } from "@/components/app/encabezado-pagina";
import { PlanesFormulario } from "@/components/backoffice/planes-formulario";
import { EtiquetaSeccion, Tarjeta } from "@/components/ui/tarjeta";
import { requerirUsuario } from "@/lib/auth";
import { fechaHoraCorta } from "@/lib/calendario";
import { CLAVES_PLAN, cambiosDeAuditoria, describirCambioDePlanes, edicionDesdeCatalogo, huellaDePlanes, type PlanClave } from "@/lib/planes";
import { cambiosRecientesDePlanes, institucionesPorPlan, leerCatalogoDePlanes, planes } from "@/lib/queries/planes";

export const metadata: Metadata = { title: "Planes · Backoffice" };
// Precios y condiciones: siempre lo último que se guardó, nunca una copia.
export const dynamic = "force-dynamic";

export default async function PlanesBackoffice() {
  // El layout ya lo exige, pero acá se editan los precios: se vuelve a verificar en cada página.
  await requerirUsuario("admin");
  const [catalogo, conteo, recientes, P] = await Promise.all([leerCatalogoDePlanes(), institucionesPorPlan(), cambiosRecientesDePlanes(8), planes()]);
  const inicial = edicionDesdeCatalogo(catalogo);
  const cantidades = Object.fromEntries(CLAVES_PLAN.map((c) => [c, conteo.get(c) ?? 0])) as Record<PlanClave, number>;

  return (
    <>
      <EncabezadoPagina
        titulo="Planes y aranceles"
        bajada="Lo que cobra UNIDOAR a las instituciones. Lo que guardes acá cambia la página de aranceles, el plan de cada cuenta y las facturas que se creen de ahora en más."
      />

      <div role="note" className="mb-6 rounded-ud border border-[#F2D9B3] bg-[#FEF1DF] px-[18px] py-3.5 text-[13.5px] leading-normal text-[#8A4B07]">
        <b className="font-semibold">Las facturas ya emitidas no cambian:</b> cada una guarda el monto con el que se creó. Un precio nuevo se cobra desde la próxima factura de cada institución.
      </div>

      <PlanesFormulario key={huellaDePlanes(inicial)} inicial={inicial} huella={huellaDePlanes(inicial)} cantidades={cantidades} />

      <section className="mt-8" aria-labelledby="ultimos-cambios">
        <EtiquetaSeccion id="ultimos-cambios">Últimos cambios</EtiquetaSeccion>
        {recientes.length === 0 ? (
          <Tarjeta className="p-[22px] text-sm leading-normal text-apagado">Todavía no se cambió nada: están los valores de lanzamiento.</Tarjeta>
        ) : (
          <Tarjeta className="flex flex-col divide-y divide-borde p-0">
            {recientes.map((c, i) => {
              const lineas = cambiosDeAuditoria(c.detalle).map((x) => describirCambioDePlanes(x, P.nombreDePlan));
              return (
                <div key={i} className="px-[22px] py-3.5">
                  <div className="mb-1 text-xs leading-none text-sutil">
                    {fechaHoraCorta(c.cuando)} · {c.quien ?? "Equipo"}
                  </div>
                  {lineas.length === 0 ? (
                    <div className="text-[13.5px] leading-normal text-tinta">Editó los planes</div>
                  ) : (
                    <ul className="m-0 list-none p-0 text-[13.5px] leading-normal text-tinta">
                      {lineas.map((l, j) => (
                        <li key={j}>{l}</li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </Tarjeta>
        )}
      </section>
    </>
  );
}
