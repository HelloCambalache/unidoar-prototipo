import type { DivIcon } from "leaflet";

type Leaflet = typeof import("leaflet");

/**
 * Pin de ubicación clásico para los mapas de Leaflet: la punta cae exactamente sobre la coordenada
 * (el pin anterior era un cuadrado girado 45° que terminaba apuntando al costado). Las suplencias
 * rápidas llevan un reloj adentro para distinguirlas. Diseño del prototipo (prototipo/mapa.js).
 */
export function iconoPin(
  L: Leaflet,
  color: string,
  seleccionado: boolean,
  { rapida = false, bordeSeleccion = "#16214F" }: { rapida?: boolean; bordeSeleccion?: string } = {},
): DivIcon {
  const borde = seleccionado ? bordeSeleccion : "#ffffff";
  const grosor = seleccionado ? 2.6 : 2;
  const escala = seleccionado ? 1.12 : 1;
  const ancho = Math.round(26 * escala);
  const alto = Math.round(34 * escala);

  const interior = rapida
    ? '<g stroke="#fff" stroke-width="1.9" stroke-linecap="round" fill="none">' +
      '<circle cx="13" cy="13.2" r="4.6"/><path d="M13 10.6v2.8l1.9 1.3"/><path d="M11.1 6.6h3.8"/></g>'
    : '<circle cx="13" cy="12.7" r="4" fill="#fff" fill-opacity=".9"/>';

  const svg =
    `<svg width="${ancho}" height="${alto}" viewBox="0 0 26 34" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:block">` +
    `<path d="M13 33C13 33 24 20.4 24 12.9A11 11 0 1 0 2 12.9C2 20.4 13 33 13 33Z" fill="${color}" stroke="${borde}" stroke-width="${grosor}" stroke-linejoin="round"/>` +
    interior +
    "</svg>";

  return L.divIcon({
    className: "",
    html: `<span style="display:block;filter:drop-shadow(0 3px 6px rgba(31,36,33,.35))">${svg}</span>`,
    iconSize: [ancho, alto],
    iconAnchor: [ancho / 2, alto],
  });
}
