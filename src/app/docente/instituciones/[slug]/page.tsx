import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Insignia } from "@/components/ui/insignia";
import { EtiquetaSeccion, Tarjeta } from "@/components/ui/tarjeta";
import { InstitucionCvBoton, InstitucionFavoritoBoton } from "@/components/docente/instituciones-acciones";
import { InstitucionLogo } from "@/components/docente/instituciones-logo";
import { ListaDeSedes } from "@/components/instituciones/lista-de-sedes";
import { MapaDeSedes } from "@/components/instituciones/mapa-de-sedes";
import { VitrinaInstalaciones, VitrinaMisionVision, VitrinaNovedadesLista } from "@/components/institucion/vitrina-secciones";
import { Icono } from "@/components/icons";
import { requerirDocente } from "@/lib/auth";
import { focoDeFoto } from "@/lib/fotos";
import { perfilInstitucion } from "@/lib/queries/instituciones";
import { sedesConUbicacion } from "@/lib/sedes";
import { cn } from "@/lib/utils";

type Props = { params: Promise<{ slug: string }> };

export const metadata: Metadata = { title: "Institución" };

/** Tarjeta blanca de la identidad nueva (radio grande, sin borde). */
const TARJETA = "rounded-panel border-0 p-6 shadow-tarjeta";

const QUE_VE = [
  { texto: "Tu perfil completo y tu CV", si: true },
  { texto: "Tu estado de verificación", si: true },
  { texto: "Tu teléfono, solo si te postulás o le mandás tu CV", si: true },
  { texto: "No compartimos tu DNI ni tus documentos", si: false },
];

