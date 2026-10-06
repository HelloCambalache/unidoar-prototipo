import type { Metadata } from "next";
import { requerirUsuario } from "@/lib/auth";
import { notFound } from "next/navigation";
import { CobroResumenAcciones } from "@/components/backoffice/cobro-resumen-acciones";
import { esUuid } from "@/lib/busquedas";
import {
  ETIQUETA_ESTADO_FACTURA,
  etiquetaPeriodo,
  fechaBreve,
  fechaDeColumna,
  nombreDePlan,
  precioDePlan,
} from "@/lib/cobros";
import { fechaCorta } from "@/lib/fechas";
import { pesos, planDe } from "@/lib/planes";
import { detalleDeCobros } from "@/lib/queries/backoffice-cobros";

export const dynamic = "force-dynamic";

/** El título de la pestaña es el nombre que sugiere el navegador al guardar el PDF. */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const detalle = esUuid(id) ? await detalleDeCobros(id) : null;
  return { title: { absolute: `Resumen de cuenta - ${detalle?.institucion.nombre ?? "UNIDOAR"}` } };
}

/*
 * Al imprimir se oculta todo el marco del backoffice (header, menú) y el contenedor deja de ser una pantalla
 * con scroll. `@page` sin margen saca el encabezado y pie del navegador; el margen real lo da el padding de la hoja.
 */
const ESTILOS_IMPRESION = `
@media print {
  @page { size: A4; margin: 0; }
  html, body { background: #fff !important; height: auto !important; }
  .h-screen > header, .h-screen aside, [data-no-imprimir] { display: none !important; }
  .h-screen, .h-screen > div { display: block !important; height: auto !important; overflow: visible !important; }
  main { display: block !important; padding: 0 !important; overflow: visible !important; }
  main > * { max-width: none !important; }
  #resumen-hoja { border: 0 !important; border-radius: 0 !important; box-shadow: none !important; margin: 0 !important; max-width: none !important; padding: 14mm !important; }
  #resumen-hoja section, #resumen-hoja tr { break-inside: avoid; }
}
`;

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="m-0 mb-2.5 border-b border-borde pb-1.5 text-[11px] leading-none font-semibold tracking-[.08em] text-sutil uppercase">
        {titulo}
      </h2>
      {children}
    </section>
  );
}

