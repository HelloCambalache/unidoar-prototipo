import type { PinOferta } from "@/components/docente/mapa-ofertas";
import type { OfertaListada } from "@/lib/queries/oportunidades";

/**
 * Los pines del mapa de búsquedas: uno por cada oferta cuya institución tiene ubicación. `destino` decide a dónde lleva el botón de
 * la tarjeta del pin (en el área del profesional, a la oferta; en el sitio público, a crear la cuenta); sin él, a la oferta del panel.
 */
export function pinesDeOfertas(
  ofertas: OfertaListada[],
  destino?: (o: OfertaListada) => { href: string; etiqueta: string },
): PinOferta[] {
  return ofertas.flatMap((o) =>
    o.institucion.lat != null && o.institucion.lng != null
      ? [
          {
            id: o.id,
            puesto: o.puesto,
            institucion: o.institucion.nombre,
            logoUrl: o.institucion.logoUrl,
            zona: o.zona,
            horario: o.horario,
            categoria: o.categoria,
            rapida: o.rapida,
            lat: o.institucion.lat,
            lng: o.institucion.lng,
            ...(destino ? destino(o) : {}),
          },
        ]
      : [],
  );
}
