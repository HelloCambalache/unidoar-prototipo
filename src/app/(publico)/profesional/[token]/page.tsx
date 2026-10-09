import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { Icono } from "@/components/icons";
import { sesionPublica } from "@/components/publico/sesion";
import { BotonLink } from "@/components/ui/button";
import { Avatar, Insignia } from "@/components/ui/insignia";
import { EtiquetaSeccion, Tarjeta } from "@/components/ui/tarjeta";
import { CATEGORIA_INFO } from "@/lib/catalogo";
import { RUTA_REGISTRO_INSTITUCION } from "@/lib/publico";
import { perfilCompartido } from "@/lib/queries/perfil-compartido";
import { cn, iniciales } from "@/lib/utils";

// Consulta la base en cada request: no se prerenderiza, y apagar el enlace tiene que cortarlo en el momento.
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ token: string }> };

// El título y la página piden lo mismo: una sola consulta por request.
const cargar = cache(perfilCompartido);

/** Es un perfil que la persona eligió mostrar a quien tenga el enlace: no se indexa ni se sigue. */
const NO_INDEXAR = { index: false, follow: false, nocache: true } as const;

const recortar = (texto: string, max: number) => (texto.length <= max ? texto : `${texto.slice(0, max - 1).trimEnd()}…`);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const d = await cargar(token);
  if (!d) return { title: "Perfil no disponible", robots: NO_INDEXAR };
  const nombre = `${d.nombre} ${d.apellido}`.trim();
  const info = CATEGORIA_INFO[d.categoria];
  const titulo = `${nombre} · ${d.subtitulo ?? info.label}`;
  const descripcion = d.resumen?.trim() ? recortar(d.resumen.trim().replace(/\s+/g, " "), 160) : `${info.label} en UNIDOAR.`;
  return {
    title: titulo,
    description: descripcion,
    robots: NO_INDEXAR,
    openGraph: { title: titulo, description: descripcion, type: "profile", ...(d.fotoUrl ? { images: [d.fotoUrl] } : {}) },
  };
}

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

