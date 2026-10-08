import type { Metadata } from "next";
import { BotonLink } from "@/components/ui/button";
import { BandaCTA } from "@/components/publico/banda-cta";

export const metadata: Metadata = {
  title: "Quiénes somos",
  description: "Conectamos instituciones con los educadores, entrenadores y guardavidas de su zona.",
};

const VALORES = [
  {
    titulo: "Confianza verificable",
    texto:
      "Identidad, título profesional y certificado de buena conducta, chequeados antes de que la institución vea el perfil.",
  },
  {
    titulo: "Velocidad real",
    texto: "Cubrir una suplencia no puede tardar semanas. Publicar, ver postulantes y decidir, en días.",
  },
  {
    titulo: "Cercanía de zona",
    texto: "Profesionales e instituciones del mismo radio geográfico, para que el traslado nunca sea el problema.",
  },
];

export default function QuienesSomos() {
  return (
    <>
      <section className="bg-[linear-gradient(180deg,#16214F_0%,#1B2A5E_100%)] px-12 pt-[72px] pb-[60px] text-center text-white max-[560px]:px-6 max-[560px]:pt-12">
        <span className="inline-block rounded-full bg-celeste/18 px-2.5 py-[5px] text-xs leading-none font-semibold text-celeste">
          Quiénes somos
        </span>
        <h1 className="mx-auto mt-3.5 mb-3.5 max-w-[24ch] text-[40px] leading-[1.15] font-semibold tracking-[-0.025em] text-balance max-[560px]:text-[30px]">
          Conectamos instituciones con los profesionales de su zona.
        </h1>
        <p className="mx-auto max-w-[660px] text-[17px] leading-[1.6] text-white/70">
          UNIDOAR nace para resolver un problema simple y frecuente: encontrar un profesor, una maestra, un entrenador o
          un guardavidas de confianza, rápido, sin depender de grupos de WhatsApp ni conocidos.
        </p>
      </section>

      <section className="mx-auto w-full max-w-[900px] flex-1 px-12 py-16 max-[560px]:px-6">
        <div className="flex flex-col gap-9">
          <div>
            <h2 className="mb-2.5 text-[22px] leading-[1.3] font-semibold tracking-[-0.02em] text-tinta">
              Nuestra historia
            </h2>
            <p className="text-[15px] leading-[1.7] text-tinta-2">
              Empezamos viendo cómo colegios, jardines, clubes y natatorios de todo el país cubrían sus búsquedas a las
              apuradas: mensajes de texto, recomendaciones de boca en boca y currículums sin verificar. Del otro lado,
              educadores y entrenadores con buena formación que no tenían forma de mostrarse frente a instituciones que
              los estaban buscando. UNIDOAR conecta a los dos lados con perfiles verificados y un proceso ordenado, para
              que contratar y postularse dejen de ser un problema.
            </p>
          </div>
          <div>
            <h2 className="mb-2.5 text-[22px] leading-[1.3] font-semibold tracking-[-0.02em] text-tinta">
              Qué nos importa
            </h2>
            <ul className="m-0 mt-4 grid list-none grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-5 p-0">
              {VALORES.map((v) => (
                <li key={v.titulo} className="rounded-[10px] border border-borde p-5">
                  <h3 className="mb-1.5 text-[15px] leading-[1.3] font-semibold text-navy-700">{v.titulo}</h3>
                  <p className="text-sm leading-normal text-apagado">{v.texto}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <BandaCTA
        etiqueta={
          <span className="inline-flex rounded-full bg-celeste/18 px-2.5 py-[5px] text-xs leading-none font-semibold text-celeste">
            ¿Te sumás?
          </span>
        }
        titulo="Sumate como institución o como profesional"
        texto="Es gratis para profesionales y toma dos minutos empezar."
        acciones={
          <BotonLink href="/registro" variante="cta" tamano="lg">
            Empezar ahora
          </BotonLink>
        }
      />
    </>
  );
}
