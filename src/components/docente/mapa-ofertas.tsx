"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useMemo, useRef, useState } from "react";
import type { LayerGroup, Map as MapaLeaflet } from "leaflet";
import type { CategoriaDocente } from "@/db/schema";
import { Boton, BotonLink } from "@/components/ui/button";
import { LogoInstitucion } from "@/components/docente/logo-institucion";
import { iconoPin } from "@/components/docente/pin-mapa";
import { CATEGORIA_INFO, CATEGORIAS } from "@/lib/catalogo";
import { LEYENDA_CATEGORIA } from "@/lib/oportunidades";
import { cn } from "@/lib/utils";

export type PinOferta = {
  id: string;
  puesto: string;
  institucion: string;
  logoUrl: string | null;
  zona: string | null;
  horario: string | null;
  categoria: CategoriaDocente;
  /** Suplencia rápida: el pin lleva un reloj. */
  rapida: boolean;
  lat: number;
  lng: number;
};

type Leaflet = typeof import("leaflet");

/** Varias búsquedas de una misma institución comparten coordenadas: se abren en abanico para poder tocarlas. */
function abrirEnAbanico(pines: PinOferta[]) {
  const usados = new Map<string, number>();
  return pines.map((p) => {
    const clave = `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`;
    const n = (usados.get(clave) ?? 0) + 1;
    usados.set(clave, n);
    if (n === 1) return { ...p, latPin: p.lat, lngPin: p.lng };
    const angulo = (n - 1) * 2.4;
    return { ...p, latPin: p.lat + Math.sin(angulo) * 0.003, lngPin: p.lng + Math.cos(angulo) * 0.003 };
  });
}

/**
 * Mapa real (Leaflet + OpenStreetMap) de las búsquedas. Leaflet toca `window`, así que se importa
 * recién dentro de un efecto: en el servidor este componente solo dibuja el contenedor vacío.
 * `compacto` es el mini mapa de "Ubicación" del detalle: un pin, sin leyenda ni tarjeta.
 */
