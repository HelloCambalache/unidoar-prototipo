"use client";

import "leaflet/dist/leaflet.css";
import { iconoPin } from "@/components/docente/pin-mapa";
import { useEffect, useRef, useState } from "react";
import type { LayerGroup, Map as MapaLeaflet } from "leaflet";
import { Boton, BotonLink } from "@/components/ui/button";
import { InstitucionLogo } from "@/components/docente/instituciones-logo";

export type PinInstitucion = {
  id: string;
  slug: string;
  nombre: string;
  /** Nombre de la sede que marca este pin; solo si la institución tiene más de una. */
  sede: string | null;
  tipo: string;
  zona: string | null;
  logoUrl: string | null;
  lat: number;
  lng: number;
  busquedasActivas: number;
  favorita: boolean;
  verificada: boolean;
};

type Leaflet = typeof import("leaflet");

// Zona norte de Buenos Aires: centro y zoom del prototipo, por si no hay ningún pin que encuadrar.
const CENTRO_POR_DEFECTO: [number, number] = [-34.495, -58.53];

/**
 * Mapa real (Leaflet + OpenStreetMap) del catálogo de instituciones. Leaflet toca `window`, así que
 * se importa recién dentro de un efecto. Rosa: favoritas. Azul: verificadas. Gris: el resto.
 */
export function InstitucionesMapa({ pines }: { pines: PinInstitucion[] }) {
  const contenedor = useRef<HTMLDivElement>(null);
  const instancia = useRef<{ L: Leaflet; mapa: MapaLeaflet; capa: LayerGroup } | null>(null);
  const encuadre = useRef("");
  const [listo, setListo] = useState(false);
  const [seleccion, setSeleccion] = useState<string | null>(null);

  // Una institución con varias sedes tiene varios pines con el mismo id: cada uno se distingue por su posición.
  const claveDe = (p: PinInstitucion) => `${p.id}:${p.lat}:${p.lng}`;
  const seleccionada = pines.find((p) => claveDe(p) === seleccion) ?? null;
  const firma = pines.map(claveDe).join("|");

  useEffect(() => {
    let cancelado = false;
    let mapa: MapaLeaflet | null = null;
    (async () => {
      const L = await import("leaflet");
      if (cancelado || !contenedor.current) return;
      mapa = L.map(contenedor.current, { center: CENTRO_POR_DEFECTO, zoom: 11, scrollWheelZoom: false });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution:
          '&copy; colaboradores de <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(mapa);
      instancia.current = { L, mapa, capa: L.layerGroup().addTo(mapa) };
      setListo(true);
    })();
    return () => {
      cancelado = true;
      instancia.current = null;
      mapa?.remove();
    };
  }, []);

  useEffect(() => {
    const m = instancia.current;
    if (!listo || !m) return;
    const { L, capa } = m;
    capa.clearLayers();
    for (const p of pines) {
      const color = p.favorita ? "#97125F" : p.verificada ? "#16214F" : "#9AA09B";
      const marcador = L.marker([p.lat, p.lng], {
        icon: iconoPin(L, color, claveDe(p) === seleccion, { bordeSeleccion: "#1F2421" }),
        title: p.nombre,
        riseOnHover: true,
      });
      marcador.on("click", () => setSeleccion((previa) => (previa === claveDe(p) ? null : claveDe(p))));
      capa.addLayer(marcador);
    }
  }, [listo, pines, seleccion]);

  // Solo se vuelve a encuadrar cuando cambia qué se muestra, no al elegir un pin.
  useEffect(() => {
    const m = instancia.current;
    if (!listo || !m || encuadre.current === firma) return;
    encuadre.current = firma;
    if (pines.length === 0) return;
    m.mapa.invalidateSize();
    m.mapa.fitBounds(
      m.L.latLngBounds(pines.map((p): [number, number] => [p.lat, p.lng])),
      { padding: [44, 44], maxZoom: 14 },
    );
  }, [listo, firma, pines]);

  return (
    <div
      role="region"
      aria-label="Mapa de instituciones"
      className="relative isolate mb-[18px] h-[540px] overflow-hidden rounded-xl border border-borde bg-app max-[860px]:h-[460px]"
    >
      <div ref={contenedor} className="absolute inset-0" />
      {seleccionada ? (
        <div className="absolute right-3.5 bottom-3.5 left-3.5 z-[500] flex flex-wrap items-center gap-3.5 rounded-[10px] border border-borde bg-white px-4 py-3.5 shadow-[0_10px_28px_rgba(31,36,33,.18)] max-[860px]:p-3">
          <InstitucionLogo nombre={seleccionada.nombre} logoUrl={seleccionada.logoUrl} tamano={38} />
          <div className="min-w-0 flex-[1_1_200px]">
            <div className="text-[15px] leading-[1.3] font-semibold">{seleccionada.nombre}</div>
            <div className="text-[12.5px] leading-[1.4] text-apagado">
              {[
                seleccionada.tipo,
                seleccionada.sede,
                seleccionada.zona,
                seleccionada.busquedasActivas === 1 ? "1 búsqueda abierta" : `${seleccionada.busquedasActivas} búsquedas abiertas`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </div>
          </div>
          <div className="flex flex-none gap-2">
            <Boton variante="secundario" tamano="sm" onClick={() => setSeleccion(null)}>
              Cerrar
            </Boton>
            <BotonLink href={`/docente/instituciones/${seleccionada.slug}`} tamano="sm">
              Ver perfil
            </BotonLink>
          </div>
        </div>
      ) : (
        <div className="pointer-events-none absolute right-3.5 bottom-3.5 left-3.5 z-[500] rounded-lg bg-white/90 p-[9px] text-center text-[12.5px] leading-[1.4] font-medium text-apagado">
          {pines.length > 0 ? "Tocá un punto para ver la institución" : "Ninguna institución con ubicación para mostrar"}
        </div>
      )}
    </div>
  );
}