export default async function ResumenDeCuenta({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // El layout ya lo exige, pero acá se leen datos sensibles: se vuelve a verificar en cada página.
  await requerirUsuario("admin");
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  if (!esUuid(id)) notFound();
  const d = await detalleDeCobros(id);
  if (!d) notFound();

  const { institucion: i, facturas } = d;
  const imprimir = (Array.isArray(sp.imprimir) ? sp.imprimir[0] : sp.imprimir) === "1";
  const emitido = fechaCorta(new Date());
  const filasDeFacturas = [...facturas].sort((a, b) => a.fechaCobro.localeCompare(b.fechaCobro));

  return (
    <>
      <style>{ESTILOS_IMPRESION}</style>
      <CobroResumenAcciones volverHref={`/backoffice/cobros/${i.id}`} imprimirAlAbrir={imprimir} />
      <article
        id="resumen-hoja"
        className="mx-auto w-full max-w-[820px] rounded-lg border border-borde bg-white p-6 text-tinta shadow-[0_2px_10px_rgba(31,36,33,.06)] sm:p-10"
      >
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="m-0 text-[11px] leading-none font-semibold tracking-[.08em] text-sutil uppercase">UNIDOAR · Resumen de cuenta</p>
            <h1 className="font-display m-0 mt-2 text-[26px] leading-[1.15] font-bold tracking-[-0.02em]">{i.nombre}</h1>
            <p className="m-0 mt-1 text-[13.5px] leading-[1.4] text-apagado">
              Plan {nombreDePlan(i.plan)} · {precioDePlan(i.plan)}
            </p>
          </div>
          <p className="m-0 text-right text-xs leading-normal text-apagado">Emitido el {emitido}</p>
        </header>

        <Seccion titulo="Datos de facturación">
          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-[13.5px] leading-normal max-[560px]:grid-cols-1">
            <p className="m-0">
              <b className="font-semibold">Razón social: </b>
              {i.nombre}
            </p>
            <p className="m-0">
              <b className="font-semibold">CUIT: </b>
              {i.cuit ?? "—"}
            </p>
            <p className="m-0">
              <b className="font-semibold">Condición: </b>
              {i.condicionFiscal ?? "—"}
            </p>
            <p className="m-0">
              <b className="font-semibold">Medio de pago: </b>
              {i.medioPago ?? "—"}
              {planDe(i.plan).periodo === "mes" && i.diaCobro ? ` · día ${i.diaCobro} de cada mes` : ""}
            </p>
          </div>
        </Seccion>

        <Seccion titulo="Resumen">
          <div className="grid grid-cols-3 gap-4 max-[560px]:grid-cols-1">
            <div>
              <div className="text-[20px] leading-none font-semibold text-navy-700">{pesos(d.pagadoEnElAnio)}</div>
              <div className="mt-1.5 text-xs text-apagado">Pagado en {d.anio}</div>
            </div>
            <div>
              <div className="text-[20px] leading-none font-semibold" style={{ color: d.saldoPendiente > 0 ? "#8F3D28" : "#16214F" }}>
                {pesos(d.saldoPendiente)}
              </div>
              <div className="mt-1.5 text-xs text-apagado">Saldo pendiente</div>
            </div>
            <div>
              <div className="text-[20px] leading-none font-semibold text-navy-700">
                {d.proximo ? fechaBreve(d.proximo.fechaCobro) : "—"}
              </div>
              <div className="mt-1.5 text-xs text-apagado">{d.proximo?.estado === "vencida" ? "Cobro vencido" : "Próximo cobro"}</div>
            </div>
          </div>
        </Seccion>

        <Seccion titulo="Historial de cobros">
          {filasDeFacturas.length === 0 ? (
            <p className="m-0 text-[13.5px] text-apagado">Todavía no hay facturas cargadas.</p>
          ) : (
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="text-left text-[11px] tracking-[.04em] text-apagado uppercase">
                  <th className="border-b border-borde py-2 pr-3 font-semibold">Período</th>
                  <th className="border-b border-borde py-2 pr-3 font-semibold">Fecha de cobro</th>
                  <th className="border-b border-borde py-2 pr-3 font-semibold">Plan</th>
                  <th className="border-b border-borde py-2 pr-3 text-right font-semibold">Monto</th>
                  <th className="border-b border-borde py-2 pr-3 font-semibold">Medio</th>
                  <th className="border-b border-borde py-2 font-semibold">Estado</th>
                </tr>
              </thead>
              <tbody>
                {filasDeFacturas.map((f) => (
                  <tr key={f.id}>
                    <td className="border-b border-borde py-2 pr-3 font-semibold">{etiquetaPeriodo(f.periodo)}</td>
                    <td className="border-b border-borde py-2 pr-3">{fechaDeColumna(f.fechaCobro)}</td>
                    <td className="border-b border-borde py-2 pr-3">{nombreDePlan(f.plan)}</td>
                    <td className="border-b border-borde py-2 pr-3 text-right whitespace-nowrap">{pesos(f.monto)}</td>
                    <td className="border-b border-borde py-2 pr-3">{f.medio ?? "—"}</td>
                    <td className="border-b border-borde py-2">
                      {ETIQUETA_ESTADO_FACTURA[f.estado]}
                      {f.estado === "pagada" && f.pagadaEn && ` el ${fechaCorta(f.pagadaEn)}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Seccion>

        <p className="m-0 mt-8 border-t border-borde pt-3 text-[11px] leading-normal text-sutil">
          Resumen informativo generado por el equipo de UNIDOAR el {emitido}. No reemplaza a una factura fiscal.
        </p>
      </article>
    </>
  );
}
