"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { borrarCurso } from "@/app/actions/cursos";
import { Boton } from "@/components/ui/button";
import { useConfirmacion } from "@/components/ui/confirmacion";
import { useToast } from "@/components/ui/toast";
import { etiquetaInscriptos } from "@/lib/cursos";

/**
 * Borra el curso. Con inscriptos pide confirmación y deja claro que se les avisa; si alguien ya lo
 * terminó (o recibió el certificado) no se ofrece: el curso es parte de su formación.
 */
export function CursoBorrar({
  cursoId,
  titulo,
  inscriptos,
  conTerminados,
}: {
  cursoId: string;
  titulo: string;
  inscriptos: number;
  /** Hay inscriptos que terminaron el curso o ya tienen su certificado. */
  conTerminados: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const pedirConfirmacion = useConfirmacion();
  const [pendiente, empezar] = useTransition();

  const borrar = async () => {
    const aviso =
      inscriptos > 0
        ? `«${titulo}» tiene ${etiquetaInscriptos(inscriptos).toLowerCase()}. Si lo borrás, se les avisa que el curso se canceló y pierden su inscripción. Esto no se puede deshacer. ¿Borrarlo?`
        : `¿Borrar «${titulo}»? Esto no se puede deshacer.`;
    if (!(await pedirConfirmacion(aviso))) return;
    empezar(async () => {
      try {
        const r = await borrarCurso(cursoId, inscriptos > 0);
        if (!r.ok) {
          toast(r.error, "error");
          // Quizás se anotó alguien mientras tanto: se vuelve a leer para que el aviso de arriba sea el actual.
          router.refresh();
          return;
        }
        toast("Curso borrado");
        router.push("/institucion/cursos");
      } catch {
        toast("No pudimos borrar el curso. Probá de nuevo.", "error");
      }
    });
  };

  return (
    <section aria-labelledby="borrar-curso" className="mt-8 max-w-[900px] rounded-tarjeta border border-linea bg-white p-[18px]">
      <h2 id="borrar-curso" className="m-0 mb-1 text-sm leading-[1.3] font-semibold">
        Borrar este curso
      </h2>
      {conTerminados ? (
        <p className="m-0 text-[13px] leading-normal text-apagado">
          No se puede borrar porque hay profesionales que ya lo terminaron o recibieron su certificado: el curso forma parte de su
          formación en UNIDOAR.
        </p>
      ) : (
        <>
          <p className="m-0 mb-3.5 text-[13px] leading-normal text-apagado">
            {inscriptos > 0
              ? `Tiene ${etiquetaInscriptos(inscriptos).toLowerCase()}: si lo borrás, les llega un aviso de que se canceló.`
              : "Nadie se anotó todavía. Al borrarlo deja de aparecer en el catálogo de cursos."}
          </p>
          <Boton
            variante="secundario"
            tamano="sm"
            onClick={borrar}
            disabled={pendiente}
            aria-busy={pendiente}
            className="border-[#f3c9c9] text-[#b91c1c] hover:border-[#b91c1c] hover:bg-[#fef2f2]"
          >
            {pendiente ? "Borrando…" : "Borrar curso"}
          </Boton>
        </>
      )}
    </section>
  );
}
