import Link from "next/link";
import { cn } from "@/lib/utils";

/** Anterior / siguiente conservando los filtros de la URL. */
export function Paginacion({
  base,
  parametros,
  pagina,
  paginas,
}: {
  /** Ruta de la página, ej. "/buscar-trabajo". */
  base: string;
  /** Filtros vigentes (sin `pagina`). */
  parametros: Record<string, string | undefined>;
  pagina: number;
  paginas: number;
}) {
  if (paginas <= 1) return null;
  const href = (p: number) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(parametros)) if (v) qs.set(k, v);
    if (p > 1) qs.set("pagina", String(p));
    const texto = qs.toString();
    return texto ? `${base}?${texto}` : base;
  };
  const boton =
    "inline-flex min-h-[38px] items-center rounded-lg border border-borde bg-white px-3.5 text-[13px] leading-none font-semibold text-tinta transition-colors hover:border-borde-fuerte hover:bg-superficie hover:text-tinta focus-visible:ring-[3px] focus-visible:ring-navy-700/30 focus-visible:outline-none";
  return (
    <nav aria-label="Paginado" className="mt-7 flex items-center justify-center gap-3">
      {pagina > 1 ? (
        <Link href={href(pagina - 1)} rel="prev" className={boton}>
          ‹ Anterior
        </Link>
      ) : (
        <span aria-hidden className={cn(boton, "pointer-events-none opacity-40")}>
          ‹ Anterior
        </span>
      )}
      <span className="text-[13px] text-apagado">
        Página {pagina} de {paginas}
      </span>
      {pagina < paginas ? (
        <Link href={href(pagina + 1)} rel="next" className={boton}>
          Siguiente ›
        </Link>
      ) : (
        <span aria-hidden className={cn(boton, "pointer-events-none opacity-40")}>
          Siguiente ›
        </span>
      )}
    </nav>
  );
}
