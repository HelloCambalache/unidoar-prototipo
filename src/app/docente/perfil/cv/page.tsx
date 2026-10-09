import type { Metadata } from "next";
import { PerfilCvAcciones } from "@/components/docente/perfil-cv-acciones";
import { CATEGORIA_INFO } from "@/lib/catalogo";
import { docenteActual, requerirDocente } from "@/lib/auth";
import { etiquetaFechas } from "@/lib/fechas-curso";
import { resumenDisponibilidad } from "@/lib/onboarding";
import { focoDeFoto } from "@/lib/fotos";
import { historialCursos } from "@/lib/queries/cursos";
import { grillaDelDocente } from "@/lib/queries/docente";
import { iniciales } from "@/lib/utils";

/** El título de la pestaña es el nombre que sugiere el navegador al guardar el PDF. */
export async function generateMetadata(): Promise<Metadata> {
  const docente = await docenteActual();
  const nombre = docente ? `${docente.nombre} ${docente.apellido}`.trim() : "Mi CV";
  return { title: { absolute: `CV - ${nombre}` } };
}

/*
 * Al imprimir se oculta todo el marco de la app (header, menú) y el contenedor deja de ser una
 * pantalla con scroll. `@page` sin margen saca el encabezado y pie del navegador; el margen real
 * lo da el padding de la hoja.
 */
const ESTILOS_IMPRESION = `
@media print {
  @page { size: A4; margin: 0; }
  html, body { background: #fff !important; height: auto !important; }
  .h-screen > header, .h-screen aside, [data-no-imprimir] { display: none !important; }
  .h-screen, .h-screen > div { display: block !important; height: auto !important; overflow: visible !important; }
  main { display: block !important; padding: 0 !important; overflow: visible !important; }
  main > * { max-width: none !important; }
  #cv-hoja { border: 0 !important; border-radius: 0 !important; box-shadow: none !important; margin: 0 !important; max-width: none !important; padding: 14mm !important; }
  #cv-hoja section, #cv-hoja li { break-inside: avoid; }
}
`;

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="m-0 mb-2.5 border-b border-borde pb-1.5 text-[11px] leading-none font-semibold tracking-[.08em] text-sutil uppercase">
        {titulo}
      </h2>
      {children}
    </section>
  );
}

