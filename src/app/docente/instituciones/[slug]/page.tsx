import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BotonLink } from "@/components/ui/button";
import { Insignia } from "@/components/ui/insignia";
import { EtiquetaSeccion, Tarjeta } from "@/components/ui/tarjeta";
import { InstitucionCvBoton, InstitucionFavoritoBoton } from "@/components/docente/instituciones-acciones";
import { InstitucionLogo } from "@/components/docente/instituciones-logo";
import { VitrinaInstalaciones, VitrinaMisionVision, VitrinaNovedadesLista } from "@/components/institucion/vitrina-secciones";
import { Icono } from "@/components/icons";
import { requerirDocente } from "@/lib/auth";
import { focoDeFoto } from "@/lib/fotos";
import { perfilInstitucion } from "@/lib/queries/instituciones";

type Props = { params: Promise<{ slug: string }> };

export const metadata: Metadata = { title: "Institución" };

const QUE_VE = [
  { texto: "Tu perfil completo y tu CV", si: true },
  { texto: "Tu estado de verificación", si: true },
  { texto: "Tu teléfono, sólo si te preselecciona", si: true },
  { texto: "No compartimos tu DNI ni tus documentos", si: false },
];

export default async function InstitucionPerfilDocentePage({ params }: Props) {
  const { usuario, docente } = await requerirDocente();
  const { slug } = await params;
  const datos = await perfilInstitucion(slug, usuario.id, docente.id);
  if (!datos) notFound();
  const { institucion: i, busquedas, favorita, cvEnviado, fotos, novedades } = datos;

  const cifras: { valor: string; etiqueta: string; grande: boolean }[] = [];
  if (i.alumnos != null) cifras.push({ valor: String(i.alumnos), etiqueta: "alumnos", grande: true });
  if (i.niveles) cifras.push({ valor: i.niveles, etiqueta: "niveles", grande: false });
  if (i.turnos) cifras.push({ valor: i.turnos, etiqueta: "turnos", grande: false });
  if (i.docentesPlanta != null) cifras.push({ valor: String(i.docentesPlanta), etiqueta: "profesionales en planta", grande: true });
  if (i.fundada != null) cifras.push({ valor: String(i.fundada), etiqueta: "fundación", grande: true });

  const mapaOsm =
    i.lat != null && i.lng != null
      ? `https://www.openstreetmap.org/?mlat=${i.lat}&mlon=${i.lng}#map=15/${i.lat}/${i.lng}`
      : null;

  return (
    <>
      <Link
        href="/docente/instituciones"
        className="mb-[18px] inline-flex items-center gap-1 text-[13px] leading-none font-medium text-sutil hover:text-tinta"
      >
        ‹ Instituciones
      </Link>

      <div className="flex flex-wrap items-start gap-7">
        <div className="min-w-[340px] flex-[2] max-[860px]:min-w-0 max-[860px]:basis-full">
          <section className="mb-4 overflow-hidden rounded-lg border border-borde bg-white">
            {i.portadaUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- portadas subidas por las instituciones, de tamaños libres
              <img
                src={i.portadaUrl}
                alt={`Foto de ${i.nombre}`}
                style={{ objectPosition: focoDeFoto(i.portadaUrl) }}
                className="block aspect-[16/7] w-full object-cover"
              />
            ) : (
              <div aria-hidden className="flex aspect-[16/7] w-full items-center justify-center bg-[#F3F2EE] text-[#C9C6C0]">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="3" y="4" width="18" height="16" rx="2" />
                  <circle cx="8.5" cy="9.5" r="1.6" />
                  <path d="M4 17l5-5 4 4 3-2 4 4" />
                </svg>
              </div>
            )}
            <div className="relative px-6 py-5">
              <div className="relative z-[2] -mt-10 mb-3.5">
                <InstitucionLogo
                  nombre={i.nombre}
                  logoUrl={i.logoUrl}
                  tamano={64}
                  className="rounded-[10px] border-[3px] border-white shadow-[0_2px_6px_rgba(0,0,0,.15)]"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="m-0 text-[22px] leading-tight font-semibold">{i.nombre}</h1>
                {i.verificada && <Insignia tono="verde">Institución verificada</Insignia>}
              </div>
              <div className="mt-[3px] text-sm leading-[1.4] text-apagado">
                {[i.tipo, i.zona].filter(Boolean).join(" · ")}
              </div>
            </div>
          </section>

          {cifras.length > 0 && (
            <div className="mb-4 overflow-hidden rounded-lg border border-borde bg-white">
              <div className="-mr-px -mb-px grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))]">
                {cifras.map((c) => (
                  <div key={c.etiqueta} className="border-r border-b border-borde p-4">
                    <div className={c.grande ? "text-[22px] leading-none font-bold" : "text-sm leading-[1.3] font-semibold"}>
                      {c.valor}
                    </div>
                    <div className="mt-1 text-xs leading-[1.3] text-apagado">{c.etiqueta}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Tarjeta como="section" className="mb-4">
            <EtiquetaSeccion>Sobre la institución</EtiquetaSeccion>
            <p className="m-0 text-sm leading-[1.6] text-tinta-2">
              {i.descripcion || "Todavía no cargó una descripción."}
            </p>
          </Tarjeta>

          <VitrinaMisionVision mision={i.mision} vision={i.vision} valores={i.valores} />
          <VitrinaInstalaciones fotos={fotos} nombre={i.nombre} />
          <VitrinaNovedadesLista novedades={novedades} />

          <Tarjeta como="section" className="mb-4">
            <EtiquetaSeccion className="mb-1.5">Dónde queda</EtiquetaSeccion>
            <div className="flex h-[120px] items-center justify-center rounded-lg border border-dashed border-[#CFCCC5] bg-[repeating-linear-gradient(45deg,#F5F4F0,#F5F4F0_10px,#EFEEEA_10px,#EFEEEA_20px)] px-3 text-center text-[13px] leading-[1.4] text-sutil">
              <div>
                <Icono nombre="ubicacion" tamano={20} trazo={1.8} className="mx-auto mb-1.5" />
                {i.zona ?? "Zona a confirmar"}
                <div className="mt-0.5 text-[11px]">
                  {mapaOsm ? (
                    <a href={mapaOsm} target="_blank" rel="noopener noreferrer" className="font-medium underline">
                      Ver en el mapa
                    </a>
                  ) : (
                    "zona declarada"
                  )}
                </div>
              </div>
            </div>
            {i.direccion && <div className="mt-2.5 text-[13px] leading-[1.4] text-tinta-2">{i.direccion}</div>}
            {i.horarioAdministracion && (
              <div className="mt-1 text-[13px] leading-[1.4] text-apagado">{`Horario de administración: ${i.horarioAdministracion}`}</div>
            )}
          </Tarjeta>

          <Tarjeta como="section">
            <h2 className="m-0 mb-3.5 text-lg leading-[1.3] font-semibold">Búsquedas activas</h2>
            {busquedas.length === 0 ? (
              <p className="m-0 text-sm leading-normal text-sutil">
                Hoy no tiene búsquedas activas. Guardala para enterarte cuando publique una nueva.
              </p>
            ) : (
              <ul className="m-0 flex list-none flex-wrap gap-3.5 p-0">
                {busquedas.map((b) => (
                  <li key={b.id} className="flex min-w-[220px] flex-1 flex-col rounded-lg border border-borde p-3.5">
                    <div className="mb-1 flex items-start justify-between gap-2">
                      <div className="text-sm leading-[1.3] font-semibold">{b.puesto}</div>
                      {b.rapida && <Insignia tono="naranja">Rápida</Insignia>}
                    </div>
                    <div className="mb-3 flex-1 text-xs leading-[1.3] text-apagado">
                      {[b.tipo, b.turno].filter(Boolean).join(" · ")}
                    </div>
                    <BotonLink href={`/docente/oferta/${b.id}`} variante="secundario" tamano="sm" className="self-start">
                      Ver oferta
                    </BotonLink>
                  </li>
                ))}
              </ul>
            )}
          </Tarjeta>
        </div>

        <div className="min-w-[300px] flex-1 max-[860px]:min-w-0 max-[860px]:basis-full">
          <Tarjeta como="section" className="mb-4 p-[22px]">
            <h2 className="m-0 mb-4 text-base leading-[1.3] font-semibold">Enviá tu CV a esta institución</h2>
            <InstitucionCvBoton institucionId={i.id} enviado={cvEnviado} />
            <InstitucionFavoritoBoton
              institucionId={i.id}
              favorita={favorita}
              nombre={i.nombre}
              className="w-full"
            />
            <div className="mt-[18px] border-t border-borde pt-4">
              <EtiquetaSeccion>Qué va a ver la institución</EtiquetaSeccion>
              <ul className="m-0 flex list-none flex-col gap-2 p-0 text-[13px] leading-[1.4]">
                {QUE_VE.map((q) => (
                  <li key={q.texto} className={q.si ? "flex items-start gap-2 text-tinta-2" : "flex items-start gap-2 text-sutil"}>
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke={q.si ? "#1E7A4C" : "#9AA09B"}
                      strokeWidth="2.4"
                      className="mt-0.5 flex-none"
                      aria-hidden
                    >
                      <path d={q.si ? "M20 6L9 17l-5-5" : "M18 6L6 18M6 6l12 12"} />
                    </svg>
                    {q.texto}
                  </li>
                ))}
              </ul>
            </div>
          </Tarjeta>
          <Tarjeta como="section" className="p-[22px] text-center">
            <div className="mb-1 text-[26px] leading-none font-bold text-navy-700">{busquedas.length}</div>
            <div className="text-[13px] leading-[1.4] text-apagado">
              {busquedas.length === 1 ? "búsqueda activa ahora" : "búsquedas activas ahora"}
            </div>
          </Tarjeta>
        </div>
      </div>
    </>
  );
}
