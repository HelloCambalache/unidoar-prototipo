import Link from "next/link";
import { Icono } from "@/components/icons";
import { BotonLink } from "@/components/ui/button";
import { Insignia } from "@/components/ui/insignia";
import { Tarjeta } from "@/components/ui/tarjeta";
import { CATEGORIA_INFO } from "@/lib/catalogo";
import type { BusquedaPublica } from "@/lib/queries/publico";
import { venceEnLegible } from "@/lib/publico";
import { LogoInstitucion } from "./logo-institucion";
import type { AccionPostular } from "./sesion";

const TONO_CATEGORIA = { educador: "naranja", entrenador: "ambar", guardavidas: "azul" } as const;

/** Tarjeta de una búsqueda abierta en el sitio público (buscar trabajo, urgentes). */
export function TarjetaBusqueda({ busqueda: b, accion }: { busqueda: BusquedaPublica; accion: AccionPostular | null }) {
  const vence = b.rapida ? venceEnLegible(b.venceEn) : null;
  return (
    <Tarjeta como="article" className="flex flex-col rounded-[10px] p-[18px]">
      <div className="mb-3 flex gap-[11px]">
        <LogoInstitucion nombre={b.institucion.nombre} logoUrl={b.institucion.logoUrl} />
        <div className="min-w-0">
          <h3 className="m-0 text-[15px] leading-[1.3] font-semibold text-tinta">{b.puesto}</h3>
          <Link
            href={`/instituciones/${b.institucion.slug}`}
            className="text-[12.5px] leading-snug text-apagado hover:text-naranja focus-visible:text-naranja"
          >
            {b.institucion.nombre}
          </Link>
        </div>
      </div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        <Insignia tono={TONO_CATEGORIA[b.categoria]}>{CATEGORIA_INFO[b.categoria].label}</Insignia>
        <Insignia>{b.tipo}</Insignia>
        {b.rapida && (
          <Insignia tono="rosa" punto>
            Urgente
          </Insignia>
        )}
      </div>
      <div className="mb-3.5 flex flex-col gap-[5px] text-[12.5px] leading-[1.4] text-apagado">
        {b.zona && (
          <div className="flex items-center gap-1.5">
            <Icono nombre="ubicacion" tamano={13} trazo={1.8} className="text-sutil" />
            {b.zona}
          </div>
        )}
        {b.horario && (
          <div className="flex items-center gap-1.5">
            <Icono nombre="reloj" tamano={13} trazo={1.8} className="text-sutil" />
            {b.horario}
          </div>
        )}
        {vence && (
          <div className="flex items-center gap-1.5 font-semibold text-naranja-ink">
            <Icono nombre="rayo" tamano={13} trazo={1.8} />
            {vence}
          </div>
        )}
      </div>
      <div className="mt-auto">
        {accion ? (
          <BotonLink href={accion.href} variante="cta" tamano="sm">
            {accion.etiqueta}
          </BotonLink>
        ) : (
          <BotonLink href={`/instituciones/${b.institucion.slug}`} variante="secundario" tamano="sm">
            Ver institución
          </BotonLink>
        )}
      </div>
    </Tarjeta>
  );
}
