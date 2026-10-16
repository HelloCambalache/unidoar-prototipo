import Link from "next/link";
import { Icono } from "@/components/icons";

/** A dónde lleva el botón: la publicación de una búsqueda con el tipo "Suplencia rápida" ya elegido. */
export const RUTA_BUSQUEDA_URGENTE = "/institucion/publicar?urgente=1";

/**
 * "Búsqueda urgente": el botón rojo al pie de Buscar profesionales. Es la herramienta fuerte de la app: publicar una búsqueda
 * rápida avisa enseguida (campanita y mail) a los profesionales que encajan, y vence a las 24 horas. Va en rojo a propósito,
 * para que sea lo primero que se vea al terminar de mirar la lista. El texto blanco sobre ese rojo cumple el contraste AA.
 */
export function BotonBusquedaUrgente() {
  return (
    <section
      aria-labelledby="busqueda-urgente-titulo"
      className="mt-8 flex flex-wrap items-center justify-between gap-x-6 gap-y-4 rounded-tarjeta border border-[#F0C3BE] bg-[#FDECEA] p-5 max-[620px]:flex-col max-[620px]:items-stretch"
    >
      <div className="min-w-0 flex-1">
        <h2 id="busqueda-urgente-titulo" className="m-0 mb-1 text-base leading-[1.3] font-semibold text-[#8E1B14]">
          ¿Lo necesitás para hoy o para mañana?
        </h2>
        <p className="m-0 text-[13.5px] leading-normal text-[#6E2A25]">
          Publicá una búsqueda urgente y avisamos enseguida a los profesionales que encajan con lo que necesitás.
        </p>
      </div>
      <Link
        href={RUTA_BUSQUEDA_URGENTE}
        className="inline-flex min-h-[52px] flex-none items-center justify-center gap-2 rounded-xl bg-[#C62828] px-7 text-base leading-none font-bold text-white shadow-[0_6px_16px_rgba(198,40,40,.32)] transition-[background-color,transform] duration-150 hover:-translate-y-px hover:bg-[#B71C1C] hover:text-white focus-visible:ring-[3px] focus-visible:ring-[#C62828]/40 focus-visible:outline-none max-[620px]:w-full"
      >
        <Icono nombre="rayo" tamano={18} trazo={2.2} />
        Búsqueda urgente
      </Link>
    </section>
  );
}
