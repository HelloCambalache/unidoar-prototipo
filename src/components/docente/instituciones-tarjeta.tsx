import { BotonLink } from "@/components/ui/button";
import { InstitucionFavoritoBoton } from "@/components/docente/instituciones-acciones";
import { InstitucionLogo } from "@/components/docente/instituciones-logo";
import type { InstitucionCatalogo } from "@/lib/queries/instituciones";
import { cn } from "@/lib/utils";

/** Tarjeta del catálogo de instituciones: datos básicos, búsquedas abiertas y las dos acciones. */
export function InstitucionTarjeta({ i }: { i: InstitucionCatalogo }) {
  return (
    <article className="flex flex-col rounded-lg border border-borde bg-white p-[18px]">
      <div className="mb-2.5 flex items-center gap-2.5">
        <InstitucionLogo nombre={i.nombre} logoUrl={i.logoUrl} tamano={40} />
        <div className="min-w-0">
          <h2 className="m-0 text-sm leading-[1.3] font-semibold">{i.nombre}</h2>
          <div className="text-xs leading-[1.35] text-apagado">{[i.tipo, i.zona].filter(Boolean).join(" · ")}</div>
        </div>
      </div>
      <p className="m-0 mb-3 min-h-10 text-[13px] leading-normal text-tinta-2">
        {i.descripcion || "Todavía no cargó una descripción."}
      </p>
      <div className="mb-3.5 flex items-center justify-between border-t border-borde pt-2.5 text-[13px] leading-none">
        <span className="text-apagado">Búsquedas activas</span>
        <span className={cn("font-semibold", i.busquedasActivas > 0 ? "text-verde" : "text-sutil")}>
          {i.busquedasActivas}
        </span>
      </div>
      <div className="mt-auto flex gap-2">
        <InstitucionFavoritoBoton institucionId={i.id} favorita={i.favorita} nombre={i.nombre} className="flex-1" />
        <BotonLink href={`/docente/instituciones/${i.slug}`} className="flex-1">
          Ver perfil
        </BotonLink>
      </div>
    </article>
  );
}
