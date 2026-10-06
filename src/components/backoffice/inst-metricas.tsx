import { cn } from "@/lib/utils";

/**
 * Franja de métricas de las fichas del backoffice: celdas separadas por una línea, que se acomodan solas
 * según el ancho (`auto-fit`). El valor va en azul marca salvo que se pida otro color.
 */
export function FranjaMetricas({
  items,
  minimo = 140,
  className,
}: {
  items: { valor: React.ReactNode; etiqueta: string; color?: string }[];
  minimo?: number;
  className?: string;
}) {
  return (
    <div
      style={{ gridTemplateColumns: `repeat(auto-fit,minmax(${minimo}px,1fr))` }}
      className={cn("grid overflow-hidden rounded-ud border border-borde bg-white", className)}
    >
      {items.map((m) => (
        <div key={m.etiqueta} className="border-r border-borde px-[18px] py-4 last:border-r-0">
          <div style={m.color ? { color: m.color } : undefined} className="text-[22px] leading-none font-semibold text-navy-700">
            {m.valor}
          </div>
          <div className="mt-1.5 text-xs leading-[1.3] text-apagado">{m.etiqueta}</div>
        </div>
      ))}
    </div>
  );
}
