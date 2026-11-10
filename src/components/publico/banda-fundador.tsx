import { BotonLink } from "@/components/ui/button";
import type { CategoriaDocente } from "@/db/schema";
import { plazoDeFundadoras } from "@/lib/planes";
import { RUTA_REGISTRO_INSTITUCION } from "@/lib/publico";
import { cuposDeFundadoras, type CuposDeFundadoras } from "@/lib/queries/fundadoras";
import { BandaCTA } from "./banda-cta";
import { BandaInstituciones } from "./banda-instituciones";
import { estiloBotonAcento } from "./categorias";

/** El cierre de la home y de las landings: lee si se ofrece ser fundadora (y cuántos días quedan) y dibuja la banda que corresponde. */
export async function BandaDeCierre({ categoria }: { categoria?: CategoriaDocente }) {
  return <BandaFundador cupos={await cuposDeFundadoras()} categoria={categoria} />;
}

/**
 * Cierre de la home y de las landings. Mientras se ofrezca ser institución fundadora (el Plan Fundador es para las primeras N que se suman)
 * invita a serlo, sin decir cuánto cuesta ni cuántos lugares quedan (dice los días que faltan para el cierre, o que los lugares son limitados si
 * no hay fecha); con el cupo completo, la fecha vencida o el plan apagado vuelve a la invitación de siempre. Es una banda de servidor: sale de la
 * base (`cuposDeFundadoras`).
 */
export function BandaFundador({ cupos, categoria }: { cupos: CuposDeFundadoras; categoria?: CategoriaDocente }) {
  if (!cupos.hay) return <BandaInstituciones categoria={categoria} />;
  return (
    <BandaCTA
      etiqueta={
        <span className="inline-flex items-center rounded-full bg-ambar/20 px-2.5 py-[5px] text-xs leading-none font-semibold text-[#FDD9AE]">
          Institución fundadora · {plazoDeFundadoras(cupos.dias).etiqueta.toLowerCase()}
        </span>
      }
      titulo={`Sé una de las primeras ${cupos.total} instituciones de UNIDOAR`}
      texto="Las que se suman ahora quedan como fundadoras: un valor preferencial, la insignia en su perfil y su logo en la portada."
      acciones={
        <>
          <BotonLink
            href={RUTA_REGISTRO_INSTITUCION}
            variante="cta"
            tamano="lg"
            style={categoria ? estiloBotonAcento(categoria) : undefined}
            className="hover:brightness-95"
          >
            Quiero ser fundadora
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
