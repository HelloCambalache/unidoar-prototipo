import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Icono } from "@/components/icons";
import { ListaDeSedes } from "@/components/instituciones/lista-de-sedes";
import { VitrinaInstalaciones, VitrinaMisionVision, VitrinaNovedadesLista } from "@/components/institucion/vitrina-secciones";
import { Imagen } from "@/components/publico/imagen";
import { LogoInstitucion } from "@/components/publico/logo-institucion";
import { accionPostular, sesionPublica } from "@/components/publico/sesion";
import { BotonLink } from "@/components/ui/button";
import { Insignia } from "@/components/ui/insignia";
import { EtiquetaSeccion, Tarjeta } from "@/components/ui/tarjeta";
import { focoDeFoto } from "@/lib/fotos";
import { num, RUTA_REGISTRO_DOCENTE } from "@/lib/publico";
import { institucionPublica } from "@/lib/queries/publico";

// Consulta la base en cada request: no se prerenderiza (en el build puede no haber DATABASE_URL).
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const inst = await institucionPublica(slug);
  if (!inst) return { title: "Institución no encontrada" };
  return { title: inst.nombre, description: inst.descripcion ?? `${inst.tipo} en UNIDOAR.` };
}

const VISTA_INSTITUCION = [
  { ok: true, texto: "Tu perfil completo y tu CV" },
  { ok: true, texto: "Tu estado de verificación" },
  { ok: true, texto: "Tu teléfono, solo si te postulás o le mandás tu CV" },
  { ok: false, texto: "No compartimos tu DNI ni tus documentos" },
];

