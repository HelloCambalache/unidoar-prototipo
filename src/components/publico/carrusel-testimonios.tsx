"use client";

import { useEffect, useState } from "react";
import { Avatar } from "@/components/ui/insignia";
import { focoDeFoto } from "@/lib/fotos";
import { cn, iniciales } from "@/lib/utils";
import { Imagen } from "./imagen";

type Testimonio = { id: string; cita: string; autor: string; cargo: string; fotoUrl: string | null };

/**
 * Testimonios de a uno con puntos para elegir. Rota solo cada 5 s, salvo que la persona
 * prefiera menos movimiento o tenga el mouse / el foco encima.
 */
export function CarruselTestimonios({
  testimonios,
  colorAcento,
  colorSobreAcento,
  colorNombre,
}: {
  testimonios: Testimonio[];
  /** Fondo del globo de comillas y del punto activo. */
  colorAcento: string;
  colorSobreAcento: string;
  /** Color del nombre (el de la categoría, oscurecido si hace falta para que contraste). */
  colorNombre: string;
}) {
  const [indice, setIndice] = useState(0);
  const [pausado, setPausado] = useState(false);
  const total = testimonios.length;

  useEffect(() => {
    if (total < 2 || pausado) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setIndice((i) => (i + 1) % total), 5000);
    return () => clearInterval(t);
  }, [total, pausado]);

  if (total === 0) return null;
  const actual = testimonios[indice % total]!;

  return (
    <section
      aria-roledescription="carrusel"
      aria-label="Testimonios"
      className="border-b border-borde bg-superficie px-10 py-[60px] max-[560px]:px-4"
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
      onFocus={() => setPausado(true)}
      onBlur={() => setPausado(false)}
    >
      <div className="relative mx-auto max-w-[640px]">
        <div
          aria-hidden
          className="absolute top-4 right-[26px] -bottom-4 left-[26px] rounded-panel bg-white opacity-45 shadow-tarjeta"
        />
        <div
          aria-hidden
          className="absolute top-2 right-[13px] -bottom-2 left-[13px] rounded-panel bg-white opacity-75 shadow-tarjeta"
        />
        <div className="relative rounded-panel bg-white px-[46px] pt-[42px] pb-[30px] text-center shadow-[0_16px_38px_rgba(31,36,33,.10)] max-[560px]:px-6">
          <span
            aria-hidden
            style={{ background: colorAcento, color: colorSobreAcento, boxShadow: `0 6px 14px ${colorAcento}59` }}
            className="absolute -top-[22px] left-1/2 inline-flex size-11 -translate-x-1/2 items-center justify-center rounded-full font-serif text-[26px] leading-none font-bold"
          >
            “
          </span>
          <div key={actual.id} className="pub-testimonio">
            <div className="mx-auto mt-1.5 mb-3.5 w-fit rounded-full shadow-[0_4px_12px_rgba(31,36,33,.14)]">
              {actual.fotoUrl ? (
                <Imagen src={actual.fotoUrl} alt="" style={{ objectPosition: focoDeFoto(actual.fotoUrl) }} className="block size-[60px] rounded-full object-cover" />
              ) : (
                <Avatar iniciales={iniciales(actual.autor)} tamano={60} />
              )}
            </div>
            <p
              style={{ color: colorNombre }}
              className="mb-4 font-display text-[15px] leading-tight font-bold tracking-[-0.01em]"
            >
              {actual.autor}
            </p>
            <blockquote className="m-0 mb-3 text-xl leading-normal text-balance text-tinta max-[560px]:text-lg">
              “{actual.cita}”
            </blockquote>
            <p className="m-0 mb-[22px] text-[13px] leading-snug text-sutil">{actual.cargo}</p>
          </div>
          {total > 1 && (
            <div className="flex justify-center gap-2">
              {testimonios.map((t, i) => (
                <button
                  key={t.id}
                  type="button"
                  aria-label={`Ver testimonio ${i + 1} de ${total}`}
                  aria-current={i === indice ? "true" : undefined}
                  onClick={() => setIndice(i)}
                  style={i === indice ? { background: colorAcento } : undefined}
                  className={cn(
                    "h-2 rounded-full transition-[width,background-color] duration-[250ms] focus-visible:ring-2 focus-visible:ring-navy-700/40 focus-visible:outline-none",
                    i === indice ? "w-[22px]" : "w-2 bg-borde hover:bg-borde-fuerte",
                  )}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
