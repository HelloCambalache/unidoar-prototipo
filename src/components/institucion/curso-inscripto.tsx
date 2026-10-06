import Link from "next/link";
import { marcarTermino, enviarCertificado } from "@/app/actions/cursos";
import { BotonAccion } from "@/components/institucion/boton-accion";
import { Avatar, Insignia } from "@/components/ui/insignia";
import { fechaDeInput } from "@/lib/fechas";
import type { InscriptoCurso } from "@/lib/queries/cursos-institucion";
import { cn } from "@/lib/utils";

/**
 * Una persona anotada en el curso: si lo está cursando o ya lo terminó, y qué falta con su certificado.
 * Las acciones (marcar que terminó, enviar el certificado) son server actions ya atadas a esta inscripción.
 */
export function CursoInscripto({
  cursoId,
  i,
  certifica,
  puntos,
  empezo,
}: {
  cursoId: string;
  i: InscriptoCurso;
  certifica: boolean;
  puntos: number;
  /** El curso ya empezó: antes no se puede marcar que alguien lo terminó. */
  empezo: boolean;
}) {
  const terminado = !!i.terminoEn;
  const certificado = !certifica
    ? { texto: "Sin certificado", clase: "text-sutil" }
    : i.certificadoEnviado
      ? { texto: "Certificado enviado", clase: "font-semibold text-verde" }
      : terminado
        ? { texto: "Sin enviar", clase: "text-apagado" }
        : { texto: "Al terminar el curso", clase: "text-apagado" };

  return (
    <li className="flex flex-wrap items-center gap-3.5 rounded-[10px] border border-borde bg-white px-[18px] py-4">
      <div className="min-w-0 flex-[1_1_240px]">
        <div className="mb-1.5 flex items-center gap-2.5">
          <Avatar iniciales={i.iniciales} fotoUrl={i.fotoUrl} tamano={32} />
          <div className="min-w-0">
            {i.perfilVisible ? (
              <Link
                href={`/institucion/docente/${i.docenteId}`}
                className="block truncate text-[15px] leading-[1.3] font-semibold text-tinta hover:text-navy-700 hover:underline"
              >
                {i.nombre}
              </Link>
            ) : (
              <span className="block truncate text-[15px] leading-[1.3] font-semibold">{i.nombre}</span>
            )}
            <span className="block text-xs leading-[1.4] text-apagado">
              {i.categoria} · se inscribió el {i.inscriptoEl}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Insignia tono={terminado ? "verde" : "neutro"}>
            {terminado ? `Terminó el ${fechaDeInput(i.terminoEn!)}` : "Cursando"}
          </Insignia>
          {certifica && <Insignia className="bg-[#FDF1C7] font-semibold text-[#7A5900]">+{puntos} puntos</Insignia>}
        </div>
      </div>

      <div className="flex flex-none flex-col items-end gap-1.5 text-right max-[560px]:w-full max-[560px]:items-stretch max-[560px]:text-left">
        <div className={cn("text-[12.5px] leading-[1.4]", certificado.clase)}>{certificado.texto}</div>
        {!terminado && empezo && (
          <BotonAccion
            accion={marcarTermino.bind(null, cursoId, i.docenteId, true)}
            exito={`${i.nombre} figura como que terminó el curso.`}
          >
            Marcar que terminó
          </BotonAccion>
        )}
        {terminado && certifica && !i.certificadoEnviado && (
          <BotonAccion
            accion={enviarCertificado.bind(null, cursoId, i.docenteId)}
            exito={`Certificado enviado a ${i.nombre}.`}
            variante="primario"
          >
            Enviar certificado
          </BotonAccion>
        )}
        {terminado && !i.certificadoEnviado && (
          <BotonAccion
            accion={marcarTermino.bind(null, cursoId, i.docenteId, false)}
            exito="Listo, vuelve a figurar como cursando."
            variante="fantasma"
            confirmar={`¿Volver a marcar a ${i.nombre} como que está cursando?`}
          >
            Deshacer
          </BotonAccion>
        )}
      </div>
    </li>
  );
}
