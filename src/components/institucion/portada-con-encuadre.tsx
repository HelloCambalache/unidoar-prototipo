"use client";

import { useRef, useState, type ReactNode } from "react";
import { Boton } from "@/components/ui/button";
import {
  ENCUADRE_CENTRADO,
  encuadreInicial,
  moverEncuadre,
  posicionDePortada,
  sobranteDeCover,
  textoDeEncuadre,
  type Encuadre,
} from "@/lib/encuadre";
import { cn } from "@/lib/utils";

/** Cuánto se mueve la foto con cada toque de flecha (con Mayús, más). */
const PASO_CHICO = 2;
const PASO_GRANDE = 10;

type Sobrante = { x: number; y: number };

/**
 * El marco de la portada con su encuadre ajustable. La portada se muestra siempre en una caja más ancha que alta (16:7, igual que en la vitrina
 * pública y en la del profesional) y queda una parte de la foto afuera: acá la institución elige cuál. «Ajustar encuadre» deja arrastrar la foto
 * dentro del marco (con el dedo o el mouse), o moverla con las barras o las flechas del teclado, y «Centrar» la vuelve al medio. Lo que elige sale
 * como un `object-position` ("30% 62%", ver src/lib/encuadre.ts) por `onEncuadre`; el formulario que la usa lo guarda con el resto.
 *
 * `acciones` son los botones de siempre (subir, cambiar, quitar), arriba a la derecha: mientras se encuadra quedan escondidos (no desmontados, para
 * no perder una subida en curso). `children` se dibujan adentro del marco (un error, por ejemplo).
 */