export default async function CvImprimiblePage({ searchParams }: Props) {
  const { usuario, docente } = await requerirDocente();
  const { imprimir } = await searchParams;
  const [grilla, historial] = await Promise.all([grillaDelDocente(docente), historialCursos(docente.id)]);

  const nombre = `${docente.nombre} ${docente.apellido}`.trim();
  const disponibilidad = resumenDisponibilidad(grilla);
  const cursosHechos = historial.filter((c) => c.estado === "completado");
  const contacto = [docente.telefono, docente.email ?? usuario.email, docente.zonas.join(", ")].filter(Boolean);

  return (
    <>
      <style>{ESTILOS_IMPRESION}</style>
      <PerfilCvAcciones imprimirAlAbrir={imprimir === "1"} />
      <article
        id="cv-hoja"
        className="mx-auto w-full max-w-[820px] rounded-lg border border-borde bg-white p-6 text-tinta shadow-[0_2px_10px_rgba(31,36,33,.06)] sm:p-10"
      >
        <header className="flex items-center gap-[18px]">
          {docente.fotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- foto de perfil para la hoja de impresión
            <img src={docente.fotoUrl} alt="" style={{ objectPosition: focoDeFoto(docente.fotoUrl) }} className="size-20 flex-none rounded-full object-cover" />
          ) : (
            <span
              aria-hidden
              className="inline-flex size-20 flex-none items-center justify-center rounded-full bg-navy-50 text-2xl font-semibold text-navy-700"
            >
              {iniciales(nombre)}
            </span>
          )}
          <div className="min-w-0">
            <h1 className="font-display m-0 text-[28px] leading-[1.15] font-bold tracking-[-0.02em]">{nombre}</h1>
            {docente.subtitulo && <p className="m-0 mt-1 text-[15px] leading-[1.4] text-apagado">{docente.subtitulo}</p>}
            <p className="m-0 mt-1 text-[13px] leading-[1.4] font-semibold" style={{ color: CATEGORIA_INFO[docente.categoria].ink }}>
              {CATEGORIA_INFO[docente.categoria].label}
              {docente.aniosExperiencia != null && ` · ${docente.aniosExperiencia} ${docente.aniosExperiencia === 1 ? "año" : "años"} de experiencia`}
              {docente.verificacion === "verificado" && " · Perfil verificado en UNIDOAR"}
            </p>
          </div>
        </header>
        {contacto.length > 0 && <p className="m-0 mt-3.5 text-[13px] leading-normal text-tinta-2">{contacto.join("  ·  ")}</p>}

        {docente.resumen && (
          <Seccion titulo="Resumen profesional">
            <p className="m-0 text-sm leading-[1.6] whitespace-pre-line text-tinta-2">{docente.resumen}</p>
          </Seccion>
        )}

        {docente.experiencia.length > 0 && (
          <Seccion titulo="Experiencia">
            <ul className="m-0 flex list-none flex-col gap-3.5 p-0">
              {docente.experiencia.map((e, i) => (
                <li key={i}>
                  <div className="text-sm leading-[1.3] font-semibold">{e.titulo}</div>
                  {e.fechas && <div className="text-xs leading-[1.4] text-sutil">{e.fechas}</div>}
                  {e.desc && <p className="m-0 mt-1 text-[13px] leading-normal whitespace-pre-line text-tinta-2">{e.desc}</p>}
                </li>
              ))}
            </ul>
          </Seccion>
        )}

        {docente.formacion.length > 0 && (
          <Seccion titulo="Formación">
            <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
              {docente.formacion.map((f, i) => (
                <li key={i}>
                  <div className="text-[13.5px] leading-[1.3] font-semibold">{f.titulo}</div>
                  {f.detalle && <div className="text-xs leading-[1.4] text-apagado">{f.detalle}</div>}
                </li>
              ))}
            </ul>
          </Seccion>
        )}

        {cursosHechos.length > 0 && (
          <Seccion titulo="Cursos realizados en UNIDOAR">
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {cursosHechos.map((c) => (
                <li key={c.id}>
                  <div className="text-[13.5px] leading-[1.3] font-semibold">{c.titulo}</div>
                  <div className="text-xs leading-[1.4] text-apagado">
                    {c.institucion.nombre} · {etiquetaFechas(c.fechaInicio, c.fechaFinal)}
                    {c.certificadoEnviado && " · Con certificado"}
                  </div>
                </li>
              ))}
            </ul>
          </Seccion>
        )}

        {(docente.asignaturas.length > 0 || docente.niveles.length > 0) && (
          <Seccion titulo="Asignaturas y niveles">
            {docente.asignaturas.length > 0 && (
              <p className="m-0 text-[13.5px] leading-normal text-tinta-2">
                <b className="font-semibold">Asignaturas: </b>
                {docente.asignaturas.join(", ")}
              </p>
            )}
            {docente.niveles.length > 0 && (
              <p className="m-0 mt-1 text-[13.5px] leading-normal text-tinta-2">
                <b className="font-semibold">Niveles: </b>
                {docente.niveles.join(", ")}
              </p>
            )}
          </Seccion>
        )}

        {disponibilidad.length > 0 && (
          <Seccion titulo="Disponibilidad">
            {disponibilidad.map((r) => (
              <p key={r.titulo} className="m-0 mb-1 text-[13.5px] leading-normal text-tinta-2">
                <b className="font-semibold">{r.titulo}: </b>
                {r.texto}
              </p>
            ))}
          </Seccion>
        )}

        <p className="m-0 mt-8 border-t border-borde pt-3 text-[11px] leading-normal text-sutil">
          CV generado desde el perfil de UNIDOAR
        </p>
      </article>
    </>
  );
}
