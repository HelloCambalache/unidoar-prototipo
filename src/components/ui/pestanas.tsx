import Link from "next/link";
import { cn } from "@/lib/utils";

export type Pestana = { clave: string; etiqueta: string; href: string; cantidad?: number };

/**
 * Pestañas como links (el estado vive en la URL, así se puede compartir y funciona sin JS).
 * Estilo "pastilla" del prototipo: la activa es un badge azul, las demás texto gris.
 */
export function Pestanas({
  items,
  activa,
  className,
}: {
  items: Pestana[];
  activa: string;
  className?: string;
}) {
  return (
    <nav aria-label="Secciones" className={cn("flex gap-2 overflow-x-auto max-[860px]:pb-1", className)}>
      {items.map((p) => {
        const esActiva = p.clave === activa;
        return (
          <Link
            key={p.clave}
            href={p.href}
            aria-current={esActiva ? "page" : undefined}
            className={cn(
              "flex-none rounded-full px-3.5 py-2 text-[13px] leading-none font-semibold whitespace-nowrap transition-colors",
              esActiva ? "bg-navy-50 text-navy-700" : "text-apagado hover:bg-black/5 hover:text-tinta",
            )}
          >
            {p.etiqueta}
            {p.cantidad !== undefined && <> · {p.cantidad}</>}
          </Link>
        );
      })}
    </nav>
  );
}
