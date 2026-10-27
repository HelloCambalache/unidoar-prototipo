import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PlanFacturaAcciones } from "@/components/institucion/plan-factura-acciones";
import { Insignia } from "@/components/ui/insignia";
import { institucionActual, requerirInstitucion } from "@/lib/auth";
import { esUuid } from "@/lib/busquedas";
import { etiquetaDeCobertura } from "@/lib/cobros";
import { ESTADO_FACTURA, estadoDeFactura, numeroDeComprobante, periodoLegible } from "@/lib/facturacion";
import { fechaCorta } from "@/lib/fechas";
import { fechaLarga } from "@/lib/fechas-curso";
import { pesos } from "@/lib/planes";
import { planes } from "@/lib/queries/planes";
import { facturaPropia } from "@/lib/queries/plan";

/** El título de la pestaña es el nombre que sugiere el navegador al guardar el PDF. */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const institucion = await institucionActual();
  const factura = institucion && esUuid(id) ? await facturaPropia(institucion.id, id) : null;
  return { title: { absolute: factura ? `Comprobante ${periodoLegible(factura.periodo)} - UNIDOAR` : "Comprobante - UNIDOAR" } };
}

/*
 * Al imprimir se oculta todo el marco de la app (header, menú) y el contenedor deja de ser una pantalla con
 * scroll. `@page` sin margen saca el encabezado y pie del navegador; el margen real lo da el padding de la hoja.
 */
const ESTILOS_IMPRESION = `
@media print {
  @page { size: A4; margin: 0; }
  html, body { background: #fff !important; height: auto !important; }
  .h-screen > header, .h-screen aside, [data-no-imprimir] { display: none !important; }
  .h-screen, .h-screen > div { display: block !important; height: auto !important; overflow: visible !important; }
  main { display: block !important; padding: 0 !important; overflow: visible !important; }
  main > * { max-width: none !important; }
  #factura-hoja { border: 0 !important; border-radius: 0 !important; box-shadow: none !important; margin: 0 !important; max-width: none !important; padding: 14mm !important; }
  #factura-hoja section { break-inside: avoid; }
}
`;

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function Dato({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="mb-1 text-[11px] leading-none font-semibold tracking-[.06em] text-sutil uppercase">{etiqueta}</dt>
      <dd className="m-0 text-sm leading-[1.4] text-tinta">{children}</dd>
    </div>
  );
}

export default async function ComprobanteDeFactura({ params, searchParams }: Props) {
  const { institucion } = await requerirInstitucion();
  const { id } = await params;
  const { imprimir } = await searchParams;
  if (!esUuid(id)) notFound();
  const factura = await facturaPropia(institucion.id, id);
  if (!factura) notFound();

  const estado = ESTADO_FACTURA[estadoDeFactura(factura.estado)];
  const plan = (await planes()).planDe(factura.plan);
  const direccion = [institucion.direccion, institucion.partido, institucion.provincia].filter(Boolean).join(", ");
  // Un semestre pagado al contado es una sola factura que cubre varios meses: se muestra el rango completo.
  const prepago = factura.mesesCubiertos > 1;
  const periodoTexto = prepago ? etiquetaDeCobertura(factura.periodo, factura.mesesCubiertos) : periodoLegible(factura.periodo);

  return (
    <>
      <style>{ESTILOS_IMPRESION}</style>
      <PlanFacturaAcciones imprimirAlAbrir={imprimir === "1"} />
      <article
        id="factura-hoja"
        className="mx-auto w-full max-w-[820px] rounded-lg border border-borde bg-white p-6 text-tinta shadow-[0_2px_10px_rgba(31,36,33,.06)] sm:p-10"
      >
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-borde pb-5">
          <div>
            <div className="font-display text-2xl leading-none font-bold tracking-[.02em] text-navy-700">UNIDOAR</div>
            <div className="mt-1.5 text-xs leading-none text-sutil">Red y conexión educativa</div>
          </div>
          <div className="sm:text-right">
            <h1 className="font-display m-0 text-xl leading-[1.2] font-bold tracking-[-0.01em]">Comprobante de facturación</h1>
            <div className="mt-1 text-[13px] leading-[1.4] text-apagado">
              N.º {numeroDeComprobante(factura.id)} · {periodoTexto}
            </div>
          </div>
        </header>

        <section className="mt-6">
          <h2 className="m-0 mb-2.5 border-b border-borde pb-1.5 text-[11px] leading-none font-semibold tracking-[.08em] text-sutil uppercase">
            Facturado a
          </h2>
          <p className="m-0 text-base leading-[1.3] font-semibold">{institucion.nombre}</p>
          <dl className="m-0 mt-3 grid grid-cols-2 gap-4 max-[560px]:grid-cols-1">
            {institucion.cuit && <Dato etiqueta="CUIT">{institucion.cuit}</Dato>}
            {institucion.condicionFiscal && <Dato etiqueta="Condición fiscal">{institucion.condicionFiscal}</Dato>}
            {direccion && <Dato etiqueta="Domicilio">{direccion}</Dato>}
          </dl>
        </section>

        <section className="mt-6">
          <h2 className="m-0 mb-2.5 border-b border-borde pb-1.5 text-[11px] leading-none font-semibold tracking-[.08em] text-sutil uppercase">
            Detalle
          </h2>
          <div className="flex items-baseline justify-between gap-4 py-2">
            <div>
              <div className="text-[15px] leading-[1.3] font-semibold">{plan.label}</div>
              <div className="text-[13px] leading-[1.4] text-apagado">
                Período: {periodoTexto} · {prepago ? "pago por adelantado" : "por mes"}
              </div>
            </div>
            <div className="text-[15px] leading-none font-semibold whitespace-nowrap">{pesos(factura.monto)}</div>
          </div>
          <div className="flex items-baseline justify-between gap-4 border-t border-borde pt-3">
            <div className="text-sm font-semibold">Total (pesos argentinos)</div>
            <div className="font-display text-[22px] leading-none font-bold whitespace-nowrap">{pesos(factura.monto)}</div>
          </div>
        </section>

        <section className="mt-6">
          <h2 className="m-0 mb-2.5 border-b border-borde pb-1.5 text-[11px] leading-none font-semibold tracking-[.08em] text-sutil uppercase">
            Cobro
          </h2>
          <dl className="m-0 grid grid-cols-2 gap-4 max-[560px]:grid-cols-1">
            <Dato etiqueta="Estado">
              <Insignia tono={estado.tono}>{estado.texto}</Insignia>
            </Dato>
            <Dato etiqueta="Fecha de cobro">{fechaLarga(factura.fechaCobro)}</Dato>
            {factura.pagadaEn && <Dato etiqueta="Pagada el">{fechaCorta(factura.pagadaEn)}</Dato>}
            {factura.medio && <Dato etiqueta="Medio de pago">{factura.medio}</Dato>}
          </dl>
        </section>

        <p className="m-0 mt-8 border-t border-borde pt-3 text-[11px] leading-normal text-sutil">
          Comprobante generado desde UNIDOAR el {fechaCorta(new Date())}.
        </p>
      </article>
    </>
  );
}
