import Link from "next/link";
import { Insignia } from "@/components/ui/insignia";
import { lugarDeCurso } from "@/lib/cursos";
import { etiquetaFechas, fechaLarga } from "@/lib/fechas-curso";
import type { CursoHistorial, EstadoCursado } from "@/lib/queries/cursos";
import { cn } from "@/lib/utils";

const ESTADO: Record<EstadoCursado, { texto: string; tono: "verde" | "neutro" | "azul" | "ambar" }> = {
  completado: { texto: "Completado", tono: "verde" },
  "en-curso": { texto: "En curso", tono: "neutro" },
  "por-empezar": { texto: "Por empezar", tono: "azul" },
  finalizado: { texto: "Finalizó", tono: "ambar" },
};

export function certificadoDe(c: CursoHistorial) {
  if (!c.certifica) return { texto: "Sin certificado", clase: "text-sutil" };
  if (c.certificadoEnviado) return { texto: "Certificado enviado", clase: "text-verde font-semibold" };
  if (c.estado === "completado") return { texto: "Certificado pendiente de envío", clase: "text-apagado" };
  if (c.estado === "finalizado") return { texto: "A la espera de que la institución confirme que lo terminaste", clase: "text-apagado" };
  return { texto: "Lo recibís al terminar el curso", clase: "text-apagado" };
}

function progreso(c: CursoHistorial) {
  if (c.estado === "completado") return c.terminoEn ? `Terminó el ${fechaLarga(c.terminoEn)}` : "Completado";
  if (c.estado === "por-empezar") return `Empieza el ${etiquetaFechas(c.fechaInicio)}`;
  if (c.estado === "finalizado") return "Terminó el cursado";
  return `Avanzó ${c.avance}% del cursado`;
}

/** Pestaña "Mis cursos": uno por inscripción, con estado, avance estimado por fechas y certificado. */
export function CursoHistorialLista({ cursos }: { cursos: CursoHistorial[] }) {
  return (
    <ul className="m-0 flex min-w-[340px] flex-1 list-none flex-col gap-2.5 p-0 max-[860px]:min-w-0">
      {cursos.map((c) => {
        const estado = ESTADO[c.estado];
        const cert = certificadoDe(c);
        return (
          <li key={c.id} className="rounded-tarjeta border border-linea bg-white px-[18px] py-4">
            <div className="mb-2.5 flex flex-wrap items-center gap-3">
              <div className="min-w-[180px] flex-1">
                <div className="mb-[3px] flex flex-wrap items-center gap-2">
                  <Link
                    href={`/docente/cursos?curso=${c.id}`}
                    className="text-[15px] leading-[1.3] font-semibold text-tinta hover:text-navy-700 hover:underline"
                  >
                    {c.titulo}
                  </Link>
                  <Insignia tono={estado.tono}>{estado.texto}</Insignia>
                </div>
                <div className="text-[13px] leading-[1.4] text-apagado">
                  {[c.institucion.nombre, etiquetaFechas(c.fechaInicio, c.fechaFinal), lugarDeCurso(c) ?? "Dirección a confirmar"].join(" · ")}
                </div>
              </div>
              <span className="text-[13px] leading-none font-semibold text-tinta-2">{progreso(c)}</span>
            </div>
            <div
              role="progressbar"
              aria-label={`Avance de ${c.titulo}`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={c.avance}
              className="mb-3 h-1.5 overflow-hidden rounded-full bg-[#F0EFEA]"
            >
              <div
                className={cn("h-1.5 rounded-full", c.estado === "completado" ? "bg-verde" : "bg-navy-700")}
                style={{ width: `${c.avance}%` }}
              />
            </div>
            <span className={cn("text-[13px] leading-none font-medium", cert.clase)}>{cert.texto}</span>
          </li>
        );
      })}
    </ul>
  );
}
