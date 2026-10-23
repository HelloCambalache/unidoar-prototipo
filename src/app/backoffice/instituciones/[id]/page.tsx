import type { Metadata } from "next";
import { requerirUsuario } from "@/lib/auth";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EstadoVacio } from "@/components/app/estado-vacio";
import { InstAcciones } from "@/components/backoffice/inst-acciones";
import { InstDebito } from "@/components/backoffice/inst-debito";
import { InstProcesarBaja } from "@/components/backoffice/inst-procesar-baja";
import { InsigniaCuenta, InsigniaFactura, InsigniaVerificada } from "@/components/backoffice/inst-insignias";
import { FranjaMetricas } from "@/components/backoffice/inst-metricas";
import { InstPlan } from "@/components/backoffice/inst-plan";
import { RegistrarPagos } from "@/components/backoffice/registrar-pagos";
import { VolverBo } from "@/components/backoffice/inst-volver";
import { LogoInstitucion } from "@/components/docente/logo-institucion";
import { BotonLink } from "@/components/ui/button";
import { Insignia } from "@/components/ui/insignia";
import { Tabla } from "@/components/ui/tabla";
import { EtiquetaSeccion, Tarjeta } from "@/components/ui/tarjeta";
import { describirAccion, ROL_MIEMBRO } from "@/lib/backoffice-instituciones";
import { esUuid } from "@/lib/busquedas";
import { suscripcionVigente } from "@/lib/debito-automatico";
import { debitoParaBackoffice } from "@/lib/queries/suscripcion-backoffice";
import {
  enlaceWhatsappConTexto,
  esClavePlan,
  etiquetaPeriodo,
  fechaDeColumna,
} from "@/lib/cobros";
import { fechaCorta, haceTiempo } from "@/lib/fechas";
import { fechaHoraCorta } from "@/lib/calendario";
import { pesos } from "@/lib/planes";
import { resumenParaBajaDeInstitucion } from "@/lib/queries/baja-institucion";
import { fichaInstitucion } from "@/lib/queries/backoffice-instituciones";
import { planes } from "@/lib/queries/planes";

export const metadata: Metadata = { title: "Institución · Backoffice" };
export const dynamic = "force-dynamic";

const ESTADO_BUSQUEDA = { activa: "Activa", pausada: "Pausada", cerrada: "Cerrada" } as const;

