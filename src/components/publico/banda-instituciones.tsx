import { BotonLink } from "@/components/ui/button";
import type { CategoriaDocente } from "@/db/schema";
import { RUTA_REGISTRO_INSTITUCION } from "@/lib/publico";
import { BandaCTA } from "./banda-cta";
import { estiloBotonAcento } from "./categorias";

/** Cierre de la home y de las landings: invita a una institución a crear su cuenta o a ver los planes. */
export function BandaInstituciones({ categoria }: { categoria?: CategoriaDocente }) {
  return (
    <BandaCTA
      titulo="Sumá tu institución y cubrí tus búsquedas en días"
      acciones={
        <>
          <BotonLink
            href={RUTA_REGISTRO_INSTITUCION}
            variante="cta"
            tamano="lg"
            style={categoria ? estiloBotonAcento(categoria) : undefined}
            className="hover:brightness-95"
          >
            Crear cuenta de institución
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
