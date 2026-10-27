import type { Metadata } from "next";
import Link from "next/link";
import { BandaDeContacto, BannerDeAyuda } from "@/components/ayuda/banner-de-ayuda";
import { BuscadorDeAyuda, ResultadosDeAyuda } from "@/components/ayuda/buscador-de-ayuda";
import { PreguntasFrecuentes } from "@/components/ayuda/preguntas-frecuentes";
import { Icono } from "@/components/icons";
import { sesionPublica } from "@/components/publico/sesion";
import { buscarEnAyuda, MANUALES, MANUALES_PUBLICOS, rutaDeManual, articulosDe, type ManualDeAyuda } from "@/lib/ayuda";

export const metadata: Metadata = {
  title: "Centro de ayuda",
  description: "Guías y preguntas frecuentes de UNIDOAR para profesionales (docentes, entrenadores y guardavidas) y para instituciones.",
};

const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

const ICONO_DE_MANUAL = { profesionales: "perfil", instituciones: "instituciones", equipo: "escudo" } as const;

function TarjetaDeManual({ manual }: { manual: ManualDeAyuda }) {
  return (
    <Link
      href={rutaDeManual(manual.perfil)}
      className="group flex h-full flex-col gap-3 rounded-tarjeta bg-white p-6 shadow-tarjeta transition-shadow hover:shadow-tarjeta-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-700"
    >
      <span aria-hidden className="inline-flex size-12 items-center justify-center rounded-2xl bg-navy-50 text-navy-700">
        <Icono nombre={ICONO_DE_MANUAL[manual.perfil]} tamano={24} trazo={1.7} />
      </span>
      <span className="font-display text-[20px] leading-tight font-semibold tracking-[-0.015em] text-navy-900 group-hover:text-navy-700">{manual.titulo}</span>
      <span className="text-[14.5px] leading-normal text-apagado">{manual.bajada}</span>
      <span className="mt-auto pt-1 text-[13px] font-semibold text-navy-700">
        {articulosDe(manual).length} guías · {manual.preguntas.length} preguntas →
      </span>
    </Link>
  );
}

export default async function CentroDeAyuda({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const q = uno(sp.q).trim().slice(0, 80);
  const sesion = await sesionPublica();
  // El manual del equipo es interno: se ofrece solo a quien entró con una cuenta admin, y se abre dentro del backoffice.
  const manuales = sesion.rol === "admin" ? [...MANUALES_PUBLICOS, MANUALES.equipo] : MANUALES_PUBLICOS;
  const resultados = q ? buscarEnAyuda(MANUALES_PUBLICOS, q) : null;

  return (
    <div className="mx-auto w-full max-w-[1100px] flex-1 px-12 pt-10 pb-14 max-[900px]:px-6 max-[560px]:pt-6 max-[560px]:pb-10">
      <BannerDeAyuda titulo="Centro de ayuda" bajada="Guías paso a paso y respuestas a las dudas más comunes, según quién seas.">
        <BuscadorDeAyuda accion="/ayuda" consulta={q} />
      </BannerDeAyuda>

      {resultados && (
        <div className="mb-12">
          <ResultadosDeAyuda consulta={q} resultados={resultados} />
        </div>
      )}

      <section aria-labelledby="manuales-titulo">
        <h2 id="manuales-titulo" className="font-display m-0 mb-4 text-[22px] leading-tight font-semibold tracking-[-0.02em] text-navy-900">
          Elegí tu manual
        </h2>
        <ul className={`m-0 grid list-none gap-4 p-0 max-[760px]:grid-cols-1 ${manuales.length > 2 ? "grid-cols-3" : "grid-cols-2"}`}>
          {manuales.map((m) => (
            <li key={m.perfil}>
              <TarjetaDeManual manual={m} />
            </li>
          ))}
        </ul>
      </section>

      {!resultados && (
        <div className="mt-12 grid grid-cols-2 items-start gap-8 max-[900px]:grid-cols-1">
          {MANUALES_PUBLICOS.map((m) => (
            <div key={m.perfil}>
              <PreguntasFrecuentes id={`preguntas-${m.perfil}`} titulo={`Preguntas frecuentes: ${m.nombre.toLowerCase()}`} preguntas={m.preguntas.slice(0, 5)} />
              <Link href={`${rutaDeManual(m.perfil)}#preguntas`} className="mt-3 inline-block text-[13.5px] font-semibold text-navy-700 hover:underline">
                Ver todas las preguntas para {m.nombre.toLowerCase()} →
              </Link>
            </div>
          ))}
        </div>
      )}

      <BandaDeContacto />
    </div>
  );
}