export default async function PerfilCompartidoPage({ params }: Props) {
  const { token } = await params;
  const [d, sesion] = await Promise.all([cargar(token), sesionPublica()]);
  if (!d) notFound();

  const info = CATEGORIA_INFO[d.categoria];
  const nombre = `${d.nombre} ${d.apellido}`.trim();
  const verificado = d.verificacion === "verificado";
  const subtitulo =
    d.subtitulo ?? [info.label, d.aniosExperiencia != null ? `${d.aniosExperiencia} años de experiencia` : ""].filter(Boolean).join(" · ");

  return (
    <div className="flex-1 bg-app px-12 py-9 max-[860px]:px-4 max-[860px]:py-5">
      <div className="mx-auto flex w-full max-w-[1100px] flex-wrap items-start gap-6">
        <div className="min-w-0 flex-[2_1_340px]">
          <Tarjeta como="section" className="mb-4 p-6 max-[560px]:p-4">
            <div className="flex gap-[18px] max-[560px]:flex-col">
              <Avatar iniciales={iniciales(nombre)} fotoUrl={d.fotoUrl} tamano={88} fondo={info.tint} texto={info.ink} />
              <div className="min-w-0 flex-1">
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  <h1 className="m-0 text-[24px] leading-[1.2] font-semibold tracking-[-0.015em] [overflow-wrap:anywhere]">{nombre}</h1>
                  {verificado ? (
                    <Insignia tono="verde" className="gap-1">
                      <Icono nombre="tilde" tamano={10} trazo={3.2} />
                      Perfil verificado
                    </Insignia>
                  ) : (
                    <Insignia tono="ambar">Verificación pendiente</Insignia>
                  )}
                </div>
                <div className="text-sm leading-snug text-apagado">{subtitulo}</div>
                {d.zonas.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {d.zonas.map((z) => (
                      <Insignia key={z}>{z}</Insignia>
                    ))}
                  </div>
                )}
              </div>
            </div>
            {verificado && (
              <div className="mt-5 rounded-ud border border-borde bg-superficie px-[18px] py-4">
                <EtiquetaSeccion className="mb-3">Verificado por UNIDOAR</EtiquetaSeccion>
                <div className="flex flex-wrap gap-x-[26px] gap-y-3 text-[13px] leading-none">
                  <Tilde ok>Identidad (DNI)</Tilde>
                  {d.tituloVerificado && <Tilde ok>Título profesional</Tilde>}
                  {d.antecedentesVerificados && <Tilde ok>Certificado de buena conducta</Tilde>}
                </div>
              </div>
            )}
          </Tarjeta>

          {d.resumen?.trim() && (
            <Tarjeta como="section" className="mb-4 p-[22px]">
              <Titulo>Resumen profesional</Titulo>
              <p className="m-0 text-sm leading-[1.6] whitespace-pre-line text-tinta-2">{d.resumen}</p>
            </Tarjeta>
          )}

          {d.experiencia.length > 0 && (
            <Tarjeta como="section" className="mb-4 p-[22px]">
              <Titulo>Experiencia</Titulo>
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
            </Tarjeta>
          )}

          {(d.formacion.length > 0 || d.asignaturas.length > 0 || d.niveles.length > 0) && (
            <div className="flex gap-4 max-[860px]:flex-col">
              {d.formacion.length > 0 && (
                <Tarjeta como="section" className="flex-1 p-[22px]">
                  <Titulo>Formación</Titulo>
                  <ul className="m-0 flex list-none flex-col gap-3 p-0">
                    {d.formacion.map((f, i) => (
                      <li key={`${f.titulo}-${i}`}>
                        <div className="text-[13px] leading-snug font-semibold">{f.titulo}</div>
                        {f.detalle && <div className="mt-px text-xs leading-snug text-sutil">{f.detalle}</div>}
                      </li>
                    ))}
                  </ul>
                </Tarjeta>
              )}
              {(d.asignaturas.length > 0 || d.niveles.length > 0) && (
                <Tarjeta como="section" className="flex-1 p-[22px]">
                  <Titulo>Asignaturas y niveles</Titulo>
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
                </Tarjeta>
              )}
            </div>
          )}
        </div>

        <aside className="min-w-0 flex-[1_1_280px]">
          {sesion.rol !== "docente" && (
            <Tarjeta como="section" className="mb-4 p-[22px]">
              <h2 className="m-0 mb-1.5 text-base leading-[1.3] font-semibold text-tinta">¿Querés contactar a {d.nombre}?</h2>
              <p className="m-0 mb-4 text-[13px] leading-normal text-apagado">
                Desde UNIDOAR podés invitar a {d.nombre} a postularse a tus búsquedas. Su contacto se habilita cuando se postula o te manda su CV.
              </p>
              {sesion.rol === "institucion" ? (
                <BotonLink href="/institucion/buscar-docentes" variante="primario" bloque>
                  Buscar profesionales
                </BotonLink>
              ) : (
                <div className="flex flex-col gap-2">
                  <BotonLink href={RUTA_REGISTRO_INSTITUCION} variante="cta" bloque>
                    Crear cuenta de institución
                  </BotonLink>
                  <BotonLink href="/ingresar" variante="secundario" bloque>
                    Ya tengo cuenta
                  </BotonLink>
                </div>
              )}
            </Tarjeta>
          )}
          <Tarjeta className="p-[22px]">
            <h2 className="m-0 mb-1.5 text-base leading-[1.3] font-semibold text-tinta">UNIDOAR</h2>
            <p className="m-0 text-[13px] leading-normal text-apagado">
              Conectamos instituciones con educadores, entrenadores y guardavidas con identidad y título verificados. Este perfil lo
              compartió su titular: no incluye teléfono, email ni documentos.
            </p>
          </Tarjeta>
        </aside>
      </div>
    </div>
  );
}
