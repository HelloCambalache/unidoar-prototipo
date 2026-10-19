"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import type { Map as MapaLeaflet } from "leaflet";
import { iconoPin } from "@/components/docente/pin-mapa";
import { sedesConUbicacion, type SedePublica } from "@/lib/sedes";
import { cn } from "@/lib/utils";

/**
 * Mapa real (Leaflet + OpenStreetMap) con el lugar de una institución: un pin por sede, y si hay varias el mapa encuadra todas.
 * Reemplaza al enlace "Ver en el mapa". Leaflet toca `window`, así que se importa recién dentro de un efecto. La rueda del mouse
 * sigue desplazando la página. Sin ninguna sede ubicada no dibuja nada (quien llama muestra su enlace de siempre).
 */
export function MapaDeSedes({ sedes, className }: { sedes: SedePublica[]; className?: string }) {
  const contenedor = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const puntos = sedesConUbicacion(sedes).map((s) => ({ nombre: s.nombre, lat: s.lat as number, lng: s.lng as number }));
    const primero = puntos[0];
    if (!primero) return;
    let cancelado = false;
    let mapa: MapaLeaflet | null = null;
    (async () => {
      const L = await import("leaflet");
      if (cancelado || !contenedor.current) return;
      mapa = L.map(contenedor.current, { center: [primero.lat, primero.lng], zoom: 15, scrollWheelZoom: false });
      // Con varias sedes el encuadre va antes de agregar los mosaicos y sin animación: se descargan directo a este zoom.
      if (puntos.length > 1) {
        mapa.fitBounds(L.latLngBounds(puntos.map((p): [number, number] => [p.lat, p.lng])), { padding: [44, 44], maxZoom: 15, animate: false });
      }
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: '&copy; colaboradores de <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(mapa);
      for (const p of puntos) {
        L.marker([p.lat, p.lng], { icon: iconoPin(L, "#16214F", false), title: p.nombre, alt: p.nombre }).addTo(mapa);
      }
    })();
    return () => {
      cancelado = true;
      mapa?.remove();
    };
  }, [sedes]);

  if (sedesConUbicacion(sedes).length === 0) return null;
  return (
    <div
      role="img"
      aria-label={sedes.length > 1 ? "Mapa con las sedes de la institución" : "Mapa con la ubicación de la institución"}
      className={cn("mapa-suave relative isolate h-[260px] overflow-hidden rounded-interno bg-lienzo max-[620px]:h-[210px]", className)}
    >
      <div ref={contenedor} className="absolute inset-0" />
    </div>
  );
}