export default async function InstitucionPerfilDocentePage({ params }: Props) {
  const { usuario, docente } = await requerirDocente();
  const { slug } = await params;
  const datos = await perfilInstitucion(slug, usuario.id, docente.id);
  if (!datos) notFound();
  const { institucion: i, busquedas, favorita, cvEnviado, fotos, novedades, sedes } = datos;
  const variasSedes = sedes.length > 1;

  const cifras: { valor: string; etiqueta: string; grande: boolean }[] = [];
  if (i.alumnos != null) cifras.push({ valor: String(i.alumnos), etiqueta: "alumnos", grande: true });
  if (i.niveles) cifras.push({ valor: i.niveles, etiqueta: "niveles", grande: false });
  if (i.turnos) cifras.push({ valor: i.turnos, etiqueta: "turnos", grande: false });
  if (i.docentesPlanta != null) cifras.push({ valor: String(i.docentesPlanta), etiqueta: "profesionales en planta", grande: true });
  if (i.fundada != null) cifras.push({ valor: String(i.fundada), etiqueta: "fundación", grande: true });

  // Con una sola sede el mapa muestra su pin; sin ubicación en la sede, el de la ficha de la institución.
  const sedesParaElMapa = sedesConUbicacion(sedes).length > 0 ? sedes : i.lat != null && i.lng != null ? [{ nombre: i.nombre, direccion: i.direccion, zona: i.zona, lat: i.lat, lng: i.lng }] : [];

  return (
    <>
      <Link
        href="/docente/instituciones"
        className="mb-5 inline-flex min-h-10 items-center gap-1.5 self-start rounded-full bg-white pr-4 pl-3 text-sm leading-none font-semibold text-tinta shadow-tarjeta hover:text-rosa"
      >
        <Icono nombre="flecha" tamano={16} trazo={2} className="rotate-180" />
        Instituciones
      </Link>

      <section className="mb-5 rounded-panel bg-white p-2.5 shadow-tarjeta">
        {i.portadaUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- portadas subidas por las instituciones, de tamaños libres
          <img
            src={i.portadaUrl}
            alt={`Foto de ${i.nombre}`}
            style={{ objectPosition: focoDeFoto(i.portadaUrl) }}
            className="block aspect-[16/7] max-h-[340px] w-full rounded-interno object-cover"
          />
        ) : (
          <div aria-hidden className="flex aspect-[16/7] max-h-[340px] w-full items-center justify-center rounded-interno bg-lienzo text-[#C9C6C0]">
            <Icono nombre="imagen" tamano={26} trazo={1.5} />
          </div>
        )}
        {/* Solo el logo se monta sobre la portada; el nombre queda abajo, sobre blanco. */}
        <div className="flex flex-wrap items-start gap-x-5 gap-y-3 px-5 pb-4">
          <InstitucionLogo
            nombre={i.nombre}
            logoUrl={i.logoUrl}
            tamano={104}
            className="relative z-[2] -mt-[52px] rounded-panel border-4 border-white bg-white shadow-[0_8px_24px_rgba(4,11,53,.12)]"
          />
          <div className="min-w-0 flex-[1_1_260px] pt-4">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="font-display m-0 text-[30px] leading-[1.15] font-semibold tracking-[-0.025em] text-navy-900 max-[560px]:text-[24px]">
                {i.nombre}
              </h1>
              {i.verificada && (
                <svg role="img" aria-label="Institución verificada" width="22" height="22" viewBox="0 0 24 24" className="flex-none">
                  <circle cx="12" cy="12" r="10" fill="#16214F" />
                  <path d="M8 12l3 3 5-6" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
            <div className="mt-1 text-[15px] leading-[1.4] text-apagado">
              {[i.tipo, variasSedes ? `${sedes.length} sedes` : i.zona].filter(Boolean).join(" · ")}
            </div>
          </div>
        </div>
        {cifras.length > 0 && (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] border-t border-linea px-2 pt-2">
            {cifras.map((c, n) => (
              <div key={c.etiqueta} className={cn("px-4 py-3", n > 0 && "min-[561px]:border-l min-[561px]:border-linea")}>
                <div className="text-[12px] leading-[1.3] text-apagado">{c.etiqueta}</div>
                <div
                  className={cn(
                    "font-display mt-1 font-semibold text-tinta",
                    c.grande ? "text-[20px] leading-none" : "text-[15px] leading-[1.3]",
                  )}
                >
                  {c.valor}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="flex flex-wrap items-start gap-5">
        <div className="flex min-w-[340px] flex-[2] flex-col gap-5 max-[860px]:min-w-0 max-[860px]:basis-full [&>section]:mb-0">
          <section className="rounded-panel bg-white p-6 shadow-tarjeta">
            <div className="mb-4 flex items-baseline justify-between gap-3">
              <h2 className="font-display m-0 text-[18px] leading-[1.3] font-semibold text-navy-900">Búsquedas abiertas</h2>
              <span className="text-[13px] text-apagado">
                {busquedas.length === 1 ? "1 activa" : `${busquedas.length} activas`}
              </span>
            </div>
            {busquedas.length === 0 ? (
              <p className="m-0 text-sm leading-normal text-apagado">
                Hoy no tiene búsquedas activas. Guardala para enterarte cuando publique una nueva.
              </p>
            ) : (
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {busquedas.map((b) => (
                  <li key={b.id}>
                    <Link
                      href={`/docente/oferta/${b.id}`}
                      className="group flex items-center gap-3.5 rounded-interno bg-[#F7F6F2] p-3.5 text-tinta transition-colors hover:bg-lienzo hover:text-tinta"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="font-display block text-[15px] leading-[1.3] font-semibold">{b.puesto}</span>
                        <span className="mt-0.5 block text-[13px] leading-[1.3] text-apagado">
                          {[b.sede, b.tipo, b.turno].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                      {b.rapida && <Insignia tono="naranja">Rápida</Insignia>}
                      <span
                        aria-hidden
                        className="inline-flex size-10 flex-none items-center justify-center rounded-xl bg-white transition-colors group-hover:bg-navy-900 group-hover:text-white"
                      >
                        <Icono nombre="flecha" tamano={16} trazo={2} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <Tarjeta como="section" className={TARJETA}>
            <h2 className="font-display m-0 mb-2 text-[18px] font-semibold text-navy-900">Sobre la institución</h2>
            <p className="m-0 text-[15px] leading-[1.6] text-tinta-2">
              {i.descripcion || "Todavía no cargó una descripción."}
            </p>
          </Tarjeta>

          <VitrinaMisionVision mision={i.mision} vision={i.vision} valores={i.valores} />
          <VitrinaInstalaciones fotos={fotos} nombre={i.nombre} />
          <VitrinaNovedadesLista novedades={novedades} />

          {variasSedes && (
            <Tarjeta como="section" className={TARJETA}>
              <h2 className="font-display m-0 mb-3 text-[18px] font-semibold text-navy-900">Sedes</h2>
              <ListaDeSedes sedes={sedes} />
              {i.horarioAdministracion && (
                <div className="mt-3 text-[13px] leading-[1.4] text-apagado">{`Horario de administración: ${i.horarioAdministracion}`}</div>
              )}
            </Tarjeta>
          )}

          {!variasSedes && (
            <Tarjeta como="section" className={TARJETA}>
              <h2 className="font-display m-0 mb-3 text-[18px] font-semibold text-navy-900">Dónde queda</h2>
              <div className="flex items-center gap-3.5">
                <span className="inline-flex size-11 flex-none items-center justify-center rounded-caja bg-rosa-tint text-rosa">
                  <Icono nombre="ubicacion" tamano={20} trazo={1.8} />
                </span>
                <div className="min-w-0 text-[13.5px] leading-[1.45]">
                  {i.direccion && <div className="font-display text-[15.5px] font-semibold text-tinta">{i.direccion}</div>}
                  <div className="text-apagado">{i.zona ?? "Zona a confirmar"}</div>
                </div>
              </div>
              <MapaDeSedes sedes={sedesParaElMapa} className="mt-3.5" />
              {i.horarioAdministracion && (
                <div className="mt-3 text-[13px] leading-[1.4] text-apagado">{`Horario de administración: ${i.horarioAdministracion}`}</div>
              )}
            </Tarjeta>
          )}
        </div>

        <aside className="flex min-w-[300px] flex-1 flex-col gap-5 max-[860px]:min-w-0 max-[860px]:basis-full">
          <Tarjeta como="section" className={TARJETA}>
            <h2 className="font-display m-0 mb-4 text-[17px] leading-[1.3] font-semibold text-navy-900">
              Enviá tu CV a esta institución
            </h2>
            <InstitucionCvBoton institucionId={i.id} enviado={cvEnviado} />
            <InstitucionFavoritoBoton institucionId={i.id} favorita={favorita} nombre={i.nombre} className="w-full" />
            <div className="mt-5 rounded-interno bg-[#F7F6F2] px-4 py-4">
              <EtiquetaSeccion className="text-apagado">Qué va a ver la institución</EtiquetaSeccion>
              <ul className="m-0 flex list-none flex-col gap-2 p-0 text-[13px] leading-[1.4]">
                {QUE_VE.map((q) => (
                  <li key={q.texto} className={q.si ? "flex items-start gap-2 text-tinta-2" : "flex items-start gap-2 text-apagado"}>
                    <Icono nombre={q.si ? "tilde" : "cerrar"} tamano={14} trazo={2.4} className={q.si ? "mt-0.5 text-verde" : "mt-0.5 text-sutil"} />
                    {q.texto}
                  </li>
                ))}
              </ul>
            </div>
          </Tarjeta>
        </aside>
      </div>
    </>
  );
}
