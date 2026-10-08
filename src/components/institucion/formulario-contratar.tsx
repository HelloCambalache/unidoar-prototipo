"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { contratarPostulacion } from "@/app/actions/pipeline";
import { Boton } from "@/components/ui/button";
import { Campo, Casilla, Input } from "@/components/ui/campos";

/** Confirmación de contratación: fecha de inicio (se la contamos al docente) y cerrar o no la búsqueda. */
export function FormularioContratar({
  postulacionId,
  busquedaId,
  puesto,
  inicioPorDefecto,
  puedeCerrar,
  faltaExamen,
}: {
  postulacionId: string;
  busquedaId: string;
  puesto: string;
  inicioPorDefecto: string;
  /** false si la búsqueda ya está cerrada. */
  puedeCerrar: boolean;
  /** Está en "Examen preocupacional" y todavía no se anotó que lo hizo: hay que confirmar para contratarla igual. */
  faltaExamen: boolean;
}) {
  const [estado, formAction, pendiente] = useActionState(contratarPostulacion.bind(null, postulacionId), null);
  const [inicio, setInicio] = useState(inicioPorDefecto);
  const [cerrar, setCerrar] = useState(true);
  const [sinExamen, setSinExamen] = useState(false);

  return (
    <form action={formAction} className="flex flex-col gap-3.5">
      <Campo etiqueta="Fecha de inicio" ayuda="Se la mostramos al profesional en la notificación." error={estado?.campos?.inicio}>
        <Input type="date" name="inicio" value={inicio} onChange={(e) => setInicio(e.target.value)} />
      </Campo>
      {faltaExamen && (
        <div className="flex flex-col gap-2 rounded-lg bg-[#FDE9D8] px-3.5 py-3 text-[13.5px] leading-snug text-[#9A4A12]">
          <p className="m-0 font-semibold">Todavía no anotaste que hizo el examen preocupacional.</p>
          <Casilla name="sinExamen" checked={sinExamen} onChange={(e) => setSinExamen(e.target.checked)}>
            Contratarla igual, sin el examen.
          </Casilla>
          {estado?.campos?.sinExamen && (
            <p role="alert" className="m-0 text-xs text-[#b91c1c]">
              {estado.campos.sinExamen}
            </p>
          )}
        </div>
      )}
      {puedeCerrar && (
        <Casilla name="cerrar" checked={cerrar} onChange={(e) => setCerrar(e.target.checked)}>
          Cerrar la búsqueda «{puesto}» al confirmar. Si todavía necesitás cubrir más cargos, destildalo.
        </Casilla>
      )}
      {estado && !estado.campos && (
        <p role="alert" className="m-0 text-[13px] text-[#b91c1c]">
          {estado.error}
        </p>
      )}
      <Boton type="submit" variante="cta" bloque disabled={pendiente} aria-busy={pendiente}>
        {pendiente ? "Confirmando…" : "Confirmar contratación"}
      </Boton>
      <Link
        href={`/institucion/postulantes?busqueda=${busquedaId}`}
        className="text-center text-[13px] font-medium text-sutil hover:text-tinta"
      >
        Volver al pipeline
      </Link>
    </form>
  );
}
