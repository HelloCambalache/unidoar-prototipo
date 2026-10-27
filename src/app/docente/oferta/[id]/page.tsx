import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FormularioPostular } from "@/components/docente/formulario-postular";
import { LogoInstitucion } from "@/components/docente/logo-institucion";
import { MapaOfertas } from "@/components/docente/mapa-ofertas";
import { Icono } from "@/components/icons";
import { Boton, BotonLink } from "@/components/ui/button";
import { BotonCompartir } from "@/components/ui/compartir";
import { Insignia } from "@/components/ui/insignia";
import { EtiquetaSeccion, Tarjeta } from "@/components/ui/tarjeta";
import type { CategoriaDocente } from "@/db/schema";
import { requerirDocente } from "@/lib/auth";
import { fechaLarga } from "@/lib/calendario";
import { CATEGORIA_INFO } from "@/lib/catalogo";
import { mensajeDeBusqueda, rutaDeOferta, urlCompleta } from "@/lib/compartir";
import { kmLegible } from "@/lib/geo";
import { esId } from "@/lib/oportunidades";
import { estadoParaDocente } from "@/lib/postulaciones";
import { detalleOferta, horarioDeBusqueda, type DetalleOferta } from "@/lib/queries/oportunidades";
import { origenSitio } from "@/lib/sitio";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Oferta de trabajo" };

/** Tarjeta blanca de la identidad nueva (radio grande, sin borde). */
const TARJETA = "rounded-panel border-0 p-6 shadow-tarjeta";

/** Panel apenas teñido por categoría del encabezado. */
const PANEL: Record<CategoriaDocente, { fondo: string; texto: string }> = {
  educador: { fondo: "bg-panel-naranja", texto: "text-naranja-texto" },
  entrenador: { fondo: "bg-panel-ambar", texto: "text-ambar-texto" },
  guardavidas: { fondo: "bg-panel-celeste", texto: "text-celeste-texto" },
};

/** Por qué no se puede postular (null si se puede). */
function motivoCierre(d: DetalleOferta) {
  if (d.abierta) return null;
  if (d.busqueda.estado === "cerrada") return "Esta búsqueda está cerrada: ya no recibe postulaciones.";
  if (d.busqueda.estado === "pausada")
    return "Esta búsqueda está pausada por la institución: por ahora no recibe postulaciones.";
  return "Esta búsqueda rápida ya venció: no recibe más respuestas.";
}

