import Link from "next/link";
import { Insignia } from "@/components/ui/insignia";
import { CursoFoto } from "@/components/docente/curso-foto";
import { CursoInscripcionBoton } from "@/components/docente/curso-inscripcion-boton";
import { etiquetaPuntos } from "@/components/docente/curso-tarjeta";
import { Icono } from "@/components/icons";
import { esEnlaceWeb, lugarDeCurso } from "@/lib/cursos";
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
  const online = c.modalidad === "Online";
  const lugar = lugarDeCurso(c);

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

          {/* El lugar va siempre, destacado y antes de inscribirse: un curso presencial sin dirección lo avisa en vez de callarse. */}
          <section
            aria-labelledby="curso-lugar"
            className="mb-6 flex items-start gap-3.5 rounded-tarjeta border border-linea bg-white p-4"
          >
            <span className="flex size-10 flex-none items-center justify-center rounded-caja bg-navy-50 text-navy-700">
              <Icono nombre={online ? "videollamada" : "ubicacion"} tamano={20} trazo={1.8} />
            </span>
            <div className="min-w-0 flex-1 text-sm leading-normal text-tinta-2">
              <h2
                id="curso-lugar"
                className="m-0 mb-1.5 text-[11px] leading-none font-semibold tracking-[.05em] text-sutil uppercase"
              >
                Dónde se dicta
              </h2>
              {online ? (
                <>
                  <div className="text-base leading-[1.35] font-semibold text-tinta">Online</div>
                  <p className="m-0 mt-1">
                    <b className="font-semibold">Link: </b>
                    {c.inscripto ? (
                      c.link ? (
                        esEnlaceWeb(c.link) ? (
                          <a href={c.link} target="_blank" rel="noopener noreferrer" className="break-all font-medium underline">
                            {c.link}
                          </a>
                        ) : (
                          // Un valor que no es http(s) se muestra como texto, nunca como enlace.
                          <span className="break-all font-medium">{c.link}</span>
                        )
                      ) : (
                        <span className="text-apagado">la institución todavía no lo cargó; lo vas a ver acá apenas lo cargue.</span>
                      )
                    ) : (
                      <span className="text-apagado">te lo mostramos cuando te inscribís.</span>
                    )}
                    {c.inscripto && c.link && c.linkClave && (
                      <>
                        <br />
                        <b className="font-semibold">Contraseña o código: </b>
                        <code className="rounded-md bg-lienzo px-1.5 py-0.5 font-medium text-tinta select-all">{c.linkClave}</code>
                      </>
                    )}
                  </p>
                </>
              ) : lugar ? (
                <>
                  <div className="text-base leading-[1.35] font-semibold text-tinta">{lugar}</div>
                  {kmLegible(c.distanciaKm) && <div className="mt-0.5 text-apagado">{kmLegible(c.distanciaKm)} de tus zonas</div>}
                </>
              ) : (
                <p className="m-0">
                  <span className="font-semibold text-tinta">La institución todavía no cargó la dirección de este curso.</span>{" "}
                  Podés consultarla en el{" "}
                  <Link href={`/docente/instituciones/${c.institucion.slug}`} className="font-medium text-navy-700 underline">
                    perfil de {c.institucion.nombre}
                  </Link>
                  .
                </p>
              )}
            </div>
          </section>

          <p className="m-0 mb-6 max-w-[70ch] text-[15px] leading-[1.6] text-tinta-2">
            {c.descripcion || "La institución todavía no cargó una descripción de este curso."}
          </p>

          {completado ? (
            <p className="m-0 text-sm font-semibold text-verde">✓ Ya terminaste este curso.</p>
          ) : terminado && !c.inscripto ? (
            <p className="m-0 text-sm text-apagado">Este curso ya terminó y no admite inscripciones.</p>
          ) : (
            <CursoInscripcionBoton cursoId={c.id} inscripto={c.inscripto} lugar={online ? null : lugar} />
          )}
        </div>
      </div>
    </>
  );
}
