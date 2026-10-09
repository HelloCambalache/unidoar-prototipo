import Link from "next/link";
import { BotonLink } from "@/components/ui/button";
import type { CategoriaDocente } from "@/db/schema";
import { CATEGORIAS, CATEGORIA_INFO } from "@/lib/catalogo";
import { focoDeFoto } from "@/lib/fotos";
import { plural, RUTA_REGISTRO_DOCENTE, RUTA_REGISTRO_INSTITUCION } from "@/lib/publico";
import type { ConteoCategoria } from "@/lib/queries/publico";
import { CATEGORIAS_PUBLICAS } from "./categorias";

const FOTOS_HERO = [
  { src: "/assets/hero-aula.jpg", demora: "0s" },
  { src: "/assets/hero-entrenador.jpg", demora: "5s" },
  { src: "/assets/hero-universidad.png", demora: "10s" },
];

const FOTO_MOSAICO: Record<CategoriaDocente, string> = {
  educador: "/assets/cat-docentes.jpg",
  entrenador: "/assets/tile-entrenadores.jpg",
  guardavidas: "/assets/cat-guardavidas.jpg",
};

const TILE =
  "relative overflow-hidden rounded-[18px] bg-navy-700 transition-[transform,box-shadow] duration-[180ms] hover:-translate-y-[3px] focus-visible:ring-[3px] focus-visible:ring-navy-700/40 focus-visible:outline-none";

/** Hero de la landing: titular, accesos por rol y mosaico con las tres categorías. */
export function HeroHome({ conteos }: { conteos: Record<CategoriaDocente, ConteoCategoria> }) {
  return (
    <section className="relative overflow-hidden bg-superficie px-12 pt-[76px] pb-16 max-[900px]:px-6 max-[900px]:pt-14 max-[900px]:pb-12">
      <div aria-hidden className="pub-grid-claro pointer-events-none absolute inset-0 opacity-50" />
      <span
        aria-hidden
        className="pointer-events-none absolute -top-[120px] -right-20 size-80 rounded-full bg-[radial-gradient(circle,rgba(221,85,63,.16),transparent_70%)]"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-[140px] -left-[90px] size-[340px] rounded-full bg-[radial-gradient(circle,rgba(130,216,233,.22),transparent_70%)]"
      />

      <div className="relative mx-auto max-w-[1160px] text-center">
        <h1 className="mx-auto mt-[18px] mb-4 max-w-[22ch] font-display text-[52px] leading-[1.1] font-bold tracking-[-0.035em] text-balance text-navy-700 max-[900px]:text-[42px] max-[560px]:text-[32px]">
          Donde el talento de la educación, el deporte y el arte hacen match con las instituciones.
        </h1>
        <p className="mx-auto max-w-[740px] text-[17px] leading-[1.6] text-apagado">
          En UNIDOAR, nuestra tecnología conecta de manera directa e inteligente a profesionales con colegios, clubes,
          institutos de idiomas y academias. Una app simple y accesible para resolver búsquedas, postulaciones y
          coberturas de trabajo en forma inmediata.
        </p>

        <div className="mt-[30px] mb-[46px] flex flex-wrap justify-center gap-3">
          <div className="flex items-center gap-3 rounded-full border border-borde bg-white py-[7px] pr-[7px] pl-5 max-[560px]:w-full max-[560px]:justify-between">
            <span className="text-sm leading-none font-medium whitespace-nowrap text-apagado">Soy institución</span>
            <BotonLink
              href={RUTA_REGISTRO_INSTITUCION}
              variante="cta"
              className="h-10 min-h-10 rounded-full px-5 text-sm"
            >
              Busco profesionales
            </BotonLink>
          </div>
          <div className="flex items-center gap-3 rounded-full border border-borde bg-white py-[7px] pr-[7px] pl-5 max-[560px]:w-full max-[560px]:justify-between">
            <span className="text-sm leading-none font-medium whitespace-nowrap text-apagado">Soy profesional</span>
            <BotonLink
              href={RUTA_REGISTRO_DOCENTE}
              variante="primario"
              className="h-10 min-h-10 rounded-full px-5 text-sm"
            >
              Busco trabajo
            </BotonLink>
          </div>
        </div>

        <div className="grid auto-rows-[150px] grid-cols-4 gap-3.5 text-left max-[900px]:auto-rows-[minmax(140px,auto)] max-[900px]:grid-cols-2 max-[560px]:auto-rows-[minmax(128px,auto)] max-[560px]:grid-cols-1">
          <Link
            href="/categorias"
            className={`${TILE} col-span-2 row-span-2 block hover:shadow-[0_16px_38px_rgba(4,11,53,.22)] max-[560px]:col-span-1`}
          >
            {FOTOS_HERO.map((f) => (
              <span
                key={f.src}
                aria-hidden
                style={{ backgroundImage: `url(${f.src})`, backgroundPosition: focoDeFoto(f.src), animationDelay: f.demora }}
                className="pub-hero-fade absolute inset-0 bg-cover"
              />
            ))}
            <span aria-hidden className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,11,53,0)_40%,rgba(4,11,53,.78)_100%)]" />
            <span className="absolute right-6 bottom-[22px] left-6 text-white">
              <span className="mb-[5px] block font-display text-[26px] leading-[1.15] font-bold tracking-[-0.02em] max-[560px]:text-xl">
                Educadores, entrenadores y guardavidas
              </span>
              <span className="block text-sm leading-normal text-white/80">Una sola red para todas las categorías.</span>
            </span>
          </Link>

          <Link
            href="/quienes-somos"
            className={`${TILE} flex flex-col justify-center bg-naranja p-5 text-white hover:text-white max-[900px]:col-span-2 max-[560px]:col-span-1`}
          >
            <svg
              aria-hidden
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#fff"
              strokeWidth="1.8"
              className="mb-2.5 flex-none"
            >
              <path d="M9 12l2 2 4-4" />
              <circle cx="12" cy="12" r="9" />
            </svg>
            <span className="mb-[5px] block font-display text-[17px] leading-[1.2] font-bold tracking-[-0.015em]">
              Documentación verificada
            </span>
            <span className="block text-[12.5px] leading-[1.45] text-white/85">
              DNI, título y buena conducta, chequeados antes de que aparezcan.
            </span>
          </Link>

          {CATEGORIAS.map((c) => {
            const n = conteos[c].verificados;
            return (
              <Link key={c} href={CATEGORIAS_PUBLICAS[c].ruta} className={`${TILE} block`}>
                <span
                  aria-hidden
                  style={{ backgroundImage: `url(${FOTO_MOSAICO[c]})`, backgroundPosition: focoDeFoto(FOTO_MOSAICO[c]) }}
                  className="absolute inset-0 bg-cover"
                />
                <span aria-hidden className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,11,53,.05)_45%,rgba(4,11,53,.82)_100%)]" />
                <span className="absolute right-[18px] bottom-4 left-[18px] text-white">
                  <span
                    aria-hidden
                    style={{ background: CATEGORIA_INFO[c].color }}
                    className="mb-2 block h-[3px] w-[22px] rounded-full"
                  />
                  <span className="block font-display text-[17px] leading-[1.2] font-bold tracking-[-0.015em]">
                    {CATEGORIAS_PUBLICAS[c].nombre}
                  </span>
                  {n > 0 && (
                    <span className="mt-1 block text-xs leading-snug text-white/80">
                      {plural(n, "perfil verificado", "perfiles verificados")}
                    </span>
                  )}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
