import Link from "next/link";
import { LogoInstitucion } from "@/components/docente/logo-institucion";
import { Icono } from "@/components/icons";
import { BotonLink } from "@/components/ui/button";
import { Insignia, Verificado } from "@/components/ui/insignia";
import type { InstitucionCatalogo } from "@/lib/queries/instituciones";
import { resumenDeSedes } from "@/lib/sedes";
import { cn } from "@/lib/utils";

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
  app = false,
}: {
  i: Pick<InstitucionCatalogo, "nombre" | "tipo" | "zona" | "descripcion" | "logoUrl" | "verificada" | "busquedasActivas" | "sedes">;
  href: string;
  estrella?: React.ReactNode;
  /** Identidad nueva del área con sesión: sin botón, toda la tarjeta es el link y el pie lleva una flecha. */
  app?: boolean;
}) {
  if (app) return <TarjetaInstitucionApp i={i} href={href} estrella={estrella} />;
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

function TarjetaInstitucionApp({
  i,
  href,
  estrella,
}: {
  i: Pick<InstitucionCatalogo, "nombre" | "tipo" | "zona" | "descripcion" | "logoUrl" | "verificada" | "busquedasActivas" | "sedes">;
  href: string;
  estrella?: React.ReactNode;
}) {
  const abiertas = i.busquedasActivas > 0;
  return (
    <article className="group relative flex flex-col rounded-tarjeta bg-white p-2 shadow-tarjeta transition-[box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-tarjeta-hover">
      <div className="flex flex-1 flex-col gap-3 px-3 pt-3">
        <div className="flex items-start justify-between gap-3">
          <LogoInstitucion nombre={i.nombre} logoUrl={i.logoUrl} tamano={52} className="rounded-2xl" />
          {/* La estrella va por encima del link estirado. */}
          <span className="relative z-[1] -mt-1 -mr-1">{estrella}</span>
        </div>
        <div className="min-w-0">
          <h2 className="font-display m-0 flex items-center gap-1.5 text-[17px] leading-[1.25] font-semibold tracking-[-0.01em]">
            <Link
              href={href}
              className="min-w-0 text-tinta outline-none after:absolute after:inset-0 after:rounded-tarjeta hover:text-tinta focus-visible:after:ring-[3px] focus-visible:after:ring-navy-700/30"
            >
              {i.nombre}
            </Link>
            {i.verificada && <Verificado tamano={15} />}
          </h2>
          <div className="mt-1 text-[13px] leading-[1.35] text-apagado">
            {[i.tipo, i.zona, resumenDeSedes(i.sedes)].filter(Boolean).join(" · ")}
          </div>
        </div>
        <p className={cn("m-0 line-clamp-3 text-[13.5px] leading-normal", i.descripcion ? "text-tinta-2" : "text-apagado")}>
          {i.descripcion || "Todavía no cargó una descripción."}
        </p>
      </div>
      <div className="mt-3 flex items-center gap-3 border-t border-[#F1EFEA] px-3 pt-3 pb-1.5">
        <span className={cn("flex min-w-0 flex-1 items-center gap-2 text-[13px] font-semibold", abiertas ? "text-verde" : "text-apagado")}>
          <span aria-hidden className={cn("size-2 flex-none rounded-full", abiertas ? "bg-verde" : "bg-[#C9C6C0]")} />
          {etiquetaBusquedasAbiertas(i.busquedasActivas)}
        </span>
        <span
          aria-hidden
          className="inline-flex size-10 flex-none items-center justify-center rounded-xl bg-lienzo text-tinta transition-colors group-hover:bg-navy-900 group-hover:text-white"
        >
          <Icono nombre="flecha" tamano={17} trazo={2} />
        </span>
      </div>
    </article>
  );
}
