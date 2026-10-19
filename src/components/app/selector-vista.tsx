import Link from "next/link";
import { cn } from "@/lib/utils";

const PILDORA =
  "inline-flex min-h-9 items-center gap-1.5 rounded-full px-4 text-[13px] leading-none font-semibold transition-colors focus-visible:ring-[3px] focus-visible:ring-navy-700/30 focus-visible:outline-none";
const PILDORA_ACTIVA = "bg-white text-navy-900 shadow-[0_1px_3px_rgba(4,11,53,.12)] hover:text-navy-900";

/**
 * Selector "Lista / Mapa" de las pantallas de búsqueda (Buscar trabajo e Instituciones, las de adentro de la app y las de la parte
 * pública): una sola pieza, para que se vean igual. `reemplazar` cambia la vista sin sumar un paso al historial ni mover la página.
 */
export function SelectorDeVista({
  vista,
  hrefLista,
  hrefMapa,
  reemplazar = false,
  className,
}: {
  vista: "lista" | "mapa";
  hrefLista: string;
  hrefMapa: string;
  reemplazar?: boolean;
  className?: string;
}) {
  const propios = reemplazar ? { replace: true, scroll: false } : {};
  return (
    <nav aria-label="Vista" className={cn("flex w-max max-w-full gap-1 rounded-full bg-[#E9E7E1] p-1", className)}>
      <Link
        href={hrefLista}
        {...propios}
        aria-current={vista === "lista" ? "page" : undefined}
        className={cn(PILDORA, vista === "lista" ? PILDORA_ACTIVA : "text-apagado hover:text-tinta")}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden>
          <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
        </svg>
        Lista
      </Link>
      <Link
        href={hrefMapa}
        {...propios}
        aria-current={vista === "mapa" ? "page" : undefined}
        className={cn(PILDORA, vista === "mapa" ? PILDORA_ACTIVA : "text-apagado hover:text-tinta")}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" aria-hidden>
          <path d="M9 3L3 5.5v15L9 18l6 3 6-2.5v-15L15 6z" />
          <path d="M9 3v15M15 6v15" />
        </svg>
        Mapa
      </Link>
    </nav>
  );
}
