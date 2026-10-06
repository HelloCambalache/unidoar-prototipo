import type { Metadata } from "next";
import { requerirUsuario } from "@/lib/auth";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EstadoVacio } from "@/components/app/estado-vacio";
import { CobroNuevaFactura } from "@/components/backoffice/cobro-nueva-factura";
import { CobroAnularPago } from "@/components/backoffice/cobro-anular-pago";
import { CobroPago, type FacturaParaPago } from "@/components/backoffice/cobro-pago";
import { InsigniaCobro, InsigniaFactura } from "@/components/backoffice/inst-insignias";
import { FranjaMetricas } from "@/components/backoffice/inst-metricas";
import { VolverBo } from "@/components/backoffice/inst-volver";
import { BotonWhatsapp } from "@/components/backoffice/inst-whatsapp";
import { BotonLink } from "@/components/ui/button";
import { Insignia } from "@/components/ui/insignia";
import { Tabla } from "@/components/ui/tabla";
import { EtiquetaSeccion, Tarjeta } from "@/components/ui/tarjeta";
import { esUuid } from "@/lib/busquedas";
import {
  enlaceWhatsappConTexto,
  esClavePlan,
  etiquetaPeriodo,
  fechaBreve,
  fechaDeColumna,
  nombreDePlan,
  periodoActual,
  precioDePlan,
  sumarMeses,
  textoRecordatorio,
  type EstadoCobro,
} from "@/lib/cobros";
import { fechaCorta, haceTiempo } from "@/lib/fechas";
import { PLANES, pesos } from "@/lib/planes";
import { detalleDeCobros, type FacturaBo } from "@/lib/queries/backoffice-cobros";

export const metadata: Metadata = { title: "Cobros de una institución · Backoffice" };
export const dynamic = "force-dynamic";

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <Tarjeta className="p-[22px]">
      <EtiquetaSeccion className="mb-3">{titulo}</EtiquetaSeccion>
      {children}
    </Tarjeta>
  );
}

function Dato({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-2.5 text-[13px] leading-[1.4]">
      <span className="flex-none text-apagado">{k}</span>
      <span className="min-w-0 text-right text-tinta [overflow-wrap:anywhere]">{children}</span>
    </div>
  );
}

const paraPago = (f: FacturaBo): FacturaParaPago => ({
  id: f.id,
  periodo: etiquetaPeriodo(f.periodo),
  monto: pesos(f.monto),
  vence: fechaDeColumna(f.fechaCobro),
  vencida: f.estado === "vencida",
});

