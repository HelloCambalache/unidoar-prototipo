import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Icono } from "@/components/icons";
import { LogoInstitucion } from "@/components/publico/logo-institucion";
import { sesionPublica } from "@/components/publico/sesion";
import { BotonLink } from "@/components/ui/button";
import { BotonCompartir } from "@/components/ui/compartir";
import { Insignia } from "@/components/ui/insignia";
import { EtiquetaSeccion, Tarjeta } from "@/components/ui/tarjeta";
import { esUuid } from "@/lib/busquedas";
import { fechaLarga } from "@/lib/calendario";
import { CATEGORIA_INFO } from "@/lib/catalogo";
import { mensajeDeBusqueda, resumenDeBusqueda, rutaDeInstitucion, rutaDeOferta, urlCompleta } from "@/lib/compartir";
import { RUTA_REGISTRO_DOCENTE } from "@/lib/publico";
import { ofertaPublica } from "@/lib/queries/publico";
import { origenSitio } from "@/lib/sitio";

// Consulta la base en cada request y depende de la sesión (el botón de postularse): no se prerenderiza.
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

const MOTIVO_DE_CIERRE = {
  cerrada: "La institución ya cerró esta búsqueda: no recibe más postulaciones.",
  pausada: "La institución pausó esta búsqueda: por ahora no recibe postulaciones.",
  vencida: "Esta búsqueda urgente ya venció: no recibe más respuestas.",
} as const;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const oferta = esUuid(id) ? await ofertaPublica(id) : null;
  if (!oferta) return { title: "Búsqueda no encontrada" };
  const titulo = `${oferta.puesto} · ${oferta.institucion.nombre}`;
  // Es lo que se ve en la vista previa del enlace (WhatsApp, redes, mail): la primera frase de la descripción o, si ya no está abierta, que cerró.
  const descripcion = oferta.abierta
    ? resumenDeBusqueda({ descripcion: oferta.descripcion, tipo: oferta.tipo, zona: oferta.zona, institucion: oferta.institucion.nombre })
    : "Esta búsqueda ya no está abierta.";
  return { title: titulo, description: descripcion, openGraph: { title: titulo, description: descripcion, type: "article" } };
}

