import Link from "next/link";
import { Insignia } from "@/components/ui/insignia";
import { CursoFoto } from "@/components/docente/curso-foto";
import { CursoInscripcionBoton } from "@/components/docente/curso-inscripcion-boton";
import { etiquetaPuntos } from "@/components/docente/curso-tarjeta";
import { etiquetaFechas, hoyArgentina } from "@/lib/fechas-curso";
import { kmLegible } from "@/lib/geo";
import type { CursoVista } from "@/lib/queries/cursos";

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="rounded-tarjeta border border-linea bg-white p-4">
      <div className="mb-1.5 text-[11px] leading-none font-semibold tracking-[.05em] text-sutil uppercase">{etiqueta}</div>
      <div className="text-[15px] leading-[1.3] font-semibold">{valor}</div>
    </div>
  );
}

/** Detalle de un curso (se abre con ?curso=<id>) con el botón de inscripción. */
export function CursoDetalle({ c }: { c: CursoVista }) {
  const terminado = !!c.fechaFinal && c.fechaFinal < hoyArgentina();
  const completado = !!c.terminoEn;

  return (
    <>
      <Link
        href="/docente/cursos"
        className="mb-4 inline-flex items-center gap-1 text-[13px] leading-none font-medium text-sutil hover:text-tinta"
      >
        ‹ Volver a cursos
      </Link>
      <div className="max-w-[1000px]">
        <CursoFoto url={c.fotoUrl} altura={380} redondeada className="max-[760px]:h-[220px]!" />
        <div className="mt-[22px]">
          <h1 className="m-0 mb-1 text-[28px] leading-tight font-semibold tracking-[-0.018em] max-[860px]:text-[24px]">{c.titulo}</h1>
          {c.subtitulo && <div className="mb-1.5 text-[15px] leading-[1.3] font-medium text-navy-700">{c.subtitulo}</div>}
          <div className="mb-[18px] flex flex-wrap items-center gap-2 text-[13px] leading-none text-apagado">
            <Link href={`/docente/instituciones/${c.institucion.slug}`} className="font-medium text-navy-700 hover:underline">
              {c.institucion.nombre}
            </Link>
            {c.certifica && (
              <>
                <Insignia tono="verde">Certificado</Insignia>
                <Insignia className="bg-[#FDF1C7] font-semibold text-[#7A5900]">{etiquetaPuntos(c.puntaje)}</Insignia>
              </>
            )}
            {c.inscripto && !completado && <Insignia tono="azul">Ya te inscribiste</Insignia>}
            {completado && <Insignia tono="verde">Curso completado</Insignia>}
          </div>

          <div className="mb-6 grid grid-cols-4 gap-3.5 max-[760px]:grid-cols-2 max-[700px]:grid-cols-1">
            <Dato etiqueta="Modalidad" valor={c.modalidad} />
            <Dato etiqueta="Dicta" valor={c.profesor || "A confirmar"} />
            <Dato etiqueta="Fechas" valor={etiquetaFechas(c.fechaInicio, c.fechaFinal)} />
            <Dato etiqueta="Horario" valor={c.horario || "A confirmar"} />
          </div>

          {c.modalidad === "Online" ? (
            <p className="m-0 mb-4 text-sm leading-normal text-tinta-2">
              <b className="font-semibold">Link: </b>
              {c.inscripto && c.link ? (
                <a href={c.link} target="_blank" rel="noopener noreferrer" className="break-all font-medium underline">
                  {c.link}
                </a>
              ) : (
                <span className="text-apagado">te lo mostramos cuando te inscribís.</span>
              )}
            </p>
          ) : (
            c.direccion && (
              <p className="m-0 mb-4 text-sm leading-normal text-tinta-2">
                <b className="font-semibold">Dónde: </b>
                {c.direccion}
                {kmLegible(c.distanciaKm) && <span className="text-apagado"> · {kmLegible(c.distanciaKm)} de tus zonas</span>}
              </p>
            )
          )}

          <p className="m-0 mb-6 max-w-[70ch] text-[15px] leading-[1.6] text-tinta-2">
            {c.descripcion || "La institución todavía no cargó una descripción de este curso."}
          </p>

          {completado ? (
            <p className="m-0 text-sm font-semibold text-verde">✓ Ya terminaste este curso.</p>
          ) : terminado && !c.inscripto ? (
            <p className="m-0 text-sm text-apagado">Este curso ya terminó y no admite inscripciones.</p>
          ) : (
            <CursoInscripcionBoton cursoId={c.id} inscripto={c.inscripto} />
          )}
        </div>
      </div>
    </>
  );
}
