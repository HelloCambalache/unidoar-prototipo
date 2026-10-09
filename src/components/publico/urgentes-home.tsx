import Link from "next/link";
import { focoDeFoto } from "@/lib/fotos";
import type { BusquedaPublica } from "@/lib/queries/publico";
import { num } from "@/lib/publico";
import { RUTA_PUBLICAR_URGENTE } from "@/lib/publicar-busqueda";
import { ListaUrgentes } from "./lista-urgentes";
import type { SesionPublica } from "./sesion";

const TILE_DATO = "flex flex-col justify-center rounded-[18px] border p-[22px]";
const CIFRA = "font-display text-[34px] leading-none font-bold tracking-[-0.03em]";

/**
 * "Búsquedas urgentes" de la landing: el mosaico de mensajes y, debajo, las suplencias
 * rápidas que hay abiertas ahora mismo (salen de la base, con su plazo).
 */
export function UrgentesHome({
  urgentes,
  cantidadUrgentes,
  sesion,
}: {
  urgentes: BusquedaPublica[];
  cantidadUrgentes: number;
  sesion: SesionPublica;
}) {
  return (
    <section className="relative overflow-hidden border-b border-borde bg-superficie px-12 py-[72px] max-[900px]:px-6 max-[900px]:py-[52px]">
      <div aria-hidden className="pub-grid-claro pointer-events-none absolute inset-0 opacity-45" />
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-[130px] -left-20 size-80 rounded-full bg-[radial-gradient(circle,rgba(221,85,63,.16),transparent_70%)]"
      />
      <div className="relative mx-auto max-w-[1160px]">
        <div className="mb-3.5 flex items-center gap-[9px]">
          <span aria-hidden className="size-[9px] pub-pulso rounded-full bg-naranja" />
          <span className="text-xs leading-none font-semibold tracking-[.09em] text-naranja-ink uppercase">
            Búsquedas urgentes
          </span>
        </div>
        <h2 className="mb-3 max-w-[32ch] font-display text-[40px] leading-[1.1] font-bold tracking-[-0.03em] text-balance text-navy-700 max-[900px]:text-[30px]">
          Coberturas urgentes al alcance de tu mano
        </h2>
        <p className="mb-[30px] max-w-[660px] text-base leading-[1.6] text-apagado">
          Gestioná suplencias imprevistas de forma ágil y segura. Nuestra app acelera el contacto directo con perfiles
          validados para cubrir el puesto a la brevedad, sin esperar a la semana próxima.
        </p>

        <div className="grid auto-rows-[150px] grid-cols-4 gap-3.5 max-[900px]:grid-cols-2 max-[560px]:grid-cols-1">
          <div className="relative col-span-2 row-span-2 flex flex-col justify-between overflow-hidden rounded-[18px] bg-naranja p-7 max-[560px]:col-span-1">
            <span
              aria-hidden
              style={{ backgroundPosition: focoDeFoto("/assets/urgente-pizarron.jpg") }}
              className="absolute inset-0 bg-[url(/assets/urgente-pizarron.jpg)] bg-cover opacity-[.22]"
            />
            <div className="relative">
              <span className="inline-flex rounded-full bg-white/20 px-2.5 py-[5px] text-[11px] leading-none font-semibold text-white">
                Suplencia rápida
              </span>
              <div className="mt-3.5 font-display text-[26px] leading-[1.2] font-bold tracking-[-0.02em] text-white">
                Se enferma un profe un martes
              </div>
              <p className="mt-2 max-w-[32ch] text-[14.5px] leading-[1.55] text-white/85">
                Publicás la suplencia y el jueves ya tenés candidatos disponibles, con identidad y título verificados.
              </p>
            </div>
            <Link
              href={RUTA_PUBLICAR_URGENTE}
              className="relative inline-flex h-10 min-h-10 items-center self-start rounded-full bg-white px-[22px] text-sm leading-none font-semibold text-naranja transition-colors hover:bg-superficie hover:text-naranja focus-visible:ring-[3px] focus-visible:ring-white/60 focus-visible:outline-none"
            >
              Publicar una suplencia
            </Link>
          </div>

          <div className={`${TILE_DATO} border-borde bg-white`}>
            <div className={`${CIFRA} text-navy-700`}>2 min</div>
            <div className="mt-[7px] text-[13px] leading-[1.4] font-medium text-apagado">publicar la búsqueda</div>
          </div>
          <div className={`${TILE_DATO} border-transparent bg-ambar`}>
            <div className={`${CIFRA} text-tinta`}>{num(cantidadUrgentes)}</div>
            <div className="mt-[7px] text-[13px] leading-[1.4] font-medium text-tinta/75">
              {cantidadUrgentes === 1 ? "urgente abierta ahora" : "urgentes abiertas ahora"}
            </div>
          </div>
          <div className={`${TILE_DATO} border-transparent bg-celeste`}>
            <div className={`${CIFRA} text-navy-700`}>24/7</div>
            <div className="mt-[7px] text-[13px] leading-[1.4] font-medium text-navy-700/75">catálogo activo</div>
          </div>
          <div className={`${TILE_DATO} border-borde bg-white`}>
            <div className={`${CIFRA} text-navy-700`}>0</div>
            <div className="mt-[7px] text-[13px] leading-[1.4] font-medium text-apagado">comisión por contratar</div>
          </div>

          <Link
            href="/educadores"
            className="relative col-span-2 overflow-hidden rounded-[18px] bg-navy-700 transition-transform duration-[180ms] hover:-translate-y-[3px] focus-visible:ring-[3px] focus-visible:ring-navy-700/40 focus-visible:outline-none max-[560px]:col-span-1"
          >
            <span
              aria-hidden
              style={{ backgroundPosition: focoDeFoto("/assets/urgente-docentes.jpg") }}
              className="absolute inset-0 bg-[url(/assets/urgente-docentes.jpg)] bg-cover opacity-50"
            />
            <span
              aria-hidden
              className="absolute inset-0 bg-[linear-gradient(90deg,rgba(4,11,53,.88)_30%,rgba(4,11,53,.25)_100%)]"
            />
            <span className="absolute top-1/2 right-6 left-6 -translate-y-1/2 text-white">
              <span className="block font-display text-[19px] leading-tight font-bold tracking-[-0.015em]">
                Profesionales disponibles hoy
              </span>
              <span className="mt-[5px] block text-[13.5px] leading-normal text-white/80">
                Filtrados por zona, turno y disciplina.
              </span>
            </span>
          </Link>
        </div>

        <h3 className="mt-10 mb-4 text-lg leading-tight font-semibold text-tinta">Abiertas ahora</h3>
        <ListaUrgentes busquedas={urgentes} sesion={sesion} />
      </div>
    </section>
  );
}
