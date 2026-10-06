import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { BotonFavoritoDocente } from "@/components/institucion/boton-favorito-docente";
import { BotonInvitarDocente } from "@/components/institucion/boton-invitar-docente";
import { BotonVerCv } from "@/components/institucion/boton-ver-cv";
import { BotonVolver } from "@/components/institucion/boton-volver";
import { DisponibilidadDocente } from "@/components/institucion/disponibilidad-docente";
import { Icono } from "@/components/icons";
import { Boton, botonClases } from "@/components/ui/button";
import { Avatar, Insignia } from "@/components/ui/insignia";
import { EtiquetaSeccion, Tarjeta } from "@/components/ui/tarjeta";
import { urlFirmada } from "@/lib/almacenamiento";
import { requerirInstitucion } from "@/lib/auth";
import { esUuid } from "@/lib/busquedas";
import { CATEGORIA_INFO, ETAPA_LABEL } from "@/lib/catalogo";
import { haceTiempo } from "@/lib/fechas";
import { opcionesDeInvitacion } from "@/lib/invitaciones";
import { busquedaDeContexto, perfilDeDocente } from "@/lib/queries/profesionales";
import { cn, iniciales } from "@/lib/utils";
import { registrarVistaDePerfil } from "@/lib/vistas-perfil";

export const metadata: Metadata = { title: "Perfil del profesional" };

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** "11 4455-2201" → https://wa.me/5491144552201 */
function enlaceWhatsApp(telefono: string | null) {
  let n = (telefono ?? "").replace(/\D/g, "").replace(/^0+/, "");
  if (!n) return null;
  if (!n.startsWith("54")) n = `549${n}`;
  else if (!n.startsWith("549")) n = `549${n.slice(2)}`;
  return `https://wa.me/${n}`;
}

const TONO_ETAPA = {
  nuevos: "azul",
  preseleccionados: "azul",
  entrevista: "ambar",
  oferta: "naranja",
  contratado: "verde",
  descartado: "neutro",
} as const;

function Tilde({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <div className={cn("flex items-center gap-2", !ok && "text-sutil")}>
      {ok ? (
        <span className="inline-flex size-[18px] flex-none items-center justify-center rounded-full bg-verde text-white">
          <Icono nombre="tilde" tamano={11} trazo={3} />
        </span>
      ) : (
        <span className="size-[18px] flex-none rounded-full border-[1.5px] border-dashed border-[#CFCCC5]" />
      )}
      {children}
    </div>
  );
}

const Titulo = ({ children }: { children: React.ReactNode }) => (
  <h2 className="m-0 mb-3.5 text-[15px] leading-none font-semibold">{children}</h2>
);

