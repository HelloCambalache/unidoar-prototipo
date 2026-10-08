import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FormularioPostular } from "@/components/docente/formulario-postular";
import { LogoInstitucion } from "@/components/docente/logo-institucion";
import { MapaOfertas } from "@/components/docente/mapa-ofertas";
import { Icono } from "@/components/icons";
import { Boton, BotonLink } from "@/components/ui/button";
import { Insignia } from "@/components/ui/insignia";
import { EtiquetaSeccion, Tarjeta } from "@/components/ui/tarjeta";
import { requerirDocente } from "@/lib/auth";
import { fechaLarga } from "@/lib/calendario";
import { kmLegible } from "@/lib/geo";
import { esId } from "@/lib/oportunidades";
import { estadoParaDocente } from "@/lib/postulaciones";
import { detalleOferta, horarioDeBusqueda, type DetalleOferta } from "@/lib/queries/oportunidades";

export const metadata: Metadata = { title: "Oferta de trabajo" };

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
        className="mb-[18px] inline-flex items-center gap-1 text-[13px] leading-none font-medium text-sutil hover:text-tinta"
      >
        <span aria-hidden>‹</span> Volver a la búsqueda
      </Link>

      <div className="flex flex-wrap items-start gap-7">
        <div className="min-w-[340px] flex-[2] max-[560px]:min-w-0 max-[560px]:basis-full">
          {cierre && (
            <div role="status" className="mb-4 rounded-lg bg-[#FDE9D8] p-3 text-[13px] leading-normal font-medium text-[#7A4A12]">
              {cierre}
            </div>
          )}

          <Tarjeta className="mb-4">
            {busqueda.rapida && detalle.abierta && (
              <Insignia tono="naranja" className="mb-3">
                {detalle.responderEn ? `Rápida · responder en ${detalle.responderEn}` : "Rápida"}
              </Insignia>
            )}
            <div className="mb-[18px] flex items-center gap-3.5">
              <LogoInstitucion nombre={institucion.nombre} logoUrl={institucion.logoUrl} tamano={52} className="rounded-[10px]" />
              <div className="min-w-0">
                <h1 className="m-0 text-2xl leading-[1.25] font-semibold max-[860px]:text-[22px]">{busqueda.puesto}</h1>
                <div className="text-sm leading-[1.4] text-apagado">{institucion.nombre}</div>
              </div>
            </div>
            <div className="flex flex-wrap gap-x-[18px] gap-y-2 text-[13px] leading-[1.4] text-tinta-2">
              {(zona || km) && (
                <span className="flex items-center gap-2">
                  <Icono nombre="ubicacion" tamano={14} trazo={2} className="text-apagado" />
                  {[zona, km].filter(Boolean).join(" · ")}
                </span>
              )}
              {horario && (
                <span className="flex items-center gap-2">
                  <Icono nombre="reloj" tamano={14} trazo={2} className="text-apagado" />
                  {horario}
                </span>
              )}
            </div>
          </Tarjeta>

          {invitada && (
            <div className="mb-4 rounded-lg bg-[#FDE9D8] p-3 text-[13px] leading-normal text-[#7A4A12]">
              {institucion.nombre} te invitó a esta búsqueda.
            </div>
          )}

          <dl className="m-0 mb-4 grid grid-cols-3 gap-px overflow-hidden rounded-ud border border-borde bg-borde max-[560px]:grid-cols-2">
            {datos.map(([etiqueta, valor]) => (
              <div key={etiqueta} className="bg-white px-[18px] py-4">
                <dt className="mb-1.5 text-[11px] leading-none font-semibold tracking-[.06em] text-sutil uppercase">{etiqueta}</dt>
                <dd className="m-0 text-sm leading-[1.3] font-semibold">{valor ?? "—"}</dd>
              </div>
            ))}
          </dl>

          {busqueda.descripcion && (
            <Tarjeta como="section" className="mb-4">
              <EtiquetaSeccion>Descripción del puesto</EtiquetaSeccion>
              <p className="m-0 text-sm leading-[1.6] whitespace-pre-line text-tinta-2">{busqueda.descripcion}</p>
            </Tarjeta>
          )}

          {busqueda.requisitos.length > 0 && (
            <Tarjeta como="section" className="mb-4">
              <EtiquetaSeccion>Requisitos</EtiquetaSeccion>
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {busqueda.requisitos.map((r) => (
                  <ItemConTilde key={r} color="text-verde">
                    {r}
                  </ItemConTilde>
                ))}
              </ul>
            </Tarjeta>
          )}

          {busqueda.beneficios.length > 0 && (
            <Tarjeta como="section" className="mb-4">
              <EtiquetaSeccion>Qué ofrece</EtiquetaSeccion>
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {busqueda.beneficios.map((b) => (
                  <ItemConTilde key={b} color="text-navy-700">
                    {b}
                  </ItemConTilde>
                ))}
              </ul>
            </Tarjeta>
          )}

          {(institucion.direccion || institucion.lat != null) && (
            <Tarjeta como="section">
              <EtiquetaSeccion className="mb-3">Ubicación</EtiquetaSeccion>
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
              <div className="mt-2.5 flex items-start gap-[7px] text-[13px] leading-[1.45] text-tinta-2">
                <Icono nombre="ubicacion" tamano={14} trazo={1.8} className="mt-0.5 text-sutil" />
                <span>
                  {institucion.direccion && <b className="font-semibold">{institucion.direccion}</b>}
                  {institucion.direccion && zona && <br />}
                  {zona && <span className="text-apagado">{zona}</span>}
                </span>
              </div>
            </Tarjeta>
          )}
        </div>

        <aside className="top-0 min-w-[300px] flex-1 min-[861px]:sticky max-[560px]:min-w-0 max-[560px]:basis-full">
          <Tarjeta className="mb-4">
            <EtiquetaSeccion className="mb-3.5">Sobre la institución</EtiquetaSeccion>
            <div className="mb-2 flex items-center gap-2">
              <span className="text-[15px] leading-[1.3] font-semibold">{institucion.nombre}</span>
              {institucion.verificada && (
                <svg role="img" aria-label="Institución verificada" width="15" height="15" viewBox="0 0 24 24" fill="#16214F" stroke="#fff" strokeWidth="1.5" className="flex-none">
                  <path d="M12 2l2.4 1.7 2.9-.2 1 2.7 2.5 1.5-.6 2.9.6 2.9-2.5 1.5-1 2.7-2.9-.2L12 22l-2.4-1.7-2.9.2-1-2.7-2.5-1.5.6-2.9-.6-2.9 2.5-1.5 1-2.7 2.9.2z" />
                  <path d="M9 12l2 2 4-4" stroke="#fff" fill="none" />
                </svg>
              )}
            </div>
            <div className="mb-3 text-xs leading-[1.4] text-apagado">{institucion.tipo}</div>
            {institucion.descripcion && (
              <p className="m-0 mb-3.5 text-[13px] leading-normal text-tinta-2">{institucion.descripcion}</p>
            )}
            <div className="mb-3 flex justify-between border-t border-borde pt-3 text-[13px] leading-none">
              <span className="text-apagado">Búsquedas activas</span>
              <span className="font-semibold">{detalle.totalActivas}</span>
            </div>
            {detalle.otras.length > 0 && (
              <ul className="m-0 mb-3 flex list-none flex-col gap-1.5 p-0">
                {detalle.otras.map((o) => (
                  <li key={o.id}>
                    <Link
                      href={`/docente/oferta/${o.id}`}
                      className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-[13px] leading-snug text-tinta-2 hover:bg-superficie hover:text-tinta"
                    >
                      <span className="min-w-0 truncate">{o.puesto}</span>
                      <span className="flex-none text-xs text-sutil">{o.rapida ? "Rápida" : o.tipo}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <BotonLink variante="secundario" bloque href={`/docente/instituciones/${institucion.slug}`}>
              Ver perfil
            </BotonLink>
          </Tarjeta>

          {postulacion && estado ? (
            <div className="flex flex-col gap-3">
              <Boton variante={estado.activa ? "exito" : "secundario"} bloque disabled className="min-h-12 disabled:opacity-100">
                {estado.activa && <Icono nombre="tilde" tamano={16} trazo={2.2} />}
                {estado.texto}
              </Boton>
              <p className="m-0 text-[13px] leading-normal text-apagado">
                {postulacion.etapa === "nuevos" && invitada
                  ? "La institución te invitó y ya figurás en su lista de postulantes. Si avanza, te escribe por WhatsApp."
                  : postulacion.etapa === "nuevos" && estado.activa
                    ? "Te avisamos por WhatsApp si te seleccionan."
                    : "Mirá el detalle y tus notas en Mis postulaciones."}
              </p>
              <BotonLink variante="secundario" bloque href={`/docente/postulaciones?abrir=${postulacion.id}`}>
                Ver mis postulaciones
              </BotonLink>
            </div>
          ) : cierre ? (
            <Boton variante="secundario" bloque disabled className="min-h-12">
              Postulación cerrada
            </Boton>
          ) : (
            <FormularioPostular busquedaId={busqueda.id} />
          )}
        </aside>
      </div>
    </>
  );
}

function ItemConTilde({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-[13px] leading-normal text-tinta-2">
      <Icono nombre="tilde" tamano={14} trazo={2.4} className={`mt-0.5 ${color}`} />
      {children}
    </li>
  );
}
