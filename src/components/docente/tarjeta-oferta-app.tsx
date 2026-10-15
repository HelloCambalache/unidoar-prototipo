import Link from "next/link";
import { Icono } from "@/components/icons";
import { LogoInstitucion } from "@/components/docente/logo-institucion";
import { Insignia } from "@/components/ui/insignia";
import type { CategoriaDocente } from "@/db/schema";
import { CATEGORIA_INFO } from "@/lib/catalogo";
import { kmLegible } from "@/lib/geo";
import type { OfertaListada } from "@/lib/queries/oportunidades";
import { cn } from "@/lib/utils";

/** Panel apenas teñido por categoría: el color de la categoría queda en la etiqueta, no en toda la tarjeta. */
const PANEL: Record<CategoriaDocente, { fondo: string; texto: string }> = {
  educador: { fondo: "bg-panel-naranja", texto: "text-naranja-texto" },
  entrenador: { fondo: "bg-panel-ambar", texto: "text-ambar-texto" },
  guardavidas: { fondo: "bg-panel-celeste", texto: "text-celeste-texto" },
};

/**
 * Tarjeta de una búsqueda en "Buscar trabajo" y "Búsquedas rápidas" del área del profesional (identidad nueva).
 * Mismos datos y mismo comportamiento que `TarjetaOferta` (la del sitio público, que no cambia): link "estirado"
 * sobre el título y la estrella por encima.
 */
export function TarjetaOfertaApp({
  oferta,
  href,
  estrella,
}: {
  oferta: OfertaListada;
  href: string;
  estrella?: React.ReactNode;
}) {
  const km = kmLegible(oferta.km);
  const panel = PANEL[oferta.categoria];
  const destacada = oferta.rapida && !oferta.postulacion;
  const lugar = [oferta.sede, oferta.zona, km].filter(Boolean).join(" · ");

  return (
    <article
      className={cn(
        "group relative flex flex-col rounded-tarjeta bg-white p-2 shadow-tarjeta transition-[box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-tarjeta-hover",
        oferta.rapida && "ring-2 ring-naranja",
      )}
    >
      {oferta.rapida && (
        <div className="mb-2 flex items-center gap-2 rounded-[16px] bg-naranja px-3.5 py-2.5 text-[13px] leading-none font-semibold text-white">
          <span aria-hidden className="relative flex size-2 flex-none">
            <span className="absolute inset-0 animate-ping rounded-full bg-white/80" />
            <span className="relative size-2 rounded-full bg-white" />
          </span>
          <Icono nombre="rayo" tamano={14} trazo={2} className="flex-none" />
          Búsqueda urgente
          {oferta.responderEn && <span className="ml-auto font-medium text-white/90">responder en {oferta.responderEn}</span>}
        </div>
      )}
      <div className={cn("flex flex-1 flex-col gap-3.5 rounded-[18px] p-[18px]", oferta.rapida ? "bg-naranja-tint" : panel.fondo)}>
        <div className="flex items-start justify-between gap-3">
          <span className={cn("text-[11.5px] leading-none font-semibold tracking-[0.08em] uppercase", panel.texto)}>
            {CATEGORIA_INFO[oferta.categoria].plural}
          </span>
          {/* La estrella va por encima del link estirado. */}
          <span className="relative z-[1] -mt-1.5 -mr-1.5">{estrella}</span>
        </div>
        <div className="flex items-start gap-3">
          <LogoInstitucion nombre={oferta.institucion.nombre} logoUrl={oferta.institucion.logoUrl} tamano={40} />
          <div className="min-w-0 flex-1">
            <h2 className="font-display m-0 text-[18px] leading-[1.25] font-semibold tracking-[-0.01em]">
              <Link
                href={href}
                className="text-tinta outline-none after:absolute after:inset-0 after:rounded-tarjeta hover:text-tinta focus-visible:after:ring-[3px] focus-visible:after:ring-navy-700/30"
              >
                {oferta.puesto}
              </Link>
            </h2>
            <div className="mt-0.5 text-[13px] leading-[1.35] text-tinta-2">{oferta.institucion.nombre}</div>
          </div>
        </div>
        {oferta.descripcion && (
          <p className="m-0 line-clamp-2 text-[13px] leading-normal text-apagado">{oferta.descripcion}</p>
        )}
        {(oferta.horario || oferta.postulacion) && (
          <div className="mt-auto flex flex-wrap gap-1.5">
            {oferta.horario && (
              <span className="inline-flex h-8 items-center gap-1.5 rounded-full border border-linea bg-white px-3 text-[12.5px] font-medium text-tinta-2">
                <Icono nombre="reloj" tamano={13} trazo={2} className="text-apagado" />
                {oferta.horario}
              </span>
            )}
            {oferta.postulacion && <Insignia tono={oferta.postulacion.tono}>{oferta.postulacion.texto}</Insignia>}
          </div>
        )}
      </div>
      <div className="flex items-center gap-3 px-3.5 pt-3.5 pb-2">
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="font-display text-[15px] leading-tight font-semibold text-tinta">
            {destacada ? "Ver y postularme" : "Ver oferta"}
          </span>
          <span className="truncate text-[12.5px] leading-tight text-apagado">{lugar || "Zona a confirmar"}</span>
        </span>
        <span
          aria-hidden
          className={cn(
            "inline-flex size-11 flex-none items-center justify-center rounded-xl transition-colors",
            destacada ? "bg-naranja text-white" : "bg-lienzo text-tinta group-hover:bg-navy-900 group-hover:text-white",
          )}
        >
          <Icono nombre="flecha" tamano={18} trazo={2} />
        </span>
      </div>
    </article>
  );
}