export function PortadaConEncuadre({
  url,
  encuadre,
  onEncuadre,
  acciones,
  alt = "Foto de portada",
  children,
}: {
  /** La portada que está puesta ("" si no hay). */
  url: string;
  /** El encuadre elegido ("30% 62%"); vacío = el punto de siempre de esa foto. */
  encuadre: string;
  onEncuadre: (texto: string) => void;
  acciones?: ReactNode;
  alt?: string;
  children?: ReactNode;
}) {
  const [editando, setEditando] = useState(false);
  const [moviendo, setMoviendo] = useState(false);
  const [sobrante, setSobrante] = useState<Sobrante>({ x: 0, y: 0 });
  const caja = useRef<HTMLDivElement>(null);
  const imagen = useRef<HTMLImageElement>(null);
  const agarre = useRef<{ x: number; y: number; desde: Encuadre; sobrante: Sobrante } | null>(null);

  const actual = encuadreInicial(url, encuadre);

  /** Cuánto de la foto queda afuera del marco en este momento (depende del tamaño de la foto y del ancho de la pantalla). */
  const medir = (): Sobrante => {
    const foto = imagen.current;
    const marco = caja.current;
    if (!foto || !marco) return { x: 0, y: 0 };
    return sobranteDeCover({ ancho: foto.naturalWidth, alto: foto.naturalHeight }, { ancho: marco.clientWidth, alto: marco.clientHeight });
  };

  const empezar = () => {
    setSobrante(medir());
    setEditando(true);
  };

  const cambiar = (nuevo: Encuadre) => onEncuadre(textoDeEncuadre(nuevo));

  const alAgarrar = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!editando || e.button !== 0) return;
    const medido = medir();
    setSobrante(medido);
    agarre.current = { x: e.clientX, y: e.clientY, desde: actual, sobrante: medido };
    e.currentTarget.setPointerCapture(e.pointerId);
    setMoviendo(true);
  };
  const alMover = (e: React.PointerEvent<HTMLDivElement>) => {
    const a = agarre.current;
    if (!a) return;
    cambiar(moverEncuadre(a.desde, e.clientX - a.x, e.clientY - a.y, a.sobrante));
  };
  const alSoltar = () => {
    agarre.current = null;
    setMoviendo(false);
  };

  const alTeclear = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!editando) return;
    const paso = e.shiftKey ? PASO_GRANDE : PASO_CHICO;
    const delta: Record<string, [number, number]> = {
      ArrowLeft: [-paso, 0],
      ArrowRight: [paso, 0],
      ArrowUp: [0, -paso],
      ArrowDown: [0, paso],
    };
    const mover = delta[e.key];
    if (!mover) return;
    e.preventDefault();
    // Con un eje sin sobrante (la foto tiene justo la proporción del marco) esa flecha no hace nada.
    cambiar({
      x: sobrante.x > 0 ? Math.min(100, Math.max(0, actual.x + mover[0])) : actual.x,
      y: sobrante.y > 0 ? Math.min(100, Math.max(0, actual.y + mover[1])) : actual.y,
    });
  };

  const sinSobrante = sobrante.x < 1 && sobrante.y < 1;

  return (
    <>
      {editando && url && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-linea bg-superficie px-4 py-3">
          <p className="m-0 basis-full text-[13px] leading-snug text-apagado">
            {sinSobrante
              ? "Esta foto entra entera en el marco: no hace falta moverla."
              : "Arrastrá la foto para elegir qué parte se ve, o usá las barras. Así la van a ver los profesionales."}
          </p>
          <BarraDeEje
            etiqueta="Izquierda a derecha"
            desde="Izquierda"
            hasta="Derecha"
            valor={actual.x}
            deshabilitada={sobrante.x < 1}
            onCambio={(x) => cambiar({ x, y: actual.y })}
          />
          <BarraDeEje
            etiqueta="Arriba a abajo"
            desde="Arriba"
            hasta="Abajo"
            valor={actual.y}
            deshabilitada={sobrante.y < 1}
            onCambio={(y) => cambiar({ x: actual.x, y })}
          />
          <div className="ml-auto flex gap-2">
            <Boton tamano="sm" variante="secundario" onClick={() => cambiar(ENCUADRE_CENTRADO)} disabled={sinSobrante}>
              Centrar
            </Boton>
            <Boton tamano="sm" onClick={() => setEditando(false)}>
              Listo
            </Boton>
          </div>
        </div>
      )}

      <div
        ref={caja}
        // El mismo marco que la vitrina pública: lo que se ve acá es lo que van a ver los profesionales.
        className={cn(
          "relative aspect-[16/7] w-full bg-[linear-gradient(135deg,#16214F,#2A3A7A)]",
          editando && url && "touch-none outline-2 -outline-offset-2 outline-naranja",
          editando && url && (moviendo ? "cursor-grabbing" : "cursor-grab"),
        )}
        {...(editando && url
          ? {
              onPointerDown: alAgarrar,
              onPointerMove: alMover,
              onPointerUp: alSoltar,
              onPointerCancel: alSoltar,
              onKeyDown: alTeclear,
              tabIndex: 0,
              role: "group",
              "aria-label": "Foto de portada: arrastrala o usá las flechas del teclado para elegir qué parte se ve",
            }
          : {})}
      >
        {url && (
          // eslint-disable-next-line @next/next/no-img-element -- portada subida por la institución, tamaño libre
          <img
            ref={imagen}
            src={url}
            alt={alt}
            draggable={false}
            onLoad={() => setSobrante(medir())}
            style={{ objectPosition: posicionDePortada(url, encuadre) }}
            className="block size-full object-cover select-none"
          />
        )}
        <div className={cn("absolute top-3 right-3 flex flex-wrap items-start justify-end gap-2", editando && url && "hidden")}>
          {url && (
            <Boton tamano="sm" variante="secundario" onClick={empezar}>
              Ajustar encuadre
            </Boton>
          )}
          {acciones}
        </div>
        {children}
      </div>
    </>
  );
}

function BarraDeEje({
  etiqueta,
  desde,
  hasta,
  valor,
  deshabilitada,
  onCambio,
}: {
  etiqueta: string;
  desde: string;
  hasta: string;
  valor: number;
  deshabilitada: boolean;
  onCambio: (valor: number) => void;
}) {
  return (
    <label className={cn("flex min-w-[220px] flex-1 items-center gap-2 text-xs font-medium text-apagado", deshabilitada && "opacity-50")}>
      <span aria-hidden>{desde}</span>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={Math.round(valor)}
        disabled={deshabilitada}
        onChange={(e) => onCambio(Number(e.target.value))}
        aria-label={etiqueta}
        className="h-6 min-w-0 flex-1 cursor-pointer accent-navy-700 disabled:cursor-not-allowed"
      />
      <span aria-hidden>{hasta}</span>
    </label>
  );
}