export default async function CobrosDeInstitucion({ params }: { params: Promise<{ id: string }> }) {
  // El layout ya lo exige, pero acá se leen datos sensibles: se vuelve a verificar en cada página.
  await requerirUsuario("admin");
  const { id } = await params;
  if (!esUuid(id)) notFound();
  const d = await detalleDeCobros(id);
  if (!d) notFound();

  const { institucion: i, facturas, proximo } = d;
  const ahora = new Date();
  const plan = esClavePlan(i.plan) ? i.plan : "fundador";
  const estado: EstadoCobro = d.vencidas > 0 ? "vencida" : proximo ? "pendiente" : "aldia";

  const impagas = facturas.filter((f) => f.estado !== "pagada").sort((a, b) => a.fechaCobro.localeCompare(b.fechaCobro));
  const textoWhatsapp = textoRecordatorio(i.contactoNombre, i.nombre, impagas);
  const whatsapp = impagas.length > 0 ? enlaceWhatsappConTexto(i.telefono, textoWhatsapp) : null;

  // Primer mes sin factura: el siguiente al último cargado (o el actual si es más tarde).
  const ultimo = facturas.reduce((m, f) => (f.periodo > m ? f.periodo : m), "");
  const actual = periodoActual(ahora);
  const sugerido = ultimo && sumarMeses(ultimo, 1) > actual ? sumarMeses(ultimo, 1) : actual;

  return (
    <>
      <VolverBo href="/backoffice/cobros" etiqueta="Cobros" />
      <div className="flex flex-wrap items-start gap-5">
        <div className="flex min-w-[320px] flex-1 flex-col gap-4">
          <Tarjeta className="flex flex-wrap items-center justify-between gap-4 p-[22px]">
            <div>
              <div className="mb-1.5 flex flex-wrap items-center gap-2.5">
                <h1 className="m-0 text-[22px] leading-[1.2] font-semibold tracking-[-0.015em]">{i.nombre}</h1>
                <InsigniaCobro estado={estado} />
                {i.suspendida && <Insignia tono="naranja">Cuenta suspendida</Insignia>}
              </div>
              <div className="text-sm leading-[1.4] text-apagado">
                {PLANES[plan].label} · {precioDePlan(plan)}
              </div>
            </div>
            <Link href={`/backoffice/instituciones/${i.id}`} className="text-[13px] leading-none font-medium">
              Ver institución →
            </Link>
          </Tarjeta>

          {d.pedidosPendientes.length > 0 && (
            <div role="status" className="rounded-ud border border-[#F2D9B3] bg-[#FEF1DF] px-[18px] py-3.5 text-[13.5px] leading-normal text-[#8A4B07]">
              <b className="font-semibold">Tiene un pedido de cambio de plan sin atender:</b>{" "}
              {d.pedidosPendientes.map((p) => `pasar al ${nombreDePlan(p.planSolicitado)} (${haceTiempo(p.creadoEn, ahora)})`).join(", ")}.{" "}
              <Link href="/backoffice/cobros#pedidos" className="font-semibold text-[#8A4B07] underline">
                Atenderlo
              </Link>
            </div>
          )}

          <FranjaMetricas
            minimo={150}
            items={[
              { valor: pesos(d.pagadoEnElAnio), etiqueta: `Pagado en ${d.anio}` },
              { valor: pesos(d.saldoPendiente), etiqueta: "Saldo pendiente", color: d.saldoPendiente > 0 ? "#8F3D28" : undefined },
              { valor: proximo ? fechaBreve(proximo.fechaCobro) : "—", etiqueta: proximo?.estado === "vencida" ? "Cobro vencido" : "Próximo cobro" },
            ]}
          />

          <section aria-labelledby="historial-titulo">
            <EtiquetaSeccion className="mb-3" id="historial-titulo">
              Historial de cobros
            </EtiquetaSeccion>
            {facturas.length === 0 ? (
              <EstadoVacio titulo="Todavía no tiene facturas" texto="Cargá la primera desde “Cargar factura”." />
            ) : (
              <Tabla>
                <thead>
                  <tr>
                    <th>Período</th>
                    <th>Fecha</th>
                    <th>Monto</th>
                    <th>Medio</th>
                    <th>Estado</th>
                    <th>
                      <span className="sr-only">Acciones</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {facturas.map((f) => (
                    <tr key={f.id}>
                      <td className="font-semibold whitespace-nowrap">{etiquetaPeriodo(f.periodo)}</td>
                      <td className="whitespace-nowrap text-apagado">{fechaDeColumna(f.fechaCobro)}</td>
                      <td className="whitespace-nowrap">
                        {pesos(f.monto)}
                        <span className="block text-xs text-sutil">{nombreDePlan(f.plan)}</span>
                      </td>
                      <td className="text-apagado">{f.medio ?? "—"}</td>
                      <td>
                        <InsigniaFactura estado={f.estado} />
                        {f.estado === "pagada" && f.pagadaEn && (
                          <span className="mt-1 block text-xs text-sutil">el {fechaCorta(f.pagadaEn)}</span>
                        )}
                      </td>
                      <td className="text-right whitespace-nowrap">
                        {f.estado !== "pagada" ? (
                          <CobroPago factura={paraPago(f)} medioInicial={f.medio ?? i.medioPago} />
                        ) : (
                          <CobroAnularPago factura={paraPago(f)} />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Tabla>
            )}
          </section>
        </div>

        <aside className="flex w-[300px] max-w-full flex-none flex-col gap-4">
          <Seccion titulo="Medio de pago">
            <div className="text-sm leading-normal font-medium text-tinta">{i.medioPago ?? "Sin medio cargado"}</div>
            <div className="text-[13px] leading-normal text-apagado">
              {PLANES[plan].periodo === "año"
                ? "Pago anual por adelantado"
                : i.diaCobro
                  ? `Se cobra el día ${i.diaCobro} de cada mes`
                  : "Sin día de cobro definido"}
            </div>
          </Seccion>

          <Seccion titulo="Facturación">
            <div className="flex flex-col gap-2">
              <Dato k="Razón social">{i.nombre}</Dato>
              <Dato k="CUIT">{i.cuit ?? "—"}</Dato>
              <Dato k="Condición">{i.condicionFiscal ?? "—"}</Dato>
              <Dato k="Contacto">{i.contactoNombre ?? "—"}</Dato>
              {i.emailPropietario && <Dato k="Email">{i.emailPropietario}</Dato>}
            </div>
          </Seccion>

          <Tarjeta className="flex flex-col gap-2 p-[22px]">
            {proximo && (
              <CobroPago factura={paraPago(proximo)} medioInicial={proximo.medio ?? i.medioPago} variante="primario" tamano="md" bloque>
                {`Registrar pago de ${etiquetaPeriodo(proximo.periodo)}`}
              </CobroPago>
            )}
            <CobroNuevaFactura
              institucionId={i.id}
              plan={plan}
              diaCobro={i.diaCobro}
              medioPago={i.medioPago}
              periodoSugerido={sugerido}
            />
            <BotonWhatsapp
              href={whatsapp}
              motivoDeshabilitado={impagas.length === 0 ? "No hay cobros pendientes para recordar" : "No hay un teléfono de contacto válido cargado"}
            >
              Enviar recordatorio por WhatsApp
            </BotonWhatsapp>
            <BotonLink href={`/backoffice/cobros/${i.id}/resumen?imprimir=1`} variante="secundario" bloque>
              Descargar resumen (PDF)
            </BotonLink>
            {impagas.length > 0 && (
              <p className="m-0 mt-1 text-xs leading-normal text-sutil">
                El recordatorio abre WhatsApp con el texto escrito: lo enviás vos, no sale nada solo.
              </p>
            )}
          </Tarjeta>
        </aside>
      </div>
    </>
  );
}