export default async function PerfilDocentePage({ params, searchParams }: Props) {
  const { usuario, institucion } = await requerirInstitucion();
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  if (!esUuid(id)) notFound();

  const perfil = await perfilDeDocente(institucion.id, usuario.id, id);
  if (!perfil) notFound();
  const { docente: d } = perfil;

  // Avisar al docente que su perfil fue visto no demora la página: se hace al terminar la respuesta.
  after(async () => {
    try {
      await registrarVistaDePerfil(institucion, d);
    } catch (error) {
      console.error("No se pudo registrar la vista del perfil", error);
    }
  });

  // La búsqueda de la URL solo vale si es de esta institución.
  const busquedaId = uno(sp.busqueda);
  const contexto = esUuid(busquedaId) ? await busquedaDeContexto(institucion.id, busquedaId) : null;
  const contextoId = contexto && perfil.busquedasDelDocente.some((b) => b.id === contexto.id) ? contexto.id : null;
  const desde = uno(sp.desde);

  const volver =
    desde === "base"
      ? { href: "/institucion/base-de-docentes", etiqueta: "Profesionales" }
      : contexto && desde !== "buscador"
        ? { href: `/institucion/postulantes?busqueda=${contexto.id}`, etiqueta: "Postulantes" }
        : {
            href: `/institucion/buscar-docentes${contexto ? `?busqueda=${contexto.id}` : ""}`,
            etiqueta: "Buscar profesionales",
          };

  const info = CATEGORIA_INFO[d.categoria];
  const nombre = `${d.nombre} ${d.apellido}`.trim();
  const whatsapp = enlaceWhatsApp(d.telefono);
  const opciones = opcionesDeInvitacion(
    perfil.busquedasDelDocente,
    perfil.busquedasDelDocente.flatMap((b) => (b.relacion ? [{ busquedaId: b.id, origen: b.relacion.origen }] : [])),
  );
  const nivelesYAsignaturas = d.asignaturas.length > 0 || d.niveles.length > 0;
  // El CV vive en un bucket privado: se guarda el path y el enlace se firma al mostrarlo.
  const cvEnlace = d.cvUrl ? (/^https?:\/\//.test(d.cvUrl) ? d.cvUrl : await urlFirmada(d.cvUrl)) : null;
  const sinCv = d.cvUrl ? "No pudimos abrir el CV ahora. Probá de nuevo en un rato." : `${nombre} todavía no cargó su CV.`;

  return (
    <div>
      <nav aria-label="Ruta" className="mb-4 flex items-center gap-2">
        <BotonVolver fallback={volver.href} />
        <span className="text-[13px] leading-none text-apagado">
          <Link href={volver.href} className="text-apagado hover:text-tinta">
            {volver.etiqueta}
          </Link>
          <span className="px-[7px] text-borde-fuerte">/</span>
          {d.asignaturas[0] ?? info.label}
          <span className="px-[7px] text-borde-fuerte">/</span>
          <span className="font-medium text-tinta">{nombre}</span>
        </span>
      </nav>

      <div className="flex items-start gap-6 max-[1000px]:flex-wrap max-[860px]:flex-col max-[860px]:items-stretch max-[860px]:gap-4">
        <div className="min-w-0 flex-1 max-[1000px]:basis-full max-[860px]:basis-auto">
          <Tarjeta como="section" className="mb-4 p-6">
            <div className="flex gap-[18px]">
              <Avatar
                iniciales={iniciales(nombre)}
                fotoUrl={d.fotoUrl}
                tamano={72}
                fondo={info.tint}
                texto={info.ink}
              />
              <div className="min-w-0 flex-1">
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  <h1 className="m-0 text-[22px] leading-[1.2] font-semibold tracking-[-0.015em]">{nombre}</h1>
                  {d.suspendido ? (
                    <Insignia tono="rosa">Perfil suspendido</Insignia>
                  ) : perfil.verificado ? (
                    <Insignia tono="verde" className="gap-1">
                      <Icono nombre="tilde" tamano={10} trazo={3.2} />
                      Perfil verificado
                    </Insignia>
                  ) : d.verificacion === "rechazado" ? (
                    <Insignia>Perfil no verificado</Insignia>
                  ) : (
                    <Insignia tono="ambar">Verificación pendiente</Insignia>
                  )}
                </div>
                <div className="text-sm leading-snug text-apagado">
                  {d.subtitulo ?? [info.label, d.aniosExperiencia != null ? `${d.aniosExperiencia} años de experiencia` : ""].filter(Boolean).join(" · ")}
                </div>
                {d.zonas.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {d.zonas.map((z) => (
                      <Insignia key={z}>{z}</Insignia>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="mt-5 rounded-ud border border-borde bg-superficie px-[18px] py-4">
              <EtiquetaSeccion className="mb-3">Estado de verificación</EtiquetaSeccion>
              <div className="flex flex-wrap gap-x-[26px] gap-y-3 text-[13px] leading-none">
                <Tilde ok={perfil.verificado}>Identidad (DNI)</Tilde>
                <Tilde ok={d.tituloVerificado}>
                  {d.tituloVerificado ? "Título docente" : "Título · lo valida la institución al contratar"}
                </Tilde>
                <Tilde ok={d.antecedentesVerificados}>
                  {d.antecedentesVerificados ? "Certificado de buena conducta" : "Certificado de buena conducta · pendiente"}
                </Tilde>
              </div>
            </div>
          </Tarjeta>

          <Tarjeta como="section" className="mb-4 p-[22px]">
            <Titulo>Resumen profesional</Titulo>
            {d.resumen?.trim() ? (
              <p className="m-0 text-sm leading-[1.6] whitespace-pre-line text-tinta-2">{d.resumen}</p>
            ) : (
              <p className="m-0 text-sm leading-normal text-apagado">Todavía no cargó un resumen.</p>
            )}
          </Tarjeta>

          <Tarjeta como="section" className="mb-4 p-[22px]">
            <Titulo>Experiencia</Titulo>
            {d.experiencia.length > 0 ? (
              <ul className="m-0 flex list-none flex-col gap-4 p-0">
                {d.experiencia.map((e, i) => (
                  <li key={`${e.titulo}-${i}`} className="flex gap-3">
                    <span className={cn("mt-1.5 size-[9px] flex-none rounded-full", i === 0 ? "bg-navy-700" : "bg-[#CFCCC5]")} />
                    <div className="min-w-0">
                      <div className="text-sm leading-snug font-semibold">{e.titulo}</div>
                      {e.fechas && <div className="mt-px text-xs leading-snug text-sutil">{e.fechas}</div>}
                      {e.desc && <div className="mt-[5px] text-[13px] leading-normal text-tinta-2">{e.desc}</div>}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="m-0 text-sm leading-normal text-apagado">Todavía no cargó su experiencia.</p>
            )}
          </Tarjeta>

          <div className="mb-4 flex gap-4 max-[860px]:flex-col">
            <Tarjeta como="section" className="flex-1 p-[22px]">
              <Titulo>Formación</Titulo>
              {d.formacion.length > 0 ? (
                <ul className="m-0 flex list-none flex-col gap-3 p-0">
                  {d.formacion.map((f, i) => (
                    <li key={`${f.titulo}-${i}`}>
                      <div className="text-[13px] leading-snug font-semibold">{f.titulo}</div>
                      {f.detalle && <div className="mt-px text-xs leading-snug text-sutil">{f.detalle}</div>}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="m-0 text-sm leading-normal text-apagado">Todavía no cargó su formación.</p>
              )}
            </Tarjeta>
            <Tarjeta como="section" className="flex-1 p-[22px]">
              <Titulo>Asignaturas y niveles</Titulo>
              {nivelesYAsignaturas ? (
                <>
                  {d.asignaturas.length > 0 && (
                    <div className="mb-3 flex flex-wrap gap-1.5">
                      {d.asignaturas.map((a) => (
                        <Insignia key={a}>{a}</Insignia>
                      ))}
                    </div>
                  )}
                  {d.niveles.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {d.niveles.map((n) => (
                        <Insignia key={n} tono="azul">
                          {n}
                        </Insignia>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <p className="m-0 text-sm leading-normal text-apagado">Todavía no indicó asignaturas ni niveles.</p>
              )}
            </Tarjeta>
          </div>

          <Tarjeta como="section" className="p-[22px]">
            <div className="mb-3.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
              <h2 className="m-0 text-[15px] leading-none font-semibold">Disponibilidad horaria</h2>
              {perfil.grillaActualizadaEn && (
                <span className="text-xs leading-none text-sutil">
                  Declarada por el profesional · actualizada {haceTiempo(perfil.grillaActualizadaEn)}
                </span>
              )}
            </div>
            {perfil.grilla ? (
              <DisponibilidadDocente grilla={perfil.grilla} />
            ) : (
              <p className="m-0 text-sm leading-normal text-apagado">Todavía no declaró su disponibilidad.</p>
            )}
          </Tarjeta>
        </div>

        <aside className="flex w-[280px] flex-none flex-col gap-4 max-[1000px]:w-full">
          <Tarjeta como="section" className="p-5">
            <EtiquetaSeccion className="mb-3">Acciones</EtiquetaSeccion>
            <div className="flex flex-col gap-2.5">
              {d.suspendido ? (
                <Boton disabled bloque>
                  Invitar a postularse
                </Boton>
              ) : (
                <BotonInvitarDocente
                  docenteId={d.id}
                  nombre={nombre}
                  opciones={opciones}
                  contextoId={contextoId}
                  tamano="md"
                  bloque
                />
              )}
              {whatsapp && perfil.puedeContactar && (
                <a
                  href={whatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={botonClases({ variante: "secundario", bloque: true })}
                >
                  <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1E7A4C" strokeWidth="1.8" className="flex-none">
                    <path d="M4 20l1.4-4A8 8 0 1112 20H4z" />
                  </svg>
                  Contactar por WhatsApp
                </a>
              )}
              <BotonFavoritoDocente docenteId={d.id} nombre={nombre} favorito={perfil.favorito} variante="boton" />
              <BotonVerCv cvUrl={cvEnlace} sinCv={sinCv} />
            </div>
            {d.suspendido && (
              <p className="m-0 mt-3 text-xs leading-normal text-apagado">
                El equipo de UNIDOAR suspendió este perfil: por ahora no se lo puede invitar a nuevas búsquedas.
              </p>
            )}
            {whatsapp && !perfil.puedeContactar && (
              <p className="m-0 mt-3 text-xs leading-normal text-sutil">
                El contacto directo se habilita cuando se postula a una de tus búsquedas o te manda su CV.
              </p>
            )}
            {perfil.envioCv && (
              <p className="m-0 mt-3 text-xs leading-normal text-verde">Te envió su CV desde tu perfil público.</p>
            )}
            <dl className="m-0 mt-4 flex flex-col gap-2 border-t border-borde pt-3.5 text-[13px] leading-none">
              <div className="flex justify-between gap-3">
                <dt className="text-apagado">Última actividad</dt>
                <dd className="m-0 font-semibold">{haceTiempo(d.actualizadoEn)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-apagado">Postulaciones activas</dt>
                <dd className="m-0 font-semibold">{perfil.postulacionesActivas}</dd>
              </div>
            </dl>
          </Tarjeta>

          <Tarjeta como="section" className="p-5">
            <EtiquetaSeccion className="mb-3">En tus búsquedas</EtiquetaSeccion>
            {perfil.enBusquedas.length > 0 ? (
              <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
                {perfil.enBusquedas.map((b) => (
                  <li key={b.busquedaId}>
                    <Link
                      href={`/institucion/postulantes?busqueda=${b.busquedaId}`}
                      className="flex items-center justify-between gap-2.5 border-b border-[#F0EFEA] pb-2.5 text-tinta hover:text-tinta"
                    >
                      <span className="min-w-0">
                        <span className="block text-[13px] leading-snug font-semibold">{b.puesto}</span>
                        <span className="mt-0.5 block text-xs leading-snug text-sutil">
                          {b.origen === "invitacion" ? "Lo invitaste" : "Se postuló"} {haceTiempo(b.desde)}
                          {b.estadoBusqueda === "cerrada" && " · búsqueda cerrada"}
                        </span>
                      </span>
                      <Insignia tono={TONO_ETAPA[b.etapa]} className="flex-none">
                        {ETAPA_LABEL[b.etapa]}
                      </Insignia>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="m-0 text-[13px] leading-normal text-apagado">
                Todavía no lo sumaste a ninguna búsqueda. Invitalo a postularse y aparece acá.
              </p>
            )}
          </Tarjeta>
        </aside>
      </div>
    </div>
  );
}
