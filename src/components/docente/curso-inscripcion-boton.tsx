"use client";

import { useTransition } from "react";
import { cancelarInscripcion, inscribirseCurso } from "@/app/actions/docente";
import { Icono } from "@/components/icons";
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

  if (inscripto) {
    return (
      <div className="flex max-w-[420px] flex-wrap items-center gap-x-4 gap-y-2">
        <span className="inline-flex min-h-12 items-center gap-2 rounded-full bg-verde-tint px-5 text-[15px] font-semibold text-verde">
          <Icono nombre="tilde" tamano={16} trazo={2.6} />
          Ya estás inscripto/a
        </span>
        <button
          type="button"
          onClick={alternar}
          disabled={pendiente}
          aria-busy={pendiente}
          className="rounded-full px-2 py-1 text-[13.5px] font-semibold text-apagado underline-offset-4 hover:text-tinta hover:underline focus-visible:ring-[3px] focus-visible:ring-navy-700/30 focus-visible:outline-none disabled:opacity-50"
        >
          {pendiente ? "Cancelando…" : "Cancelar inscripción"}
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={alternar}
      disabled={pendiente}
      aria-busy={pendiente}
      className="group inline-flex min-h-[52px] w-full max-w-[340px] items-center justify-center gap-2.5 rounded-full bg-naranja px-7 text-[16px] font-semibold text-white shadow-[0_8px_20px_rgba(221,85,63,.28)] transition-[background-color,transform,box-shadow] hover:-translate-y-0.5 hover:bg-[#c44a35] hover:shadow-[0_12px_26px_rgba(221,85,63,.34)] focus-visible:ring-[3px] focus-visible:ring-naranja/40 focus-visible:outline-none disabled:translate-y-0 disabled:opacity-60"
    >
      <Icono nombre="cursos" tamano={18} trazo={2} />
      {pendiente ? "Inscribiéndote…" : "Inscribirme al curso"}
      <Icono nombre="flecha" tamano={17} trazo={2.2} className="transition-transform group-hover:translate-x-0.5" />
    </button>
  );
}