export function MapaOfertas({
  pines,
  centro,
  radioKm,
  compacto = false,
}: {
  pines: PinOferta[];
  /** Ubicación del docente (de su perfil): se marca y entra en el encuadre. */
  centro: { lat: number; lng: number } | null;
  /** Radio de búsqueda a dibujar alrededor del docente; null si no limita. */
  radioKm: number | null;
  compacto?: boolean;
}) {
  const contenedor = useRef<HTMLDivElement>(null);
  const instancia = useRef<{ L: Leaflet; mapa: MapaLeaflet; capa: LayerGroup } | null>(null);
  const encuadre = useRef("");
  const [listo, setListo] = useState(false);
  const [seleccion, setSeleccion] = useState<string | null>(null);

  const abanico = useMemo(() => abrirEnAbanico(pines), [pines]);
  const seleccionada = pines.find((p) => p.id === seleccion) ?? null;
  const categorias = CATEGORIAS.filter((c) => pines.some((p) => p.categoria === c));
  // Solo se vuelve a encuadrar cuando cambia qué se muestra, no en cada refresco de la página.
  const firma = `${pines.map((p) => `${p.id}:${p.lat}:${p.lng}`).join("|")}#${centro?.lat},${centro?.lng}#${radioKm}`;
  // Solo el centro con el que nace el mapa: después se mueve por encuadre, no por props.
  const [puntoInicial] = useState<[number, number]>(() => {
    if (centro) return [centro.lat, centro.lng];
    const primero = pines[0];
    return primero ? [primero.lat, primero.lng] : [0, 0];
  });

  useEffect(() => {
    let cancelado = false;
    let mapa: MapaLeaflet | null = null;
    (async () => {
      const L = await import("leaflet");
      if (cancelado || !contenedor.current) return;
      mapa = L.map(contenedor.current, {
        center: puntoInicial,
        zoom: 12,
        scrollWheelZoom: false, // que la rueda siga desplazando la página
        attributionControl: true,
      });
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
  }, [puntoInicial]);

  // Pines, marca del docente y radio.
  useEffect(() => {
    const m = instancia.current;
    if (!listo || !m) return;
    const { L, capa } = m;
    capa.clearLayers();
    if (centro) {
      if (radioKm) {
        L.circle([centro.lat, centro.lng], {
          radius: radioKm * 1000,
          color: "#97125F",
          weight: 1.5,
          opacity: 0.55,
          fillColor: "#97125F",
          fillOpacity: 0.05,
          interactive: false,
        }).addTo(capa);
      }
      L.circleMarker([centro.lat, centro.lng], {
        radius: 6,
        color: "#fff",
        weight: 2,
        fillColor: "#97125F",
        fillOpacity: 1,
        interactive: false,
      }).addTo(capa);
    }
    for (const p of abanico) {
      const marcador = L.marker([p.latPin, p.lngPin], {
        icon: iconoPin(L, CATEGORIA_INFO[p.categoria].color, !compacto && p.id === seleccion, { rapida: p.rapida }),
        title: `${p.puesto} · ${p.institucion}`,
        riseOnHover: true,
        interactive: !compacto,
        keyboard: !compacto,
      });
      marcador.on("click", () => setSeleccion((previa) => (previa === p.id ? null : p.id)));
      capa.addLayer(marcador);
    }
  }, [listo, abanico, centro, radioKm, seleccion, compacto]);

  // Encuadre: todos los pines y la ubicación del docente.
  useEffect(() => {
    const m = instancia.current;
    if (!listo || !m || encuadre.current === firma) return;
    encuadre.current = firma;
    const { L, mapa } = m;
    const puntos: [number, number][] = pines.map((p) => [p.lat, p.lng]);
    if (centro) puntos.push([centro.lat, centro.lng]);
    if (puntos.length === 0) return;
    mapa.invalidateSize();
    mapa.fitBounds(L.latLngBounds(puntos), { padding: [44, 44], maxZoom: compacto ? 15 : 14 });
  }, [listo, firma, pines, centro, compacto]);

  if (compacto) {
    return (
      <div
        role="img"
        aria-label="Mapa con la ubicación de la institución"
        className="relative isolate h-[220px] overflow-hidden rounded-lg border border-borde bg-app"
      >
        <div ref={contenedor} className="absolute inset-0" />
      </div>
    );
  }

  return (
    <div
      role="region"
      aria-label="Mapa de búsquedas cerca tuyo"
      className="relative isolate h-[540px] overflow-hidden rounded-xl border border-borde bg-app max-[860px]:h-[460px]"
    >
      <div ref={contenedor} className="absolute inset-0" />
      <div className="pointer-events-none absolute top-3.5 right-3.5 z-[500] flex flex-wrap gap-3 rounded-full border border-borde bg-white/93 px-3.5 py-2 max-[620px]:top-2.5 max-[620px]:right-2.5 max-[620px]:gap-[9px] max-[620px]:px-2.5 max-[620px]:py-1.5">
        {categorias.map((c) => (
          <span key={c} className="flex items-center gap-[7px] text-[11.5px] leading-none font-medium text-tinta-2 max-[620px]:text-[10px]">
            <span style={{ background: CATEGORIA_INFO[c].color }} className="size-[9px] flex-none rounded-full" />
            {LEYENDA_CATEGORIA[c]}
          </span>
        ))}
        {pines.some((p) => p.rapida) && (
          <span className="flex items-center gap-[7px] text-[11.5px] leading-none font-medium text-tinta-2 max-[620px]:text-[10px]">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#16214F" strokeWidth="2.2" strokeLinecap="round" className="flex-none" aria-hidden>
              <circle cx="12" cy="13" r="8" />
              <path d="M12 9.5V13l2.4 1.6" />
              <path d="M9.6 2.8h4.8" />
            </svg>
            Suplencia rápida
          </span>
        )}
      </div>
      {seleccionada ? (
        <div
          className={cn(
            "absolute right-3.5 bottom-3.5 left-3.5 z-[500] flex flex-wrap items-center gap-3.5 rounded-[10px] border border-borde bg-white px-4 py-3.5 shadow-[0_10px_28px_rgba(31,36,33,.18)] max-[860px]:p-3",
          )}
        >
          <LogoInstitucion nombre={seleccionada.institucion} logoUrl={seleccionada.logoUrl} tamano={38} />
          <div className="min-w-0 flex-[1_1_200px]">
            <div className="text-[15px] leading-[1.3] font-semibold">{seleccionada.puesto}</div>
            <div className="text-[12.5px] leading-[1.4] text-apagado">
              {[seleccionada.institucion, seleccionada.zona, seleccionada.horario].filter(Boolean).join(" · ")}
            </div>
          </div>
          <div className="flex flex-none gap-2 max-[1100px]:flex-wrap">
            <Boton variante="secundario" tamano="sm" onClick={() => setSeleccion(null)}>
              Cerrar
            </Boton>
            <BotonLink variante="cta" tamano="sm" href={`/docente/oferta/${seleccionada.id}`}>
              Ver oferta
            </BotonLink>
          </div>
        </div>
      ) : (
        <div className="pointer-events-none absolute right-3.5 bottom-3.5 left-3.5 z-[500] rounded-lg bg-white/90 p-[9px] text-center text-[12.5px] leading-[1.4] font-medium text-apagado">
          Tocá un punto para ver la búsqueda
        </div>
      )}
    </div>
  );
}
