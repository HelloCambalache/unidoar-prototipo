import Link from "next/link";
import { Icono } from "@/components/icons";
import type { ResultadoDeAyuda } from "@/lib/ayuda";

/** Buscador del centro de ayuda: un formulario común (GET), sin JavaScript. La dirección guarda la consulta en `?q=`. */
export function BuscadorDeAyuda({ accion, consulta, claro = false }: { accion: string; consulta: string; claro?: boolean }) {
  return (
    <form action={accion} role="search" className="relative w-full max-w-[560px]">
      <Icono nombre="buscar" tamano={18} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-sutil" />
      <input
        type="search"
        name="q"
        defaultValue={consulta}
        maxLength={80}
        aria-label="Buscar en la ayuda"
        placeholder="Buscá una guía o una pregunta"
        enterKeyHint="search"
        className={`h-12 w-full rounded-full border pr-28 pl-11 text-[15px] text-tinta placeholder:text-sutil focus:outline-none focus:ring-[3px] focus:ring-celeste/50 ${claro ? "border-borde bg-white" : "border-white/20 bg-white"}`}
      />
      <button
        type="submit"
        className="absolute top-1.5 right-1.5 h-9 rounded-full bg-navy-700 px-5 text-[13.5px] font-semibold text-white transition-colors hover:bg-navy-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-700"
      >
        Buscar
      </button>
    </form>
  );
}

/** Los resultados de una búsqueda: guías y preguntas frecuentes, con el manual al que pertenecen. */
export function ResultadosDeAyuda({ consulta, resultados }: { consulta: string; resultados: ResultadoDeAyuda[] }) {
  return (
    <section aria-labelledby="resultados-titulo" aria-live="polite">
      <h2 id="resultados-titulo" className="font-display m-0 mb-4 text-[22px] leading-tight font-semibold tracking-[-0.02em] text-navy-900">
        {resultados.length === 0 ? `No encontramos nada para «${consulta}»` : `${resultados.length} ${resultados.length === 1 ? "resultado" : "resultados"} para «${consulta}»`}
      </h2>
      {resultados.length === 0 ? (
        <p className="m-0 text-[15px] leading-normal text-apagado">Probá con otras palabras o mirá los manuales completos de abajo.</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {resultados.map((r) => (
            <li key={`${r.href}-${r.titulo}`}>
              <Link
                href={r.href}
                className="group block rounded-tarjeta bg-white p-5 shadow-tarjeta transition-shadow hover:shadow-tarjeta-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-700"
              >
                <span className="mb-1.5 flex flex-wrap items-center gap-2 text-[11.5px] leading-none font-semibold tracking-[.05em] text-sutil uppercase">
                  {r.manual} · {r.tipo === "guia" ? "Guía" : "Pregunta frecuente"}
                </span>
                <span className="mb-1 block text-[16px] leading-snug font-semibold text-tinta group-hover:text-navy-700">{r.titulo}</span>
                {r.resumen && <span className="block text-[13.5px] leading-normal text-apagado">{r.resumen}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
