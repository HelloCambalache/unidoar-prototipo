"use client";

import { useState } from "react";
import { SubirArchivo } from "@/components/ui/subir-archivo";
import { focoDeFoto } from "@/lib/fotos";
import { MAX_FOTOS } from "@/lib/vitrina";

export type FotoEditable = {
  /** Clave estable para React: el id de la base, o uno provisorio mientras la foto no se guardó. */
  clave: string;
  /** Id de `institucion_fotos`; ausente en las fotos nuevas. */
  id?: string;
  url: string;
  etiqueta: string;
};

/**
 * Galería de instalaciones: se suben fotos, se etiquetan ("Patio y canchas", "Natatorio") y se quitan.
 * Los cambios quedan en el formulario y se guardan con "Guardar cambios"; la primera foto es la destacada.
 */
export function VitrinaGaleria({
  fotos,
  onCambiar,
  errores,
  disponible,
}: {
  fotos: FotoEditable[];
  onCambiar: (nuevas: FotoEditable[]) => void;
  errores: Record<string, string>;
  disponible: boolean;
}) {
  // Cada foto subida reinicia el botón de subida: si no, seguiría mostrando "✓" de la anterior.
  const [subida, setSubida] = useState(0);
  const llena = fotos.length >= MAX_FOTOS;

  const agregar = (url: string) => {
    if (!url) return;
    onCambiar([...fotos, { clave: `nueva-${crypto.randomUUID()}`, url, etiqueta: "" }]);
    setSubida((n) => n + 1);
  };

  return (
    <div>
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-1.5">
        <span className="text-base leading-none font-semibold">Instalaciones</span>
        {llena ? (
          <span className="text-[13px] text-sutil">Llegaste al máximo de {MAX_FOTOS} fotos.</span>
        ) : (
          <SubirArchivo
            key={subida}
            bucket="publico"
            carpeta="instalaciones"
            nombre="instalacion"
            textoBoton="+ Agregar foto"
            etiqueta="foto de las instalaciones"
            disponible={disponible}
            variante="boton"
            onCambio={agregar}
          />
        )}
      </div>

      {errores.fotos && (
        <p role="alert" className="m-0 mb-2 text-xs text-[#b91c1c]">
          {errores.fotos}
        </p>
      )}

      {fotos.length === 0 ? (
        <p className="m-0 rounded-interno border-[1.5px] border-dashed border-borde-fuerte px-5 py-8 text-center text-[13.5px] leading-normal text-apagado">
          Todavía no cargaste fotos. Mostrales a los profesionales el patio, las aulas, el natatorio, la biblioteca…
        </p>
      ) : (
        <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3 p-0 max-[560px]:grid-cols-2">
          {fotos.map((f, i) => (
            <li key={f.clave} className="flex min-w-0 flex-col gap-1.5">
              <div className="relative aspect-[4/3] overflow-hidden rounded-lg border border-borde bg-[#F0EFEA]">
                {/* eslint-disable-next-line @next/next/no-img-element -- fotos subidas por la institución, de tamaños libres */}
                <img
                  src={f.url}
                  alt={f.etiqueta || `Foto ${i + 1} de las instalaciones`}
                  style={{ objectPosition: focoDeFoto(f.url) }}
                  className="size-full object-cover"
                />
                {i === 0 && (
                  <span className="absolute bottom-1.5 left-1.5 rounded-full bg-black/60 px-2 py-[3px] text-[11px] leading-none font-semibold text-white">
                    Destacada
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => onCambiar(fotos.filter((x) => x.clave !== f.clave))}
                  aria-label={`Quitar la foto ${f.etiqueta || i + 1}`}
                  className="absolute top-1.5 right-1.5 inline-flex size-7 items-center justify-center rounded-full bg-white/90 text-[13px] text-tinta shadow-[0_1px_4px_rgba(0,0,0,.25)] transition-colors hover:bg-white hover:text-[#dc2626] focus-visible:ring-[3px] focus-visible:ring-navy-700/30 focus-visible:outline-none"
                >
                  <span aria-hidden>✕</span>
                </button>
              </div>
              <input
                value={f.etiqueta}
                onChange={(e) => onCambiar(fotos.map((x) => (x.clave === f.clave ? { ...x, etiqueta: e.target.value } : x)))}
                aria-label={`Etiqueta de la foto ${i + 1}`}
                aria-invalid={Boolean(errores[`fotos.${i}.etiqueta`])}
                placeholder="Etiqueta (ej. Natatorio)"
                maxLength={60}
                className="w-full rounded-lg border border-borde bg-white px-2.5 py-1.5 text-[13px] text-tinta placeholder:text-sutil focus:border-navy-700 focus:ring-[3px] focus:ring-navy-700/20 focus:outline-none"
              />
              {(errores[`fotos.${i}.url`] || errores[`fotos.${i}.etiqueta`]) && (
                <p role="alert" className="m-0 text-xs text-[#b91c1c]">
                  {errores[`fotos.${i}.url`] ?? errores[`fotos.${i}.etiqueta`]}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
