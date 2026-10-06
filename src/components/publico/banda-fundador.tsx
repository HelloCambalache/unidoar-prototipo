import { BotonLink } from "@/components/ui/button";
import type { CategoriaDocente } from "@/db/schema";
import { CUPOS_FUNDADOR, RUTA_REGISTRO_INSTITUCION } from "@/lib/publico";
import { BandaCTA } from "./banda-cta";
import { estiloBotonAcento } from "./categorias";

/** Cierre de las landings: invita al plan Fundador mientras queden cupos (el conteo sale de la base). */
export function BandaFundador({ cupos, categoria }: { cupos: number; categoria?: CategoriaDocente }) {
  const hayCupos = cupos > 0;
  return (
    <BandaCTA
      etiqueta={
        <span
          className="inline-flex items-center rounded-full bg-ambar/20 px-2.5 py-[5px] text-xs leading-none font-semibold text-[#FDD9AE]"
        >
          {hayCupos ? `Plan Fundador · quedan ${cupos} de ${CUPOS_FUNDADOR} cupos` : "Plan Fundador · cupos completos"}
        </span>
      }
      titulo={hayCupos ? "Entrá con precio de fundador y quedátelo" : "Sumá tu institución y cubrí tus búsquedas en días"}
      acciones={
        <>
          <BotonLink
            href={RUTA_REGISTRO_INSTITUCION}
            variante="cta"
            tamano="lg"
            style={categoria ? estiloBotonAcento(categoria) : undefined}
            className="hover:brightness-95"
          >
            {hayCupos ? "Quiero el plan Fundador" : "Crear cuenta de institución"}
          </BotonLink>
          <BotonLink
            href="/planes"
            variante="secundario"
            tamano="lg"
            className="border-white/35 bg-transparent text-white hover:border-white/60 hover:bg-white/10 hover:text-white"
          >
            Ver planes
          </BotonLink>
        </>
      }
    />
  );
}
