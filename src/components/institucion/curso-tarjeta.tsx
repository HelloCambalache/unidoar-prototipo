import { BotonLink } from "@/components/ui/button";
import { Insignia } from "@/components/ui/insignia";
import { CursoFoto } from "@/components/docente/curso-foto";
import { etiquetaInscriptos } from "@/lib/cursos";
import { etiquetaFechas } from "@/lib/fechas-curso";
import { focoDeFoto } from "@/lib/fotos";
import type { CursoDeInstitucion } from "@/lib/queries/cursos-institucion";

/** Una fila del listado "Mis cursos": foto, datos del curso y, al costado, cuántos se anotaron y las acciones. */
export function CursoTarjeta({ c }: { c: CursoDeInstitucion }) {
  return (
    <article className="flex gap-4 rounded-ud border border-borde bg-white p-[18px] max-[860px]:flex-wrap">
      {c.fotoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- fotos subidas por la institución, de tamaños libres
        <img
          src={c.fotoUrl}
          alt=""
          style={{ objectPosition: focoDeFoto(c.fotoUrl) }}
          className="block min-h-[130px] w-[220px] flex-none self-stretch rounded-lg object-cover max-[860px]:h-[150px] max-[860px]:w-full max-[860px]:self-auto"
        />
      ) : (
        <div className="w-[220px] flex-none overflow-hidden rounded-lg max-[860px]:w-full">
          <CursoFoto url={null} altura={150} />
        </div>
      )}

      <div className="min-w-0 flex-1 max-[860px]:basis-full">
        <div className="mb-0.5 flex flex-wrap items-center gap-2">
          <span className="text-base leading-[1.3] font-semibold">{c.titulo}</span>
          <Insignia tono={c.modalidad === "Online" ? "azul" : "neutro"}>{c.modalidad}</Insignia>
          {c.finalizado && <Insignia>Finalizado</Insignia>}
        </div>
        {c.subtitulo && <div className="mb-1.5 text-[13px] leading-[1.3] font-medium text-navy-700">{c.subtitulo}</div>}
        {c.descripcion && <p className="m-0 mb-2 line-clamp-3 text-[13px] leading-normal text-apagado">{c.descripcion}</p>}
        <div className="text-[12.5px] leading-normal text-apagado">
          Dicta: <b className="font-semibold text-tinta-2">{c.profesor || "A confirmar"}</b> ·{" "}
          {etiquetaFechas(c.fechaInicio, c.fechaFinal)} · {c.horario || "Horario a confirmar"}
        </div>
      </div>

      <div className="w-[216px] flex-none border-l border-borde pl-4 max-[860px]:w-full max-[860px]:border-t max-[860px]:border-l-0 max-[860px]:pt-3.5 max-[860px]:pl-0">
        <div className="mb-1.5 text-[13px] leading-none font-semibold text-navy-700">{etiquetaInscriptos(c.inscriptos)}</div>
        {c.terminaron > 0 && (
          <div className="text-xs leading-none text-sutil">
            {c.terminaron === 1 ? "1 ya lo terminó" : `${c.terminaron} ya lo terminaron`}
          </div>
        )}
        <div className="mt-3.5 flex flex-col gap-2 border-t border-borde pt-3">
          <BotonLink href={`/institucion/cursos/${c.id}`} variante="secundario" tamano="sm" bloque>
            Ver curso
          </BotonLink>
          <BotonLink href={`/institucion/cursos/${c.id}/editar`} variante="secundario" tamano="sm" bloque>
            Editar curso
          </BotonLink>
          <BotonLink href={`/institucion/cursos/${c.id}/inscriptos`} variante="secundario" tamano="sm" bloque>
            Detalle de inscriptos
          </BotonLink>
        </div>
      </div>
    </article>
  );
}
