import { Icono } from "@/components/icons";
import type { PreguntaFrecuente } from "@/lib/ayuda";
import { BloquesDeAyuda } from "./bloques";

/** Preguntas frecuentes de un manual: cada una se despliega sola (sin JavaScript). */
export function PreguntasFrecuentes({
  preguntas,
  titulo = "Preguntas frecuentes",
  id = "preguntas",
}: {
  preguntas: PreguntaFrecuente[];
  titulo?: string;
  /** El ancla de la sección (`#preguntas` por defecto; la portada de la ayuda tiene una por manual). */
  id?: string;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-titulo`} className="scroll-mt-6">
      <h2 id={`${id}-titulo`} className="font-display m-0 mb-4 text-[22px] leading-tight font-semibold tracking-[-0.02em] text-navy-900">
        {titulo}
      </h2>
      <div className="rounded-tarjeta bg-white px-6 shadow-tarjeta max-[560px]:px-4">
        {preguntas.map((p) => (
          <details key={p.pregunta} className="group border-b border-linea last:border-b-0">
            <summary className="font-display flex cursor-pointer list-none items-center justify-between gap-4 rounded-caja py-4 text-[16px] leading-snug font-semibold text-tinta marker:content-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-700 [&::-webkit-details-marker]:hidden">
              {p.pregunta}
              <span
                aria-hidden
                className="inline-flex size-8 flex-none items-center justify-center rounded-full bg-navy-50 text-navy-700 transition-transform group-open:rotate-180"
              >
                <Icono nombre="chevron" tamano={16} trazo={2.2} />
              </span>
            </summary>
            <div className="pb-5">
              <BloquesDeAyuda bloques={p.respuesta} />
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