export default async function PerfilInstitucion({ params }: Props) {
  const { slug } = await params;
  const [inst, sesion] = await Promise.all([institucionPublica(slug), sesionPublica()]);
  if (!inst) notFound();

  const datos = [
    inst.alumnos != null && { valor: num(inst.alumnos), etiqueta: "alumnos", grande: true },
    inst.niveles && { valor: inst.niveles, etiqueta: "niveles", grande: false },
    inst.turnos && { valor: inst.turnos, etiqueta: "turnos", grande: false },
    inst.docentesPlanta != null && { valor: num(inst.docentesPlanta), etiqueta: "profesionales en planta", grande: true },
    inst.fundada != null && { valor: String(inst.fundada), etiqueta: "fundación", grande: true },
  ].filter((d): d is { valor: string; etiqueta: string; grande: boolean } => !!d);

  const ubicacion = [inst.direccion, inst.zona].filter(Boolean).join(", ");
  const variasSedes = inst.sedes.length > 1;
  const cantidad = inst.busquedas.length;

  return (
    <div className="flex-1 bg-app px-12 py-9 max-[860px]:px-4 max-[860px]:py-5">
      <div className="mx-auto w-full max-w-[1100px]">
        <Link
          href="/instituciones"
          className="mb-[18px] inline-flex items-center gap-1 text-[13px] leading-none font-medium text-sutil hover:text-tinta focus-visible:text-tinta"
        >
          ‹ Instituciones
        </Link>

        <div className="flex flex-wrap items-start gap-7">
          <div className="min-w-0 flex-[2_1_340px]">
            <Tarjeta className="mb-4 overflow-hidden p-0">
              {inst.portadaUrl ? (
                <Imagen
                  src={inst.portadaUrl}
                  alt={`Foto de ${inst.nombre}`}
                  style={{ objectPosition: focoDeFoto(inst.portadaUrl) }}
                  className="block aspect-[16/7] w-full object-cover"
                />
              ) : (
                <div aria-hidden className="aspect-[16/7] w-full bg-[linear-gradient(135deg,#16214F,#2A3A7A)]" />
              )}
              <div className="relative px-6 pt-5 pb-5 max-[560px]:px-4">
                <div className="relative z-[2] -mt-10 mb-3.5">
                  <LogoInstitucion
                    nombre={inst.nombre}
                    logoUrl={inst.logoUrl}
                    tamano={64}
                    className="rounded-[10px] border-[3px] border-white bg-navy-50 shadow-[0_2px_6px_rgba(0,0,0,.15)]"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="m-0 text-[22px] leading-tight font-semibold text-tinta">{inst.nombre}</h1>
                  {inst.verificada && (
                    <Insignia tono="verde">Institución verificada</Insignia>
                  )}
                </div>
                <div className="mt-[3px] text-sm leading-snug text-apagado">
                  {inst.tipo}
                  {variasSedes ? ` · ${inst.sedes.length} sedes` : inst.zona ? ` · ${inst.zona}` : ""}
                </div>
              </div>
            </Tarjeta>

            {datos.length > 0 && (
              <dl className="m-0 mb-4 grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-px overflow-hidden rounded-interno border border-borde bg-borde">
                {datos.map((d) => (
                  <div key={d.etiqueta} className="flex flex-col-reverse justify-end bg-white p-4">
                    <dt className="mt-1 text-xs leading-[1.3] text-apagado">{d.etiqueta}</dt>
                    <dd
                      className={
                        d.grande
                          ? "m-0 text-[22px] leading-none font-bold text-tinta"
                          : "m-0 text-sm leading-[1.3] font-semibold text-tinta"
                      }
                    >
                      {d.valor}
                    </dd>
                  </div>
                ))}
              </dl>
            )}

            {inst.descripcion && (
              <Tarjeta como="section" className="mb-4">
                <EtiquetaSeccion>Sobre la institución</EtiquetaSeccion>
                <p className="m-0 text-sm leading-[1.6] text-tinta-2">{inst.descripcion}</p>
              </Tarjeta>
            )}

            <VitrinaMisionVision mision={inst.mision} vision={inst.vision} valores={inst.valores} />
            <VitrinaInstalaciones fotos={inst.fotos} nombre={inst.nombre} />
            <VitrinaNovedadesLista novedades={inst.novedades} />

            {variasSedes && (
              <Tarjeta como="section" className="mb-4">
                <EtiquetaSeccion>Sedes</EtiquetaSeccion>
                <ListaDeSedes sedes={inst.sedes} />
                {inst.horarioAdministracion && (
                  <div className="mt-3 text-[13px] leading-snug text-apagado">
                    {`Horario de administración: ${inst.horarioAdministracion}`}
                  </div>
                )}
              </Tarjeta>
            )}

            {!variasSedes && ubicacion && (
              <Tarjeta como="section" className="mb-4">
                <EtiquetaSeccion>Dónde queda</EtiquetaSeccion>
                <div className="flex items-start gap-2 text-sm leading-normal text-tinta-2">
                  <Icono nombre="ubicacion" tamano={16} className="mt-0.5 text-apagado" />
                  <span>{ubicacion}</span>
                </div>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ubicacion)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2.5 inline-block text-[13px] font-semibold text-navy-700 underline hover:text-naranja"
                >
                  Ver en el mapa
                </a>
                {inst.horarioAdministracion && (
                  <div className="mt-2.5 text-[13px] leading-snug text-apagado">
                    {`Horario de administración: ${inst.horarioAdministracion}`}
                  </div>
                )}
              </Tarjeta>
            )}

            <Tarjeta como="section">
              <h2 className="m-0 mb-3.5 text-lg leading-[1.3] font-semibold text-tinta">Búsquedas activas</h2>
              {cantidad === 0 ? (
                <p className="m-0 text-sm leading-normal text-sutil">Hoy no tiene búsquedas activas.</p>
              ) : (
                <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3.5 p-0">
                  {inst.busquedas.map((b) => {
                    const accion = accionPostular(sesion, b.id);
                    return (
                      <li key={b.id} className="flex flex-col rounded-interno border border-borde p-3.5">
                        <div className="mb-1 flex items-start justify-between gap-2">
                          <h3 className="m-0 text-sm leading-[1.3] font-semibold text-tinta">{b.puesto}</h3>
                          {b.rapida && (
                            <Insignia tono="rosa" punto>
                              Urgente
                            </Insignia>
                          )}
                        </div>
                        <p className="m-0 mb-3 flex-1 text-xs leading-[1.3] text-apagado">
                          {[b.sede, b.tipo, b.turno].filter(Boolean).join(" · ")}
                        </p>
                        {accion && (
                          <BotonLink href={accion.href} variante="secundario" tamano="sm" className="self-start">
                            {accion.etiqueta === "Postularme" ? "Ver oferta" : accion.etiqueta}
                          </BotonLink>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </Tarjeta>
          </div>

          <aside className="min-w-0 flex-[1_1_300px]">
            {(!sesion.rol || sesion.rol === "docente") && (
              <Tarjeta como="section" className="mb-4 p-[22px]">
                <h2 className="m-0 mb-1.5 text-base leading-[1.3] font-semibold text-tinta">
                  {sesion.rol ? "Seguí a esta institución desde tu panel" : "Creá tu cuenta para postularte"}
                </h2>
                <p className="m-0 mb-4 text-[13px] leading-normal text-apagado">
                  {sesion.rol
                    ? "Desde tu panel podés enviarle tu CV, guardarla y postularte a sus búsquedas."
                    : "Gratis para profesionales. Te lleva dos minutos y después te postulás con un clic."}
                </p>
                {sesion.rol ? (
                  <BotonLink href={`/docente/instituciones/${inst.slug}`} variante="primario" bloque>
                    Ver en mi panel
                  </BotonLink>
                ) : (
                  <div className="flex flex-col gap-2">
                    <BotonLink href={RUTA_REGISTRO_DOCENTE} variante="cta" bloque>
                      Crear cuenta gratis
                    </BotonLink>
                    <BotonLink href="/ingresar" variante="secundario" bloque>
                      Ya tengo cuenta
                    </BotonLink>
                  </div>
                )}
                <div className="mt-[18px] border-t border-borde pt-4">
                  <EtiquetaSeccion>Qué va a ver la institución</EtiquetaSeccion>
                  <ul className="m-0 flex list-none flex-col gap-2 p-0 text-[13px] leading-[1.4] text-tinta-2">
                    {VISTA_INSTITUCION.map((v) => (
                      <li key={v.texto} className={v.ok ? "flex items-start gap-2" : "flex items-start gap-2 text-sutil"}>
                        <Icono
                          nombre={v.ok ? "tilde" : "cerrar"}
                          tamano={14}
                          trazo={2.4}
                          className={v.ok ? "mt-0.5 text-verde" : "mt-0.5 text-sutil"}
                        />
                        {v.texto}
                      </li>
                    ))}
                  </ul>
                </div>
              </Tarjeta>
            )}
            <Tarjeta className="p-[22px] text-center">
              <div className="mb-1 text-[26px] leading-none font-bold text-navy-700">{num(cantidad)}</div>
              <div className="text-[13px] leading-snug text-apagado">
                {cantidad === 1 ? "búsqueda activa" : "búsquedas activas"} ahora
              </div>
            </Tarjeta>
          </aside>
        </div>
      </div>
    </div>
  );
}
