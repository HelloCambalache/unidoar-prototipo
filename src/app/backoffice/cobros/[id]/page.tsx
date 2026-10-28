import type { Metadata } from "next";
import { requerirUsuario } from "@/lib/auth";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EstadoVacio } from "@/components/app/estado-vacio";
import { CobroNuevaFactura } from "@/components/backoffice/cobro-nueva-factura";
import { CobroAnularPago } from "@/components/backoffice/cobro-anular-pago";
import { CobroPago, type FacturaParaPago } from "@/components/backoffice/cobro-pago";
import { CobroPagoEfectivo } from "@/components/backoffice/cobro-pago-efectivo";
import { CobroPuntualAnular, CobroPuntualPago } from "@/components/backoffice/cobro-puntual";
import { CobroAcuerdo } from "@/components/backoffice/cobro-acuerdo";
import { CobroSemestre } from "@/components/backoffice/cobro-semestre";
import { InsigniaCobro, InsigniaFactura } from "@/components/backoffice/inst-insignias";
import { FranjaMetricas } from "@/components/backoffice/inst-metricas";
import { VolverBo } from "@/components/backoffice/inst-volver";
import { BotonWhatsapp } from "@/components/backoffice/inst-whatsapp";
import { BotonLink } from "@/components/ui/button";
import { Insignia } from "@/components/ui/insignia";
import { Tabla } from "@/components/ui/tabla";
import { EtiquetaSeccion, Tarjeta } from "@/components/ui/tarjeta";
import { describirAcuerdo } from "@/lib/acuerdos";
import { bonificacionParaSemestre, ETIQUETA_DE_MES, resumenDeMeses } from "@/lib/bonificacion";
import { ETIQUETA_DE_CREDITO } from "@/lib/puntual";
import { esUuid } from "@/lib/busquedas";
import {
  enlaceWhatsappConTexto,
  esClavePlan,
  etiquetaDeCobertura,
  etiquetaPeriodo,
  fechaBreve,
  fechaDeColumna,
  hoyAR,
  pagoHastaDeMes,
  periodoActual,
  sumarMeses,
  textoRecordatorio,
  type EstadoCobro,
} from "@/lib/cobros";
import { suscripcionVigente } from "@/lib/debito-automatico";
import { fechaCorta, haceTiempo } from "@/lib/fechas";
import { moraDe, SIN_MORA } from "@/lib/mora";
import { pesos } from "@/lib/planes";
import { detalleDeCobros, type FacturaBo } from "@/lib/queries/backoffice-cobros";
import { acuerdoConNota } from "@/lib/queries/acuerdos";
import { mesesDe, periodosBonificadosSinCobro } from "@/lib/queries/bonificaciones";
import { formaDePagoDe } from "@/lib/queries/forma-de-pago";
import { intentosDeSemestreDe } from "@/lib/queries/pago-semestre";
import { planes } from "@/lib/queries/planes";
import { creditosDe, saldoDeBusquedas } from "@/lib/queries/puntuales";
import { cantidadDeSedes } from "@/lib/queries/sedes";
import { suscripcionDe } from "@/lib/queries/suscripcion";
import { getDb } from "@/db";

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
  const [d, P] = await Promise.all([detalleDeCobros(id), planes()]);
  if (!d) notFound();
  // Para un plan por sede (Multisede): cuántas sedes tiene, que es por lo que se multiplica el precio.
  const sedes = (await cantidadDeSedes(getDb(), [id])).get(id) ?? 1;
  // El precio acordado con la institución (abono o convenio), si lo tiene: con él se calculan los montos que se muestran y se facturan.
  const acordado = await acuerdoConNota(getDb(), id);
  const acuerdo = acordado?.acuerdo ?? null;
  // Una institución con búsqueda puntual no tiene abono ni facturas mensuales: paga cada búsqueda (ver src/lib/puntual.ts).
  const [creditos, saldo, mesesGanados, formaDePago] = await Promise.all([creditosDe(getDb(), id), saldoDeBusquedas(getDb(), id), mesesDe(id), formaDePagoDe(id)]);
  // Los meses ya bonificados por recomendar (sin cobro del débito): registrar un pago de uno de ellos pide confirmación.
  const periodosBonificados = await periodosBonificadosSinCobro(getDb(), id);
  // Con un débito automático vivo, registrar un semestre pago lo cancela (si no, Mercado Pago cobraría meses ya pagos).
  const debitoVigente = suscripcionVigente((await suscripcionDe(id))?.estado);
  // Los links de pago del semestre por Mercado Pago de esta institución (el equipo tiene que ver sobre todo los que quedaron para revisar).
  const intentosDeSemestre = await intentosDeSemestreDe(id);
  const intentosParaRevisar = intentosDeSemestre.filter((x) => x.estado === "revisar");

  const { institucion: i, facturas, proximo } = d;
  const ahora = new Date();
  const plan = esClavePlan(i.plan) ? i.plan : "colegio";
  const esPuntual = P.esPuntual(plan);
  // Un acuerdo hecho para otro plan no rige con el actual (ver `acuerdoQueRige`): se avisa para que el equipo lo vea y, si hace falta, acuerde otro.
  const acuerdoRige = acuerdo ? P.rigeElAcuerdo(plan, acuerdo) : false;
  const avisoDeAcuerdoDeOtroPlan =
    acuerdo && !acuerdoRige
      ? `Hay un precio acordado para el ${P.planDe(acuerdo.plan ?? plan).label}, que no rige con el plan actual (${P.planDe(plan).label}): paga el de lista.`
      : "";
  // Un semestre pagado al contado cubre varios meses con una sola factura: hasta cuándo, si cubre el mes en curso.
  const semestrePagoHasta = pagoHastaDeMes(periodoActual(ahora), facturas.filter((f) => f.mesesCubiertos > 1));
  // La mora (ver src/lib/mora.ts): con la factura impaga más vieja pasada de 15 días la cuenta queda limitada; las de ejemplo nunca.
  const mora = i.esDemo ? SIN_MORA : moraDe(facturas.filter((f) => f.estado !== "pagada"), hoyAR(ahora));
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
                {P.planDe(plan).label} · {P.precioDePlan(plan)}
              </div>
              {acuerdo && acuerdoRige && (
                <div className="mt-1 text-[13px] leading-[1.4] font-medium text-navy-700">
                  {acuerdo.modalidad === "total" ? "Convenio a medida" : "Precio acordado"}: {pesos(P.montoDePlan(plan, sedes, acuerdo))} por mes
                  {acuerdo.modalidad === "abono" && sedes > 1 ? ` (${sedes} sedes)` : ""}
                </div>
              )}
              {acuerdo && !acuerdoRige && (
                <div className="mt-1 text-[13px] leading-[1.4] font-medium text-naranja-ink">{avisoDeAcuerdoDeOtroPlan}</div>
              )}
              {!P.precioDefinido(plan, acuerdo) && (
                <div role="status" className="mt-1.5 max-w-[60ch] text-[13px] leading-[1.45] font-medium text-naranja-ink">
                  Plan Multisede sin convenio: no se factura, no se puede debitar y no suma al MRR hasta que lo cargues en «Precio» (Acordar un precio → convenio a medida).
                </div>
              )}
              {semestrePagoHasta && (
                <div className="mt-1 text-[13px] leading-[1.4] font-medium text-verde">
                  Semestre pago hasta {etiquetaPeriodo(semestrePagoHasta).toLowerCase()}
                </div>
              )}
              {mora.conMora && (
                <div role="status" className="mt-1.5 max-w-[60ch] text-[13px] leading-[1.45] font-medium text-[#8A1F1F]">
                  {mora.limitada
                    ? `Cuenta limitada por mora: ${mora.diasDeAtraso} días de atraso. No puede publicar búsquedas, invitar a postularse ni publicar cursos hasta que se acredite el pago (se levanta sola al registrarlo).`
                    : `Factura vencida hace ${mora.diasDeAtraso} ${mora.diasDeAtraso === 1 ? "día" : "días"}: en período de gracia hasta el ${fechaBreve(mora.ultimoDiaDeGracia!)}. Después se limita la cuenta.`}
                </div>
              )}
            </div>
            <Link href={`/backoffice/instituciones/${i.id}`} className="text-[13px] leading-none font-medium">
              Ver institución →
            </Link>
          </Tarjeta>

          {intentosParaRevisar.length > 0 && (
            <div role="status" className="rounded-caja border border-[#F2D9B3] bg-[#FEF1DF] px-[18px] py-3.5 text-[13.5px] leading-normal text-[#8A4B07]">
              <b className="font-semibold">Hay un pago de semestre por Mercado Pago para revisar:</b> la institución pagó (pago{" "}
              {intentosParaRevisar.map((x) => x.pagoId ?? "sin número").join(", ")}) y no se pudo registrar solo. Mirá el detalle en «Pagos del semestre por
              Mercado Pago», más abajo, y registrá el semestre a mano si corresponde.
            </div>
          )}

          {d.pedidosPendientes.length > 0 && (
            <div role="status" className="rounded-caja border border-[#F2D9B3] bg-[#FEF1DF] px-[18px] py-3.5 text-[13.5px] leading-normal text-[#8A4B07]">
              <b className="font-semibold">Tiene un pedido de cambio de plan sin atender:</b>{" "}
              {d.pedidosPendientes.map((p) => `pasar al ${P.nombreDePlan(p.planSolicitado)} (${haceTiempo(p.creadoEn, ahora)})`).join(", ")}.{" "}
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
              <EstadoVacio
                titulo="Todavía no tiene facturas"
                texto={esPuntual ? "Con una búsqueda puntual no hay facturas mensuales: sus pagos están en «Búsquedas puntuales»." : "Cargá la primera desde “Cargar factura”."}
              />
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
                      <td className="font-semibold">{etiquetaDeCobertura(f.periodo, f.mesesCubiertos)}</td>
                      <td className="whitespace-nowrap text-apagado">{fechaDeColumna(f.fechaCobro)}</td>
                      <td className="whitespace-nowrap">
                        {pesos(f.monto)}
                        <span className="block text-xs text-sutil">{P.nombreDePlan(f.plan)}</span>
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
              {esPuntual
                ? "Se paga cada búsqueda, por adelantado"
                : i.diaCobro
                  ? `Se cobra el día ${i.diaCobro} de cada mes`
                  : "Sin día de cobro definido"}
            </div>
          </Seccion>

          {(esPuntual || creditos.length > 0) && (
            <Seccion titulo="Búsquedas puntuales">
              <div className="flex flex-col gap-2">
                <Dato k="Pagadas y sin publicar">{saldo.disponibles}</Dato>
                <Dato k="Abiertas ahora">{saldo.abiertas}</Dato>
                <Dato k="Vigencia">{P.condiciones.puntual.vigenciaDias} días</Dato>
                {creditos.length > 0 && (
                  <ul className="m-0 mt-1 flex list-none flex-col gap-2 border-t border-linea p-0 pt-2.5">
                    {creditos.map((c) => (
                      <li key={c.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[13px] leading-[1.4]">
                        <span className="min-w-0 text-tinta">
                          <b className="font-semibold">{ETIQUETA_DE_CREDITO[c.estado]}</b> · {pesos(c.monto)} · {fechaCorta(c.pagadoEn)}
                          <span className="block text-xs text-apagado">
                            {c.medio}
                            {c.busqueda ? ` · ${c.busqueda.puesto}` : ""}
                            {c.venceEn && c.usadoEn ? ` · vence el ${fechaCorta(c.venceEn)}` : ""}
                            {c.nota ? ` · ${c.nota}` : ""}
                          </span>
                        </span>
                        {c.estado === "disponible" && <CobroPuntualAnular creditoId={c.id} monto={pesos(c.monto)} />}
                      </li>
                    ))}
                  </ul>
                )}
                {esPuntual ? (
                  <div className="mt-1.5">
                    <CobroPuntualPago
                      institucionId={i.id}
                      monto={pesos(P.montoDePlan(plan, 1, acuerdo))}
                      vigenciaDias={P.condiciones.puntual.vigenciaDias}
                    />
                  </div>
                ) : (
                  <p className="m-0 text-xs leading-normal text-sutil">Esta institución ya no tiene el plan de búsqueda puntual: no se registran pagos nuevos.</p>
                )}
              </div>
            </Seccion>
          )}

          {mesesGanados.length > 0 && (
            <Seccion titulo="Meses bonificados">
              <div className="flex flex-col gap-2">
                <Dato k="Sin usar">{resumenDeMeses(mesesGanados).disponibles}</Dato>
                <Dato k="Usados">{resumenDeMeses(mesesGanados).usados}</Dato>
                <ul className="m-0 mt-1 flex list-none flex-col gap-2 border-t border-linea p-0 pt-2.5">
                  {mesesGanados.map((m) => (
                    <li key={m.id} className="text-[13px] leading-[1.4] text-tinta">
                      <b className="font-semibold">{m.periodo ? etiquetaPeriodo(m.periodo) : "Mes sin usar"}</b> · {ETIQUETA_DE_MES[m.estado]}
                      <span className="block text-xs text-apagado">
                        {m.recomendada ? `Por recomendar a ${m.recomendada}` : "Recomendación ya borrada"}
                        {m.estado === "a-devolver" ? ` · hay que devolver ${m.monto ? pesos(m.monto) : "el cobro"} desde Mercado Pago` : ""}
                        {m.estado === "devuelto" && m.devueltoEn ? ` · devuelto el ${fechaCorta(m.devueltoEn)}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
                {resumenDeMeses(mesesGanados).aDevolver > 0 && (
                  <Link href="/backoffice/referidos?estado=devoluciones" className="text-[13px] font-semibold text-navy-700 hover:underline">
                    Ver devoluciones pendientes
                  </Link>
                )}
              </div>
            </Seccion>
          )}

          <Seccion titulo="Precio">
            {(() => {
              const { maximo } = P.rangoDeAbono(plan);
              return (
                <div className="flex flex-col gap-2">
                  <Dato k="De lista">{pesos(maximo)} por mes</Dato>
                  <Dato k="Acordado">{acuerdo && acuerdoRige ? describirAcuerdo(acuerdo) : "Paga el de lista"}</Dato>
                  {acuerdo && !acuerdoRige && (
                    <p className="m-0 text-[13px] leading-[1.45] text-naranja-ink">
                      {avisoDeAcuerdoDeOtroPlan} Si querés volver a acordar un precio con este plan, usá «Acordar un precio».
                    </p>
                  )}
                  {acordado?.nota && <Dato k="Nota">{acordado.nota}</Dato>}
                  {sedes > 1 && <Dato k="Sedes">{sedes}</Dato>}
                  <div className="mt-1.5">
                    <CobroAcuerdo institucionId={i.id} catalogo={P.catalogo} plan={plan} sedes={sedes} acuerdo={acuerdoRige ? acuerdo : null} nota={acordado?.nota ?? null} />
                  </div>
                </div>
              );
            })()}
          </Seccion>

          {intentosDeSemestre.length > 0 && (
            <Seccion titulo="Pagos del semestre por Mercado Pago">
              <ul className="m-0 flex list-none flex-col gap-3 p-0">
                {intentosDeSemestre.map((x) => (
                  <li key={x.id} className="flex flex-col gap-1 text-[13px] leading-[1.4]">
                    <div className="flex flex-wrap items-center gap-2">
                      <Insignia tono={x.estado === "pagado" ? "verde" : x.estado === "revisar" ? "naranja" : "azul"}>
                        {x.estado === "pagado" ? "Pagado" : x.estado === "revisar" ? "Para revisar" : "Link sin pagar"}
                      </Insignia>
                      <span className="font-semibold text-tinta">{pesos(x.monto)}</span>
                      <span className="text-apagado">{haceTiempo(x.creadoEn, ahora)}</span>
                    </div>
                    <div className="text-apagado">
                      {etiquetaDeCobertura(x.periodo, x.meses)} · se pagan {x.mesesAPagar} meses{x.usaMesBonificado ? " (con un mes bonificado)" : ""}
                    </div>
                    {x.pagoId && <div className="text-apagado">Pago de Mercado Pago: {x.pagoId}</div>}
                  </li>
                ))}
              </ul>
            </Seccion>
          )}

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
            {!esPuntual && (
              <CobroPagoEfectivo
                institucionId={i.id}
                sedes={sedes}
                acuerdo={acuerdo}
                catalogo={P.catalogo}
                plan={plan}
                periodoSugerido={impagas[0]?.periodo ?? sugerido}
                facturas={facturas.map((f) => ({ periodo: f.periodo, pagada: f.estado === "pagada", monto: f.monto }))}
                periodosBonificados={periodosBonificados}
              />
            )}
            {formaDePago === "semestral" && P.planDe(plan).periodo === "mes" && (
              <p className="m-0 rounded-caja bg-verde-tint px-3.5 py-2.5 text-[13px] leading-normal text-verde">
                Esta institución eligió pagar por semestre: coordiná el pago y registralo con «Registrar semestre al contado».
              </p>
            )}
            {P.planDe(plan).periodo === "mes" && (
              <CobroSemestre
                institucionId={i.id}
                sedes={sedes}
                acuerdo={acuerdo}
                catalogo={P.catalogo}
                plan={plan}
                periodoSugerido={impagas[0]?.periodo ?? sugerido}
                facturas={facturas.map((f) => ({ periodo: f.periodo, estado: f.estado, mesesCubiertos: f.mesesCubiertos }))}
                debitoVigente={debitoVigente}
                periodosBonificados={periodosBonificados}
                bonificacion={bonificacionParaSemestre(mesesGanados)}
              />
            )}
            {!esPuntual && (
              <CobroNuevaFactura
                institucionId={i.id}
                sedes={sedes}
                acuerdo={acuerdo}
                catalogo={P.catalogo}
                plan={plan}
                diaCobro={i.diaCobro}
                medioPago={i.medioPago}
                periodoSugerido={sugerido}
              />
            )}
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
