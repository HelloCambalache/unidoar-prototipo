import { LogoInstitucion } from "@/components/docente/logo-institucion";
import { BotonLink } from "@/components/ui/button";
import { Insignia, Verificado } from "@/components/ui/insignia";
import type { InstitucionCatalogo } from "@/lib/queries/instituciones";
import { resumenDeSedes } from "@/lib/sedes";

/** "Sin búsquedas abiertas" · "1 búsqueda abierta" · "3 búsquedas abiertas" */
export function etiquetaBusquedasAbiertas(n: number) {
  if (n === 0) return "Sin búsquedas abiertas";
  return n === 1 ? "1 búsqueda abierta" : `${n} búsquedas abiertas`;
}

/**
 * Tarjeta de una institución en el catálogo: la misma en el panel del docente y en el sitio público.
 * La estrella (guardar en favoritas, o invitación a crear cuenta) la pone quien la usa.
 */
export function TarjetaInstitucion({
  i,
  href,
  estrella,
}: {
  i: Pick<InstitucionCatalogo, "nombre" | "tipo" | "zona" | "descripcion" | "logoUrl" | "verificada" | "busquedasActivas" | "sedes">;
  href: string;
  estrella?: React.ReactNode;
}) {
  return (
    <article className="flex flex-col rounded-lg border border-borde bg-white p-[18px]">
      <div className="mb-2.5 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <LogoInstitucion nombre={i.nombre} logoUrl={i.logoUrl} tamano={40} />
          <div className="min-w-0">
            <h2 className="m-0 flex items-center gap-1.5 text-sm leading-[1.3] font-semibold text-tinta">
              <span className="min-w-0">{i.nombre}</span>
              {i.verificada && <Verificado tamano={14} />}
            </h2>
            <div className="text-xs leading-[1.35] text-apagado">{[i.tipo, i.zona, resumenDeSedes(i.sedes)].filter(Boolean).join(" · ")}</div>
          </div>
        </div>
        {estrella}
      </div>
      <p className="m-0 mb-3 min-h-10 text-[13px] leading-normal text-tinta-2">
        {i.descripcion || "Todavía no cargó una descripción."}
      </p>
      <div className="mt-auto mb-3.5 border-t border-borde pt-2.5">
        <Insignia tono={i.busquedasActivas > 0 ? "verde" : "neutro"}>
          {etiquetaBusquedasAbiertas(i.busquedasActivas)}
        </Insignia>
      </div>
      <BotonLink href={href} bloque>
        Ver perfil
      </BotonLink>
    </article>
  );
}
