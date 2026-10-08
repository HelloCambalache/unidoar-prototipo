"use client";

import { MenuEtapas } from "@/components/institucion/menu-etapas";
import { Avatar, Verificado } from "@/components/ui/insignia";
import type { EtapaPostulacion } from "@/db/schema";
import { etiquetaDias, notaDeTarjeta, type PostulanteTarjeta } from "@/lib/pipeline";
import { cn } from "@/lib/utils";

const NOTA = {
  ambar: "bg-[#FDE9D8] text-[#9A4A12]",
  rosa: "bg-[#F6E6E0] text-[#8F3D28]",
  verde: "bg-[#E4F3EA] text-[#256B45]",
} as const;

/** Tarjeta del tablero Kanban: se arrastra entre columnas o se mueve desde el menú ⋯. */
export function TarjetaPostulante({
  p,
  soloLectura,
  arrastrando,
  onAbrir,
  onMover,
  onDescartar,
  onDragStart,
  onDragEnd,
}: {
  p: PostulanteTarjeta;
  soloLectura: boolean;
  arrastrando: boolean;
  onAbrir: () => void;
  onMover: (etapa: EtapaPostulacion) => void;
  onDescartar: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
}) {
  const nota = notaDeTarjeta(p);
  return (
    <li
      draggable={!soloLectura}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={cn(
        "rounded-[10px] border border-borde bg-white p-3.5 transition-opacity",
        !soloLectura && "cursor-grab active:cursor-grabbing",
        arrastrando && "opacity-40",
      )}
    >
      <div className="flex items-start gap-1.5">
        <button
          type="button"
          onClick={onAbrir}
          aria-label={`Abrir la ficha de ${p.nombre}`}
          className="flex min-w-0 flex-1 items-center gap-2.5 rounded-md text-left focus-visible:ring-[3px] focus-visible:ring-navy-700/30 focus-visible:outline-none"
        >
          <Avatar iniciales={p.iniciales} fotoUrl={p.fotoUrl} tamano={32} />
          <span className="min-w-0">
            <span className="block text-sm leading-tight font-semibold [overflow-wrap:anywhere]">{p.nombre}</span>
            <span className="mt-0.5 line-clamp-2 text-xs leading-snug text-apagado">{p.subtitulo}</span>
          </span>
        </button>
        {!soloLectura && (
          <MenuEtapas nombre={p.nombre} postulacionId={p.id} etapa={p.etapa} onMover={onMover} onDescartar={onDescartar} />
        )}
      </div>
      {p.etapa !== "contratado" && (
        <div className="mt-2.5 flex items-center justify-between gap-2">
          {p.suspendido ? (
            <span className="text-xs font-semibold text-rosa">Perfil suspendido</span>
          ) : p.cv.verificado ? (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-verde">
              <Verificado categoria={p.categoria} tamano={13} />
              Perfil verificado
            </span>
          ) : (
            <span className="text-xs text-sutil">Sin verificar</span>
          )}
          <span className="text-xs text-sutil">{etiquetaDias(p.etapa, p.dias)}</span>
        </div>
      )}
      {nota && <div className={cn("mt-2.5 rounded-[7px] px-2.5 py-2 text-xs leading-snug font-medium", NOTA[nota.tono])}>{nota.texto}</div>}
    </li>
  );
}
