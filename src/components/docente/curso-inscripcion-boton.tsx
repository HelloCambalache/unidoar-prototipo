"use client";

import { useTransition } from "react";
import { cancelarInscripcion, inscribirseCurso } from "@/app/actions/docente";
import { Boton } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

/**
 * Inscribirse o cancelar la inscripción. La página se vuelve a renderizar sola cuando la acción
 * termina (revalida /docente/cursos), así el botón y las tarjetas muestran el estado real de la base.
 */
export function CursoInscripcionBoton({
  cursoId,
  inscripto,
}: {
  cursoId: string;
  inscripto: boolean;
}) {
  const toast = useToast();
  const [pendiente, empezar] = useTransition();

  const alternar = () =>
    empezar(async () => {
      const r = inscripto ? await cancelarInscripcion(cursoId) : await inscribirseCurso(cursoId);
      if (!r.ok) toast(r.error, "error");
      else toast(inscripto ? "Cancelamos tu inscripción" : "Listo, quedaste inscripto/a en el curso");
    });

  return (
    <Boton
      bloque
      variante={inscripto ? "exito" : "cta"}
      disabled={pendiente}
      aria-busy={pendiente}
      onClick={alternar}
      className="max-w-[320px]"
    >
      {inscripto ? "✓ Ya te inscribiste · Cancelar inscripción" : "Inscribirme al curso"}
    </Boton>
  );
}