export default async function OfertaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { docente } = await requerirDocente();
  if (!esId(id)) notFound();
  const detalle = await detalleOferta(id, docente);
  if (!detalle) notFound();

  const { busqueda, institucion, postulacion } = detalle;
  const estado = postulacion ? estadoParaDocente(postulacion.etapa, busqueda.estado, postulacion.examenRealizado) : null;
  const cierre = motivoCierre(detalle);
  const km = kmLegible(detalle.km);
  const horario = horarioDeBusqueda(busqueda);
  const zona = busqueda.zona ?? institucion.zona;
  const invitada = postulacion?.origen === "invitacion";
  const panel = PANEL[busqueda.categoria];
  const { total: postulantes, recientes } = detalle.postulantes;

  const datos: [string, string | null][] = [
    ["Tipo de contrato", busqueda.tipo],
    ["Carga horaria", busqueda.cargaHoraria],
    ["Turno", busqueda.turno],
    ["Nivel", busqueda.nivel],
    ["Asignatura", busqueda.disciplina],
    ["Inicio", fechaLarga(busqueda.fechaInicio)],
  ];

  return (
    <>
      <Link
        href="/docente/oportunidades"
        className="mb-5 inline-flex min-h-10 items-center gap-1.5 self-start rounded-full bg-white pr-4 pl-3 text-sm leading-none font-semibold text-tinta shadow-tarjeta hover:text-rosa"
      >
        <Icono nombre="flecha" tamano={16} trazo={2} className="rotate-180" />
        Volver a la búsqueda
      </Link>

      <div className="flex flex-wrap items-start gap-6">
        <div className="flex min-w-[340px] flex-[2] flex-col gap-5 max-[560px]:min-w-0 max-[560px]:basis-full">
          {cierre && (
            <div role="status" className="rounded-interno bg-naranja-tint px-4 py-3 text-[13.5px] leading-normal font-medium text-naranja-ink">
              {cierre}
            </div>
          )}

          <article className="rounded-panel bg-white p-2.5 shadow-tarjeta">
            <div className={cn("flex flex-col gap-4 rounded-interno px-7 py-7 max-[560px]:px-5", panel.fondo)}>
              <div className="flex flex-wrap items-center gap-2">
                {busqueda.rapida && detalle.abierta ? (
                  <Insignia tono="naranja" className="bg-naranja text-white">
                    {detalle.responderEn ? `Rápida · responder en ${detalle.responderEn}` : "Rápida"}
                  </Insignia>
                ) : (
                  <span className={cn("text-[12px] leading-none font-semibold tracking-[0.08em] uppercase", panel.texto)}>
                    {CATEGORIA_INFO[busqueda.categoria].plural} · {busqueda.tipo}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4">
                <LogoInstitucion nombre={institucion.nombre} logoUrl={institucion.logoUrl} tamano={56} className="rounded-2xl bg-white" />
                <div className="min-w-0">
                  <h1 className="font-display m-0 text-[30px] leading-[1.15] font-semibold tracking-[-0.025em] text-tinta max-[860px]:text-[24px]">
                    {busqueda.puesto}
                  </h1>
                  <div className="mt-1 text-[15px] leading-[1.4] text-tinta-2">{institucion.nombre}</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {(zona || km || detalle.sede) && (
                  <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-linea bg-white px-3 text-[13px] text-tinta-2">
                    <Icono nombre="ubicacion" tamano={14} trazo={2} className="text-apagado" />
                    {[detalle.sede, zona, km].filter(Boolean).join(" · ")}
                  </span>
                )}
                {horario && (
                  <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-linea bg-white px-3 text-[13px] text-tinta-2">
                    <Icono nombre="reloj" tamano={14} trazo={2} className="text-apagado" />
                    {horario}
                  </span>
                )}
              </div>
            </div>
            <dl className="m-0 grid grid-cols-3 px-2 pt-3 pb-1 max-[560px]:grid-cols-2">
              {datos.map(([etiqueta, valor], i) => (
                <div key={etiqueta} className={cn("px-4 py-3", i % 3 !== 0 && "min-[561px]:border-l min-[561px]:border-linea")}>
                  <dt className="mb-1 text-[12px] leading-none text-apagado">{etiqueta}</dt>
                  <dd className="font-display m-0 text-[15px] leading-[1.3] font-semibold">{valor ?? "—"}</dd>
                </div>
              ))}
            </dl>
          </article>

          {invitada && (
            <div className="rounded-interno bg-naranja-tint px-4 py-3 text-[13.5px] leading-normal text-naranja-ink">
              {institucion.nombre} te invitó a esta búsqueda.
            </div>
          )}

          <section aria-label="Postulantes" className="flex flex-wrap items-center gap-x-8 gap-y-3 rounded-panel bg-white px-7 py-6 shadow-tarjeta">
            <div className="flex items-baseline gap-2.5">
              <span className="font-display text-[44px] leading-none font-semibold tracking-[-0.03em] text-navy-900">{postulantes}</span>
              <span className="text-[15px] text-tinta-2">
                {postulantes === 1 ? "persona se postuló" : "personas se postularon"}
              </span>
            </div>
            <div className="flex flex-1 flex-wrap items-center gap-2.5">
              {recientes > 0 && (
                <span className="inline-flex min-h-8 items-center rounded-full bg-verde-tint px-3 text-[13px] font-semibold text-verde">
                  {recientes === 1 ? "1 en los últimos 3 días" : `${recientes} en los últimos 3 días`}
                </span>
              )}
              <span className="text-[13px] text-apagado">
                {postulantes === 0 ? "Sé de las primeras personas en postularte." : "No mostramos quiénes son los otros postulantes."}
              </span>
            </div>
          </section>

          {(busqueda.descripcion || busqueda.requisitos.length > 0 || busqueda.beneficios.length > 0) && (
            <Tarjeta como="section" className={cn(TARJETA, "flex flex-col gap-5")}>
              {busqueda.descripcion && (
                <div>
                  <h2 className="font-display m-0 mb-2 text-[18px] font-semibold text-navy-900">Sobre el puesto</h2>
                  <p className="m-0 text-[15px] leading-[1.6] whitespace-pre-line text-tinta-2">{busqueda.descripcion}</p>
                </div>
              )}
              {(busqueda.requisitos.length > 0 || busqueda.beneficios.length > 0) && (
                <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4">
                  {busqueda.requisitos.length > 0 && (
                    <div className="rounded-interno bg-[#F7F6F2] px-5 py-[18px]">
                      <EtiquetaSeccion className="mb-3 text-apagado">Requisitos</EtiquetaSeccion>
                      <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
                        {busqueda.requisitos.map((r) => (
                          <ItemConTilde key={r} fondo="bg-verde-tint text-verde">
                            {r}
                          </ItemConTilde>
                        ))}
                      </ul>
                    </div>
                  )}
                  {busqueda.beneficios.length > 0 && (
                    <div className="rounded-interno bg-[#F7F6F2] px-5 py-[18px]">
                      <EtiquetaSeccion className="mb-3 text-apagado">Qué ofrece</EtiquetaSeccion>
                      <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
                        {busqueda.beneficios.map((b) => (
                          <ItemConTilde key={b} fondo="bg-rosa-tint text-rosa">
                            {b}
                          </ItemConTilde>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </Tarjeta>
          )}

          {(institucion.direccion || institucion.lat != null) && (
            <section aria-label="Ubicación" className="rounded-panel bg-white p-2.5 shadow-tarjeta">
              {institucion.lat != null && institucion.lng != null && (
                <MapaOfertas
                  compacto
                  centro={null}
                  radioKm={null}
                  pines={[
                    {
                      id: busqueda.id,
                      puesto: busqueda.puesto,
                      institucion: institucion.nombre,
                      logoUrl: institucion.logoUrl,
                      zona,
                      horario,
                      categoria: busqueda.categoria,
                      rapida: busqueda.rapida,
                      lat: institucion.lat,
                      lng: institucion.lng,
                    },
                  ]}
                />
              )}
              <div className="flex items-center gap-3.5 px-3.5 pt-4 pb-2.5">
                <span className="inline-flex size-11 flex-none items-center justify-center rounded-caja bg-rosa-tint text-rosa">
                  <Icono nombre="ubicacion" tamano={20} trazo={1.8} />
                </span>
                <span className="min-w-0 text-[13.5px] leading-[1.45] text-tinta-2">
                  {detalle.sede && <span className="block text-apagado">{detalle.sede}</span>}
                  {institucion.direccion && <b className="font-display block text-[15.5px] font-semibold text-tinta">{institucion.direccion}</b>}
                  {zona && <span className="text-apagado">{zona}</span>}
                </span>
              </div>
            </section>
          )}
        </div>

        <aside className="top-0 flex min-w-[300px] flex-1 flex-col gap-5 min-[861px]:sticky max-[560px]:min-w-0 max-[560px]:basis-full">
          <div className="rounded-panel bg-white p-6 shadow-tarjeta">
            {postulacion && estado && invitada && !cierre && postulacion.etapa !== "contratado" ? (
              // La institución la invitó pero todavía no aceptó: no puede ver su teléfono ni su email hasta que se postule.
              <div className="flex flex-col gap-3">
                <div>
                  <Insignia tono={postulacion.etapa === "nuevos" ? "naranja" : estado.tono}>
                    {postulacion.etapa === "nuevos" ? "Invitación recibida" : estado.texto}
                  </Insignia>
                </div>
                <p className="m-0 text-[13px] leading-normal text-apagado">
                  La institución te invitó y figurás en su lista de postulantes, pero todavía no ve tu teléfono ni tu email. Aceptá la
                  invitación para postularte: así puede escribirte.
                </p>
                <FormularioPostular busquedaId={busqueda.id} invitada />
                <BotonLink variante="secundario" bloque className="rounded-full" href={`/docente/postulaciones?abrir=${postulacion.id}`}>
                  Ver mis postulaciones
                </BotonLink>
              </div>
            ) : postulacion && estado ? (
              <div className="flex flex-col gap-3">
                <Boton
                  variante={estado.activa ? "exito" : "secundario"}
                  bloque
                  disabled
                  className="min-h-12 rounded-full disabled:opacity-100"
                >
                  {estado.activa && <Icono nombre="tilde" tamano={16} trazo={2.2} />}
                  {estado.texto}
                </Boton>
                <p className="m-0 text-[13px] leading-normal text-apagado">
                  {postulacion.etapa === "nuevos" && invitada
                    ? "La institución te invitó y figurás en su lista de postulantes."
                    : postulacion.etapa === "nuevos" && estado.activa
                      ? "Te avisamos por WhatsApp si te seleccionan."
                      : "Mirá el detalle y tus notas en Mis postulaciones."}
                </p>
                <BotonLink variante="secundario" bloque className="rounded-full" href={`/docente/postulaciones?abrir=${postulacion.id}`}>
                  Ver mis postulaciones
                </BotonLink>
              </div>
            ) : cierre ? (
              <Boton variante="secundario" bloque disabled className="min-h-12 rounded-full">
                Postulación cerrada
              </Boton>
            ) : (
              <FormularioPostular busquedaId={busqueda.id} />
            )}
          </div>

          {detalle.abierta && (
            <div className="rounded-panel bg-white p-6 shadow-tarjeta">
              <h2 className="font-display m-0 mb-1 text-[16px] leading-[1.3] font-semibold text-navy-900">¿Conocés a alguien a quien le sirva?</h2>
              <p className="m-0 mb-3.5 text-[13px] leading-normal text-apagado">Compartí esta búsqueda con quien pueda postularse.</p>
              <BotonCompartir
                mensaje={mensajeDeBusqueda({
                  puesto: busqueda.puesto,
                  institucion: institucion.nombre,
                  url: urlCompleta(await origenSitio(), rutaDeOferta(busqueda.id)),
                })}
                titulo="Compartir esta búsqueda"
                bajada="Quien abra el enlace ve la búsqueda sin necesidad de tener cuenta."
                className="w-full rounded-full"
              />
            </div>
          )}

          <div className="rounded-panel bg-white p-6 shadow-tarjeta">
            <div className="mb-3 flex items-center gap-3">
              <LogoInstitucion nombre={institucion.nombre} logoUrl={institucion.logoUrl} tamano={48} className="rounded-caja" />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-display text-[15.5px] leading-[1.3] font-semibold">{institucion.nombre}</span>
                  {institucion.verificada && (
                    <svg role="img" aria-label="Institución verificada" width="16" height="16" viewBox="0 0 24 24" className="flex-none">
                      <circle cx="12" cy="12" r="10" fill="#16214F" />
                      <path d="M8 12l3 3 5-6" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
                <div className="text-[12.5px] leading-[1.4] text-apagado">{institucion.tipo}</div>
              </div>
            </div>
            {institucion.descripcion && (
              <p className="m-0 mb-4 text-[13.5px] leading-normal text-tinta-2">{institucion.descripcion}</p>
            )}
            <div className="mb-2 flex justify-between px-0.5 text-[13px] leading-none font-semibold">
              <span>Búsquedas activas</span>
              <span className="text-rosa">{detalle.totalActivas}</span>
            </div>
            {detalle.otras.length > 0 && (
              <ul className="m-0 mb-4 flex list-none flex-col gap-1.5 p-0">
                {detalle.otras.map((o) => (
                  <li key={o.id}>
                    <Link
                      href={`/docente/oferta/${o.id}`}
                      className="flex min-h-11 items-center justify-between gap-2 rounded-caja bg-[#F7F6F2] px-3.5 text-[13.5px] leading-snug text-tinta hover:bg-lienzo hover:text-tinta"
                    >
                      <span className="min-w-0 truncate">{o.puesto}</span>
                      <span className="flex-none rounded-full border border-linea bg-white px-2.5 py-1 text-[11.5px] font-semibold text-tinta-2">
                        {o.rapida ? "Rápida" : o.tipo}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <BotonLink bloque className="rounded-full bg-navy-900 hover:bg-navy-700" href={`/docente/instituciones/${institucion.slug}`}>
              Ver perfil de la institución
            </BotonLink>
          </div>
        </aside>
      </div>
    </>
  );
}

function ItemConTilde({ fondo, children }: { fondo: string; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 text-[14px] leading-normal text-tinta-2">
      <span className={cn("mt-px inline-flex size-6 flex-none items-center justify-center rounded-full", fondo)}>
        <Icono nombre="tilde" tamano={13} trazo={2.6} />
      </span>
      {children}
    </li>
  );
}