export default async function OfertaCompartida({ params }: Props) {
  const { id } = await params;
  if (!esUuid(id)) notFound();
  const [oferta, sesion, origen] = await Promise.all([ofertaPublica(id), sesionPublica(), origenSitio()]);
  if (!oferta) notFound();

  const { institucion: inst } = oferta;
  const url = urlCompleta(origen, rutaDeOferta(oferta.id));
  const mensaje = mensajeDeBusqueda({ puesto: oferta.puesto, institucion: inst.nombre, url });
  const horario = oferta.horario ?? ([oferta.turno, oferta.cargaHoraria].filter(Boolean).join(" · ") || null);
  const lugar = [oferta.sede, oferta.zona].filter(Boolean).join(" · ");

  const datos: [string, string | null][] = [
    ["Tipo de contrato", oferta.tipo],
    ["Carga horaria", oferta.cargaHoraria],
    ["Turno", oferta.turno],
    ["Nivel", oferta.nivel],
    ["Asignatura", oferta.disciplina],
    ["Inicio", fechaLarga(oferta.fechaInicio)],
  ];

  return (
    <div className="flex-1 bg-app px-12 py-9 max-[860px]:px-4 max-[860px]:py-5">
      <div className="mx-auto w-full max-w-[1100px]">
        <Link
          href="/buscar-trabajo"
          className="mb-[18px] inline-flex items-center gap-1 text-[13px] leading-none font-medium text-sutil hover:text-tinta focus-visible:text-tinta"
        >
          ‹ Buscar trabajo
        </Link>

        <div className="flex flex-wrap items-start gap-7">
          <div className="min-w-0 flex-[2_1_340px]">
            <Tarjeta className="mb-4 p-6 max-[560px]:p-4">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                {oferta.rapida && oferta.abierta ? (
                  <Insignia tono="rosa" punto>
                    Urgente
                  </Insignia>
                ) : (
                  <span className="text-xs leading-none font-semibold tracking-[0.08em] text-apagado uppercase">
                    {CATEGORIA_INFO[oferta.categoria].plural} · {oferta.tipo}
                  </span>
                )}
                {!oferta.abierta && <Insignia tono="ambar">Ya no está abierta</Insignia>}
              </div>
              <div className="flex items-center gap-4">
                <LogoInstitucion nombre={inst.nombre} logoUrl={inst.logoUrl} tamano={56} className="rounded-2xl bg-navy-50" />
                <div className="min-w-0">
                  <h1 className="m-0 text-[26px] leading-[1.2] font-semibold tracking-[-0.02em] text-tinta max-[560px]:text-[22px]">{oferta.puesto}</h1>
                  <Link href={rutaDeInstitucion(inst.slug)} className="mt-1 inline-block text-[15px] leading-[1.4] text-tinta-2 hover:text-navy-700 hover:underline">
                    {inst.nombre}
                  </Link>
                </div>
              </div>
              {oferta.abierta && (lugar || horario) && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {lugar && (
                    <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-linea bg-white px-3 text-[13px] text-tinta-2">
                      <Icono nombre="ubicacion" tamano={14} trazo={2} className="text-apagado" />
                      {lugar}
                    </span>
                  )}
                  {horario && (
                    <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-linea bg-white px-3 text-[13px] text-tinta-2">
                      <Icono nombre="reloj" tamano={14} trazo={2} className="text-apagado" />
                      {horario}
                    </span>
                  )}
                  {oferta.venceEn && (
                    <span className="inline-flex min-h-8 items-center rounded-full bg-naranja-tint px-3 text-[13px] font-semibold text-naranja-ink">
                      Acepta respuestas hasta el {fechaLarga(oferta.venceEn)}
                    </span>
                  )}
                </div>
              )}
            </Tarjeta>

            {!oferta.abierta && oferta.cierre ? (
              <Tarjeta como="section" className="mb-4 p-6">
                <h2 className="m-0 mb-1.5 text-lg leading-[1.3] font-semibold text-tinta">Esta búsqueda ya no está abierta</h2>
                <p className="m-0 mb-4 text-sm leading-normal text-apagado">{MOTIVO_DE_CIERRE[oferta.cierre]} Mirá las que siguen abiertas.</p>
                <div className="flex flex-wrap gap-2.5">
                  <BotonLink href="/buscar-trabajo" variante="primario">
                    Ver búsquedas abiertas
                  </BotonLink>
                  <BotonLink href={rutaDeInstitucion(inst.slug)} variante="secundario">
                    Ver perfil de la institución
                  </BotonLink>
                </div>
              </Tarjeta>
            ) : (
              <>
                <dl className="m-0 mb-4 grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-px overflow-hidden rounded-interno border border-borde bg-borde">
                  {datos.map(([etiqueta, valor]) => (
                    <div key={etiqueta} className="flex flex-col-reverse justify-end bg-white p-4">
                      <dt className="mt-1 text-xs leading-[1.3] text-apagado">{etiqueta}</dt>
                      <dd className="m-0 text-sm leading-[1.3] font-semibold text-tinta">{valor ?? "—"}</dd>
                    </div>
                  ))}
                </dl>

                {oferta.descripcion && (
                  <Tarjeta como="section" className="mb-4">
                    <EtiquetaSeccion>Sobre el puesto</EtiquetaSeccion>
                    <p className="m-0 text-sm leading-[1.6] whitespace-pre-line text-tinta-2">{oferta.descripcion}</p>
                  </Tarjeta>
                )}

                {(oferta.requisitos.length > 0 || oferta.beneficios.length > 0) && (
                  <div className="mb-4 grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4">
                    {oferta.requisitos.length > 0 && <ListaDeTildes titulo="Requisitos" items={oferta.requisitos} />}
                    {oferta.beneficios.length > 0 && <ListaDeTildes titulo="Qué ofrece" items={oferta.beneficios} />}
                  </div>
                )}
              </>
            )}
          </div>

          <aside className="min-w-0 flex-[1_1_300px]">
            {oferta.abierta && sesion.rol !== "institucion" && sesion.rol !== "admin" && (
              <Tarjeta como="section" className="mb-4 p-[22px]">
                <h2 className="m-0 mb-1.5 text-base leading-[1.3] font-semibold text-tinta">
                  {sesion.rol ? "Postulate desde tu panel" : "Postulate gratis"}
                </h2>
                <p className="m-0 mb-4 text-[13px] leading-normal text-apagado">
                  {sesion.rol
                    ? "Desde tu panel ves la oferta completa y te postulás con un clic."
                    : "Creá tu cuenta (es gratis para profesionales) y te postulás con un clic. Si ya tenés cuenta, ingresá y volvés a esta búsqueda."}
                </p>
                {sesion.rol ? (
                  <BotonLink href={`/docente/oferta/${oferta.id}`} variante="cta" bloque>
                    Ver oferta y postularme
                  </BotonLink>
                ) : (
                  <div className="flex flex-col gap-2">
                    <BotonLink href={RUTA_REGISTRO_DOCENTE} variante="cta" bloque>
                      Crear cuenta gratis
                    </BotonLink>
                    <BotonLink href={`/ingresar?next=${encodeURIComponent(`/docente/oferta/${oferta.id}`)}`} variante="secundario" bloque>
                      Ya tengo cuenta
                    </BotonLink>
                  </div>
                )}
              </Tarjeta>
            )}

            {oferta.abierta && (
              <Tarjeta como="section" className="mb-4 p-[22px]">
                <h2 className="m-0 mb-1.5 text-base leading-[1.3] font-semibold text-tinta">¿Conocés a alguien a quien le sirva?</h2>
                <p className="m-0 mb-4 text-[13px] leading-normal text-apagado">Compartí esta búsqueda por WhatsApp, redes o mail.</p>
                <BotonCompartir
                  mensaje={mensaje}
                  titulo="Compartir esta búsqueda"
                  bajada="Cualquiera que tenga el enlace puede ver la búsqueda, con o sin cuenta."
                  variante="primario"
                  tamano="md"
                  className="w-full"
                />
              </Tarjeta>
            )}

            <Tarjeta className="p-[22px]">
              <div className="mb-3 flex items-center gap-3">
                <LogoInstitucion nombre={inst.nombre} logoUrl={inst.logoUrl} tamano={44} className="rounded-caja bg-navy-50" />
                <div className="min-w-0">
                  <div className="text-[15px] leading-[1.3] font-semibold text-tinta">{inst.nombre}</div>
                  <div className="text-[12.5px] leading-[1.4] text-apagado">{inst.tipo}</div>
                </div>
              </div>
              <div className="mb-4 flex flex-wrap gap-1.5">
                {inst.verificada && <Insignia tono="verde">Institución verificada</Insignia>}
                {inst.fundadora && <Insignia tono="ambar">Institución fundadora</Insignia>}
              </div>
              <BotonLink href={rutaDeInstitucion(inst.slug)} variante="secundario" bloque>
                Ver perfil de la institución
              </BotonLink>
            </Tarjeta>
          </aside>
        </div>
      </div>
    </div>
  );
}

function ListaDeTildes({ titulo, items }: { titulo: string; items: string[] }) {
  return (
    <Tarjeta como="section" className="p-[22px]">
      <EtiquetaSeccion>{titulo}</EtiquetaSeccion>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2.5 text-sm leading-normal text-tinta-2">
            <Icono nombre="tilde" tamano={14} trazo={2.4} className="mt-[3px] flex-none text-verde" />
            {item}
          </li>
        ))}
      </ul>
    </Tarjeta>
  );
}