function Seccion({ titulo, children, className }: { titulo: string; children: React.ReactNode; className?: string }) {
  return (
    <Tarjeta className={className ?? "p-[22px]"}>
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

export default async function FichaInstitucion({ params }: { params: Promise<{ id: string }> }) {
  // El layout ya lo exige, pero acá se leen datos sensibles: se vuelve a verificar en cada página.
  await requerirUsuario("admin");
  const { id } = await params;
  if (!esUuid(id)) notFound();
  const [ficha, P] = await Promise.all([fichaInstitucion(id), planes()]);
  if (!ficha) notFound();

  const { institucion: i, proximoCobro } = ficha;
  const deBaja = i.bajaEn !== null;
  // Lo que se llevaría la baja (para el diálogo): solo si se puede procesar, o sea no es de ejemplo ni ya está dada de baja.
  const resumenDeBaja = !deBaja && !i.esDemo ? await resumenParaBajaDeInstitucion(i.id) : null;
  // El débito automático: se muestra en la ficha y, si está vivo (pendiente, activo o en pausa), el diálogo de suspender ofrece cancelarlo.
  const debito = await debitoParaBackoffice(i.id);
  const debitoVigente = !deBaja && suscripcionVigente(debito.suscripcion?.estado);
  const ahora = new Date();
  const plan = esClavePlan(i.plan) ? i.plan : "colegio";
  const contacto = [i.contactoNombre, i.contactoRol].filter(Boolean).join(" · ");
  const direccion = [i.direccion, i.partido, i.provincia].filter(Boolean).join(", ");
  const whatsapp = enlaceWhatsappConTexto(
    i.telefono,
    `Hola${i.contactoNombre ? ` ${i.contactoNombre.split(" ")[0]}` : ""}, te escribimos del equipo de UNIDOAR por ${i.nombre}.`,
  );
  const proximoTexto = proximoCobro
    ? `${proximoCobro.estado === "vencida" ? "Cobro vencido" : "Próximo cobro"}: ${etiquetaPeriodo(proximoCobro.periodo)} · vence el ${fechaDeColumna(proximoCobro.fechaCobro)} · ${pesos(proximoCobro.monto)}`
    : "Sin cobros pendientes";

  return (
    <>
      <VolverBo href="/backoffice/instituciones" etiqueta="Instituciones" />
      <div className="flex flex-wrap items-start gap-5">
        <div className="flex min-w-[320px] flex-1 flex-col gap-4">
          <Tarjeta className="flex flex-wrap items-center gap-[18px] p-[22px]">
            <LogoInstitucion nombre={i.nombre} logoUrl={i.logoUrl} tamano={64} className="rounded-xl" />
            <div className="min-w-[200px] flex-1">
              <div className="mb-1.5 flex flex-wrap items-center gap-2.5">
                <h1 className="m-0 text-[22px] leading-[1.2] font-semibold tracking-[-0.015em]">{i.nombre}</h1>
                <InsigniaCuenta suspendida={i.suspendida} baja={deBaja} />
                <InsigniaVerificada verificada={i.verificada} />
                {ficha.bajaSolicitadaEn && !deBaja && <Insignia tono="ambar">Baja solicitada</Insignia>}
              </div>
              <div className="text-sm leading-[1.4] text-apagado">{[i.tipo, i.zona].filter(Boolean).join(" · ")}</div>
              <Link href={`/instituciones/${i.slug}`} className="mt-1.5 inline-block text-[13px] font-medium">
                Ver vitrina pública →
              </Link>
            </div>
            {!deBaja && (
              <BotonLink href={`/backoffice/instituciones/${i.id}/editar`} variante="secundario" tamano="sm">
                Editar perfil
              </BotonLink>
            )}
          </Tarjeta>

          {deBaja && i.bajaEn && (
            <div role="status" className="rounded-caja border border-borde bg-[#F1F0EC] px-[18px] py-3.5 text-[13.5px] leading-normal text-tinta-2">
              <b className="font-semibold">Dada de baja el {fechaCorta(i.bajaEn)}.</b> Se borraron su equipo, sus búsquedas, los cursos, los
              contactos y el perfil público. Queda solo el registro fiscal (nombre, CUIT, domicilio) y las facturas, que se conservan por
              obligación legal. No se puede reactivar: si vuelve, se crea una cuenta nueva.
            </div>
          )}

          {i.suspendida && !deBaja && (
            <div role="status" className="rounded-caja border border-[#EBCFC5] bg-[#F6E6E0] px-[18px] py-3.5 text-[13.5px] leading-normal text-[#8F3D28]">
              <b className="font-semibold">Cuenta suspendida.</b>{" "}
              {ficha.motivoSuspension ? (
                <>
                  Motivo: {ficha.motivoSuspension.motivo.toLowerCase()}
                  {ficha.motivoSuspension.nota && <> · Nota interna: {ficha.motivoSuspension.nota}</>} (
                  {fechaHoraCorta(ficha.motivoSuspension.cuando)}).
                </>
              ) : (
                "No hay un motivo registrado."
              )}{" "}
              Nadie de su equipo puede entrar a su área.
            </div>
          )}

          {ficha.bajaSolicitadaEn && !deBaja && (
            <div role="status" className="rounded-caja border border-[#EBD9A8] bg-[#FBF2D8] px-[18px] py-3.5 text-[13.5px] leading-normal text-[#7A5A0B]">
              <b className="font-semibold">Pidió la baja de la cuenta</b> el {fechaCorta(ficha.bajaSolicitadaEn)}.{" "}
              {ficha.emailPropietario ? <>Hay que escribirle a {ficha.emailPropietario} para confirmarla, </> : <>Hay que contactarla para confirmarla, </>}
              cancelar la suscripción y despublicar sus búsquedas. Hasta entonces la cuenta sigue funcionando igual.
            </div>
          )}

          <FranjaMetricas
            items={[
              { valor: ficha.busquedasActivas, etiqueta: "Búsquedas activas" },
              { valor: ficha.postulaciones, etiqueta: "Postulaciones" },
              { valor: ficha.contrataciones, etiqueta: "Contrataciones" },
              { valor: P.precioDePlan(plan), etiqueta: "Suscripción" },
            ]}
          />

          {!deBaja && (
            <Tarjeta className="p-[22px]">
              <InstPlan institucionId={i.id} nombre={i.nombre} catalogo={P.catalogo} plan={plan} proximoCobro={proximoTexto} />
            </Tarjeta>
          )}

          {!deBaja && <RegistrarPagos institucionId={i.id} plan={plan} P={P} debitoVigente={debitoVigente} />}

          <section aria-labelledby="busquedas-titulo">
            <EtiquetaSeccion className="mb-3" id="busquedas-titulo">
              Búsquedas
            </EtiquetaSeccion>
            {ficha.busquedas.length === 0 ? (
              <EstadoVacio titulo="Todavía no publicó búsquedas" />
            ) : (
              <Tabla>
                <thead>
                  <tr>
                    <th>Puesto</th>
                    <th>Tipo</th>
                    <th>Postulantes</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {ficha.busquedas.map((b) => (
                    <tr key={b.id}>
                      <td className="font-semibold">{b.puesto}</td>
                      <td>{b.rapida ? "Suplencia rápida" : b.tipo}</td>
                      <td>{b.postulantes}</td>
                      <td>
                        <Insignia>{ESTADO_BUSQUEDA[b.estado]}</Insignia>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Tabla>
            )}
            {ficha.busquedasTotal > ficha.busquedas.length && (
              <p className="mt-2 mb-0 text-xs text-sutil">Se muestran las últimas {ficha.busquedas.length}.</p>
            )}
          </section>

          <section aria-labelledby="cobros-titulo">
            <div className="mb-3 flex items-center justify-between gap-3">
              <EtiquetaSeccion className="mb-0" id="cobros-titulo">
                Historial de cobros
              </EtiquetaSeccion>
              <Link href={`/backoffice/cobros/${i.id}`} className="text-[13px] leading-none font-medium">
                Ver cobros →
              </Link>
            </div>
            {ficha.facturas.length === 0 ? (
              <EstadoVacio titulo="Todavía no tiene facturas" texto="Se cargan desde Cobros." />
            ) : (
              <Tabla>
                <thead>
                  <tr>
                    <th>Período</th>
                    <th>Monto</th>
                    <th>Vence / venció</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {ficha.facturas.slice(0, 6).map((f) => (
                    <tr key={f.id}>
                      <td className="font-semibold">{etiquetaPeriodo(f.periodo)}</td>
                      <td>{pesos(f.monto)}</td>
                      <td className="text-apagado">{fechaDeColumna(f.fechaCobro)}</td>
                      <td>
                        <InsigniaFactura estado={f.estado} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Tabla>
            )}
          </section>

          {ficha.actividad.length > 0 && (
            <Seccion titulo="Actividad del equipo">
              <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
                {ficha.actividad.map((a) => (
                  <li key={a.id} className="text-[13px] leading-[1.4] text-tinta-2">
                    {describirAccion(a.accion, a.detalle, P)}
                    <span className="block text-xs text-sutil">
                      {haceTiempo(a.cuando, ahora)}
                      {a.quien ? ` · ${a.quien}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </Seccion>
          )}
        </div>

        <aside className="flex w-[300px] max-w-full flex-none flex-col gap-4">
          <Seccion titulo="Contacto">
            {deBaja ? (
              <div className="text-[13px] leading-[1.4] text-apagado">Se borró con la baja.</div>
            ) : (
              <div className="flex flex-col gap-1 text-sm leading-[1.6] text-tinta-2">
                {contacto ? <span>{contacto}</span> : <span className="text-sutil">Sin persona de contacto cargada</span>}
                {i.telefono && <span>{i.telefono}</span>}
                {ficha.emailPropietario ? (
                  <a href={`mailto:${ficha.emailPropietario}`} className="[overflow-wrap:anywhere]">
                    {ficha.emailPropietario}
                  </a>
                ) : (
                  <span className="text-sutil">Sin cuenta de acceso vinculada</span>
                )}
              </div>
            )}
          </Seccion>

          {ficha.sedes.length > 1 && (
            <Seccion titulo={`Sedes (${ficha.sedes.length})`}>
              <ul className="m-0 flex list-none flex-col gap-2.5 p-0 text-[13px] leading-[1.4] text-tinta-2">
                {ficha.sedes.map((s) => (
                  <li key={s.id}>
                    <div className="font-semibold text-tinta">
                      {s.nombre}
                      {s.esPrincipal && <span className="ml-1.5 font-normal text-apagado">· principal</span>}
                    </div>
                    <div className="text-apagado">{[s.direccion, s.zona].filter(Boolean).join(" · ") || "Sin dirección"}</div>
                    {s.cue && <div className="text-apagado">{`CUE ${s.cue}`}</div>}
                  </li>
                ))}
              </ul>
            </Seccion>
          )}

          <Seccion titulo="Datos">
            <div className="flex flex-col gap-2">
              <Dato k="Tipo">{i.tipo}</Dato>
              {direccion && <Dato k="Dirección">{direccion}</Dato>}
              <Dato k="CUIT">{i.cuit ?? "—"}</Dato>
              {i.cue && <Dato k="CUE">{i.cue}</Dato>}
              {i.fundada && <Dato k="Fundada">{i.fundada}</Dato>}
              <Dato k="Alta en UNIDOAR">{fechaCorta(i.creadoEn)}</Dato>
              {i.bajaEn && <Dato k="Baja procesada">{fechaCorta(i.bajaEn)}</Dato>}
            </div>
          </Seccion>

          <Seccion titulo="Próximo cobro">
            {proximoCobro ? (
              <div className="flex flex-col gap-1.5 text-sm leading-[1.5] text-tinta-2">
                <span>
                  {etiquetaPeriodo(proximoCobro.periodo)} · {pesos(proximoCobro.monto)}
                </span>
                <span className="text-[13px] text-apagado">
                  {proximoCobro.estado === "vencida" ? "Venció" : "Vence"} el {fechaDeColumna(proximoCobro.fechaCobro)}
                </span>
                <span>
                  <InsigniaFactura estado={proximoCobro.estado} />
                </span>
              </div>
            ) : (
              <div className="text-sm leading-[1.6] text-apagado">No tiene cobros pendientes.</div>
            )}
          </Seccion>

          <InstDebito debito={debito} />

          <Seccion titulo="Equipo">
            {ficha.equipo.length === 0 ? (
              <div className="text-[13px] leading-[1.4] text-apagado">Todavía no sumó a nadie al equipo.</div>
            ) : (
              <ul className="m-0 flex list-none flex-col gap-2 p-0 text-[13px] leading-[1.4] text-tinta-2">
                {ficha.equipo.map((m) => (
                  <li key={m.id} className="flex justify-between gap-2.5">
                    <span className="min-w-0 [overflow-wrap:anywhere]">{m.nombre ?? m.email}</span>
                    <span className="flex-none text-right text-apagado">
                      {ROL_MIEMBRO[m.rol] ?? m.rol}
                      {m.estado !== "activo" && " · invitación pendiente"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Seccion>

          {!deBaja && (
            <Tarjeta className="flex flex-col gap-3 p-[22px]">
              <InstAcciones
                institucionId={i.id}
                nombre={i.nombre}
                verificada={i.verificada}
                suspendida={i.suspendida}
                debitoVigente={debitoVigente}
                enlaceWhatsapp={whatsapp}
              />
              {resumenDeBaja && (
                <InstProcesarBaja
                  institucionId={i.id}
                  nombre={i.nombre}
                  resumen={resumenDeBaja}
                  pidioLaBaja={Boolean(ficha.bajaSolicitadaEn)}
                />
              )}
            </Tarjeta>
          )}
        </aside>
      </div>
    </>
  );
}
