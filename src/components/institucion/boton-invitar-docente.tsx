"use client";

import { useCallback, useState, useTransition } from "react";
import { invitarDocente } from "@/app/actions/profesionales";
import { Boton, BotonLink, type BotonTamano } from "@/components/ui/button";
import { Cajon } from "@/components/ui/cajon";
import { Insignia } from "@/components/ui/insignia";
import { useToast } from "@/components/ui/toast";
import type { OpcionInvitacion } from "@/lib/invitaciones";

const ETIQUETA_ESTADO = { invitado: "✓ Invitado/a", postulado: "✓ Ya se postuló" } as const;

/**
 * "Invitar a postularse". Si hay una búsqueda de contexto (o una sola activa) invita directo; si hay
 * varias abre un cajón para elegir. El estado (quién ya está invitado) viene del servidor y se refresca
 * solo después de invitar.
 */
export function BotonInvitarDocente({
  docenteId,
  nombre,
  opciones,
  contextoId,
  tamano = "sm",
  bloque,
  className,
}: {
  docenteId: string;
  nombre: string;
  opciones: OpcionInvitacion[];
  contextoId: string | null;
  tamano?: BotonTamano;
  bloque?: boolean;
  className?: string;
}) {
  const toast = useToast();
  const [abierto, setAbierto] = useState(false);
  const [enCurso, setEnCurso] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();
  const cerrar = useCallback(() => setAbierto(false), []);

  const invitar = (busquedaId: string) => {
    setEnCurso(busquedaId);
    empezar(async () => {
      const r = await invitarDocente(docenteId, busquedaId);
      setEnCurso(null);
      if (r.ok) {
        toast(`Invitación enviada a ${nombre}`);
        setAbierto(false);
      } else {
        toast(r.error, "error");
      }
    });
  };

  if (opciones.length === 0) {
    return (
      <BotonLink href="/institucion/publicar" variante="cta" tamano={tamano} bloque={bloque} className={className}>
        Publicá una búsqueda para invitar
      </BotonLink>
    );
  }

  const directa = contextoId
    ? opciones.find((o) => o.id === contextoId)
    : opciones.length === 1
      ? opciones[0]
      : undefined;

  if (directa) {
    if (directa.estado !== "libre") {
      return (
        <Boton variante="exito" tamano={tamano} bloque={bloque} className={className} disabled>
          {ETIQUETA_ESTADO[directa.estado]}
        </Boton>
      );
    }
    return (
      <Boton
        variante="cta"
        tamano={tamano}
        bloque={bloque}
        className={className}
        disabled={pendiente}
        onClick={() => invitar(directa.id)}
      >
        {pendiente ? "Invitando…" : "Invitar a postularse"}
      </Boton>
    );
  }

  if (opciones.every((o) => o.estado !== "libre")) {
    return (
      <Boton variante="exito" tamano={tamano} bloque={bloque} className={className} disabled>
        ✓ Ya está en tus búsquedas
      </Boton>
    );
  }

  return (
    <>
      <Boton variante="cta" tamano={tamano} bloque={bloque} className={className} onClick={() => setAbierto(true)}>
        Invitar a postularse
      </Boton>
      <Cajon abierto={abierto} onCerrar={cerrar} titulo={`Invitar a ${nombre}`}>
        <h2 className="m-0 mb-1.5 text-lg leading-tight font-semibold">Invitar a {nombre}</h2>
        <p className="m-0 mb-5 text-sm leading-normal text-apagado">
          Elegí a qué búsqueda querés invitar a postularse. Le avisamos si tiene cuenta.
        </p>
        <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
          {opciones.map((o) => (
            <li
              key={o.id}
              className="flex items-center justify-between gap-3 rounded-ud border border-borde px-3.5 py-3"
            >
              <div className="min-w-0">
                <div className="text-sm leading-tight font-semibold">{o.puesto}</div>
                {o.detalle && <div className="mt-0.5 text-xs leading-snug text-sutil">{o.detalle}</div>}
              </div>
              {o.estado === "libre" ? (
                <Boton
                  variante="cta"
                  tamano="sm"
                  className="flex-none"
                  disabled={pendiente}
                  onClick={() => invitar(o.id)}
                >
                  {enCurso === o.id ? "Invitando…" : "Invitar"}
                </Boton>
              ) : (
                <Insignia tono="verde" className="flex-none">
                  {ETIQUETA_ESTADO[o.estado]}
                </Insignia>
              )}
            </li>
          ))}
        </ul>
      </Cajon>
    </>
  );
}
