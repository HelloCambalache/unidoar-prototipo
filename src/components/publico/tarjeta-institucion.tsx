import { BotonLink } from "@/components/ui/button";
import { Verificado } from "@/components/ui/insignia";
import { Tarjeta } from "@/components/ui/tarjeta";
import type { InstitucionPublica } from "@/lib/queries/publico";
import { LogoInstitucion } from "./logo-institucion";

/** "Sin búsquedas abiertas" · "1 búsqueda abierta" · "3 búsquedas abiertas" */
export function etiquetaBusquedasAbiertas(n: number) {
  if (n === 0) return "Sin búsquedas abiertas";
  return n === 1 ? "1 búsqueda abierta" : `${n} búsquedas abiertas`;
}

/** Tarjeta de una institución en el listado público. */
export function TarjetaInstitucion({ institucion: i }: { institucion: InstitucionPublica }) {
  return (
    <Tarjeta como="article" className="flex flex-col rounded-[10px] p-[18px]">
      <div className="mb-3 flex gap-[11px]">
        <LogoInstitucion nombre={i.nombre} logoUrl={i.logoUrl} tamano={40} />
        <div className="min-w-0">
          <h3 className="m-0 flex items-center gap-1.5 text-[15px] leading-[1.3] font-semibold text-tinta">
            {i.nombre}
            {i.verificada && <Verificado tamano={14} />}
          </h3>
          <div className="text-[12.5px] leading-snug text-apagado">
            {i.tipo}
            {i.zona ? ` · ${i.zona}` : ""}
          </div>
        </div>
      </div>
      {i.descripcion && <p className="mb-3.5 line-clamp-3 text-[13px] leading-normal text-tinta-2">{i.descripcion}</p>}
      <div className="mt-auto flex items-center justify-between gap-2.5 border-t border-[#F0EFEA] pt-3">
        <span className="text-[12.5px] leading-none font-medium text-apagado">
          {etiquetaBusquedasAbiertas(i.busquedasActivas)}
        </span>
        <BotonLink href={`/instituciones/${i.slug}`} variante="secundario" tamano="sm">
          Ver perfil
        </BotonLink>
      </div>
    </Tarjeta>
  );
}
