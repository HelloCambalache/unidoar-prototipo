import Link from "next/link";
import { Icono } from "@/components/icons";
import { LogoInstitucion } from "@/components/docente/logo-institucion";
import { Insignia } from "@/components/ui/insignia";
import { kmLegible } from "@/lib/geo";
import type { OfertaListada } from "@/lib/queries/oportunidades";
import { cn } from "@/lib/utils";

/**
 * Tarjeta de una búsqueda en el listado: la misma en "Buscar trabajo" del docente, en "Búsquedas
 * rápidas" y en el sitio público. La tarjeta entera es clickeable por un link "estirado" sobre el
 * título (así sigue siendo un link real); la estrella queda por encima.
 */
export function TarjetaOferta({
  oferta,
  href,
  etiqueta,
  estrella,
}: {
  oferta: OfertaListada;
  /** A dónde lleva la tarjeta: la oferta dentro del panel, o el registro para una visita. */
  href: string;
  /** Texto de la acción; por defecto "Ver y postularme" (rápidas sin postulación) o "Ver oferta". */
  etiqueta?: string;
  /** Estrella de favorito (con sesión) o invitación a crear cuenta (visita). */
  estrella?: React.ReactNode;
}) {
  const km = kmLegible(oferta.km);
  const destacada = oferta.rapida && !oferta.postulacion;

  return (
    <article
      className={cn(
        "group relative flex flex-col rounded-ud bg-white p-[18px] transition-[border-color,box-shadow] duration-150",
        "hover:shadow-[0_6px_16px_rgba(31,36,33,.08)]",
        oferta.rapida ? "border-[1.5px] border-naranja" : "border border-borde hover:border-borde-fuerte",
      )}
    >
      {oferta.rapida && (
        <Insignia tono="naranja" className="mb-3 self-start">
          {oferta.responderEn ? `Rápida · responder en ${oferta.responderEn}` : "Rápida"}
        </Insignia>
      )}
      <div className="mb-3 flex gap-3">
        <LogoInstitucion nombre={oferta.institucion.nombre} logoUrl={oferta.institucion.logoUrl} tamano={40} />
        <div className="min-w-0 flex-1">
          <h2 className="m-0 text-[15px] leading-[1.3] font-semibold">
            <Link
              href={href}
              className="text-tinta outline-none after:absolute after:inset-0 after:rounded-ud hover:text-tinta focus-visible:after:ring-[3px] focus-visible:after:ring-navy-700/30"
            >
              {oferta.puesto}
            </Link>
          </h2>
          <div className="text-xs leading-[1.35] text-apagado">{oferta.institucion.nombre}</div>
        </div>
        {estrella}
      </div>
      {oferta.descripcion && (
        <p className="m-0 mb-3 line-clamp-3 text-[13px] leading-normal text-apagado">{oferta.descripcion}</p>
      )}
      <div className="mb-3.5 flex flex-col gap-1.5 text-[13px] leading-[1.4] text-tinta-2">
        {(oferta.zona || km || oferta.sede) && (
          <div className="flex items-center gap-2">
            <Icono nombre="ubicacion" tamano={14} trazo={2} className="text-apagado" />
            {[oferta.sede, oferta.zona, km].filter(Boolean).join(" · ")}
          </div>
        )}
        {oferta.horario && (
          <div className="flex items-center gap-2">
            <Icono nombre="reloj" tamano={14} trazo={2} className="text-apagado" />
            {oferta.horario}
          </div>
        )}
      </div>
      {oferta.postulacion && (
        <Insignia tono={oferta.postulacion.tono} className="mb-3 self-start">
          {oferta.postulacion.texto}
        </Insignia>
      )}
      {destacada ? (
        <span className="mt-auto inline-flex min-h-[34px] items-center justify-center rounded-lg bg-naranja px-3.5 text-[12.5px] leading-none font-semibold text-white">
          {etiqueta ?? "Ver y postularme"}
        </span>
      ) : (
        <span className="mt-auto inline-flex items-center gap-[5px] border-t border-[#F0EFEA] pt-3 text-[13px] leading-none font-semibold text-navy-700 transition-colors group-hover:text-naranja">
          {etiqueta ?? "Ver oferta"}
          <Icono nombre="chevron" tamano={13} trazo={2.2} className="-rotate-90" />
        </span>
      )}
    </article>
  );
}
