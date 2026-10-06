"use client";

import { useOptimistic, useTransition } from "react";
import { alternarFavoritoInstitucion, enviarCvAInstitucion } from "@/app/actions/docente";
import { Boton } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

/** "Guardar" una institución en favoritas: responde al instante y se corrige solo si la acción falla. */
export function InstitucionFavoritoBoton({
  institucionId,
  favorita,
  nombre,
  className,
}: {
  institucionId: string;
  favorita: boolean;
  nombre: string;
  className?: string;
}) {
  const toast = useToast();
  const [guardada, setGuardada] = useOptimistic(favorita);
  const [pendiente, empezar] = useTransition();

  const alternar = () => {
    if (pendiente) return;
    empezar(async () => {
      setGuardada(!guardada);
      const r = await alternarFavoritoInstitucion(institucionId);
      if (!r.ok) toast(r.error, "error");
    });
  };

  return (
    <Boton
      variante="secundario"
      aria-pressed={guardada}
      aria-label={guardada ? `Quitar de guardadas: ${nombre}` : `Guardar: ${nombre}`}
      onClick={alternar}
      className={cn(guardada && "border-rosa/40 bg-rosa-tint text-rosa hover:border-rosa/60 hover:bg-rosa-tint", className)}
    >
      <span aria-hidden>{guardada ? "★" : "☆"}</span>
      {guardada ? "Guardada" : "Guardar"}
    </Boton>
  );
}

/** Estrella de favorita en la tarjeta del catálogo: responde al instante y se corrige sola si la acción falla. */
export function InstitucionEstrella({
  institucionId,
  favorita,
  nombre,
}: {
  institucionId: string;
  favorita: boolean;
  nombre: string;
}) {
  const toast = useToast();
  const [guardada, setGuardada] = useOptimistic(favorita);
  const [pendiente, empezar] = useTransition();

  const alternar = () => {
    if (pendiente) return;
    empezar(async () => {
      setGuardada(!guardada);
      const r = await alternarFavoritoInstitucion(institucionId);
      if (!r.ok) toast(r.error, "error");
    });
  };

  return (
    <button
      type="button"
      onClick={alternar}
      aria-pressed={guardada}
      aria-label={guardada ? `Quitar de guardadas: ${nombre}` : `Guardar: ${nombre}`}
      title={guardada ? "Quitar de guardadas" : "Guardar"}
      className={cn(
        "flex-none rounded-md px-1 text-base leading-none transition-colors focus-visible:ring-[3px] focus-visible:ring-navy-700/30 focus-visible:outline-none",
        guardada ? "text-[#F0B400]" : "text-[#D8D6CE] hover:text-[#F0B400]/70",
      )}
    >
      ★
    </button>
  );
}

/** "Enviar mi CV": una vez por institución; después queda confirmado. */
export function InstitucionCvBoton({ institucionId, enviado }: { institucionId: string; enviado: boolean }) {
  const toast = useToast();
  const [yaEnviado, setYaEnviado] = useOptimistic(enviado);
  const [pendiente, empezar] = useTransition();

  const enviar = () =>
    empezar(async () => {
      setYaEnviado(true);
      const r = await enviarCvAInstitucion(institucionId);
      if (r.ok) toast("Le enviamos tu CV a la institución");
      else toast(r.error, "error");
    });

  return (
    <Boton
      bloque
      variante={yaEnviado ? "exito" : "primario"}
      disabled={yaEnviado || pendiente}
      onClick={enviar}
      className="mb-2"
    >
      {yaEnviado ? "✓ CV enviado" : "Enviar mi CV"}
    </Boton>
  );
}
