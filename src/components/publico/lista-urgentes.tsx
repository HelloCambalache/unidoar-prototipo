import { BotonLink } from "@/components/ui/button";
import { EstadoVacio } from "@/components/app/estado-vacio";
import type { BusquedaPublica } from "@/lib/queries/publico";
import { RUTA_REGISTRO_INSTITUCION } from "@/lib/publico";
import { accionPostular, type SesionPublica } from "./sesion";
import { TarjetaBusqueda } from "./tarjeta-busqueda";

/** Búsquedas rápidas abiertas ahora; si no hay ninguna, lo dice y ofrece publicar una. */
export function ListaUrgentes({ busquedas, sesion }: { busquedas: BusquedaPublica[]; sesion: SesionPublica }) {
  if (busquedas.length === 0) {
    return (
      <EstadoVacio
        titulo="Hoy no hay búsquedas urgentes abiertas"
        texto="Cuando una institución publique una suplencia rápida, aparece acá con su plazo."
        accion={
          sesion.rol ? undefined : (
            <BotonLink href={RUTA_REGISTRO_INSTITUCION} variante="cta" tamano="sm">
              Publicar una suplencia
            </BotonLink>
          )
        }
      />
    );
  }
  return (
    <ul className="m-0 grid list-none grid-cols-3 gap-[18px] p-0 max-[900px]:grid-cols-2 max-[640px]:grid-cols-1">
      {busquedas.map((b) => (
        <li key={b.id} className="grid">
          <TarjetaBusqueda busqueda={b} accion={accionPostular(sesion, b.id)} />
        </li>
      ))}
    </ul>
  );
}
