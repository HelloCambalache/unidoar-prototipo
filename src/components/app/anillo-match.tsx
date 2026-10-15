import { cn } from "@/lib/utils";

/**
 * Anillo de coincidencia ("match"): el porcentaje en el centro y el arco que se completa. `color` es el
 * del arco (por defecto el magenta de la marca); el fondo del anillo es blanco para que se lea sobre los paneles teñidos.
 */
export function AnilloMatch({
  porcentaje,
  tamano = 56,
  color = "var(--color-rosa)",
  fondo = "#ffffff",
  className,
}: {
  porcentaje: number;
  tamano?: number;
  color?: string;
  fondo?: string;
  className?: string;
}) {
  const p = Math.max(0, Math.min(100, Math.round(porcentaje)));
  const r = 27;
  const circ = 2 * Math.PI * r;
  return (
    <span
      role="img"
      aria-label={`${p}% de coincidencia`}
      style={{ width: tamano, height: tamano }}
      className={cn("relative inline-flex flex-none items-center justify-center", className)}
    >
      <svg width={tamano} height={tamano} viewBox="0 0 64 64" aria-hidden className="absolute inset-0">
        <circle cx="32" cy="32" r={r} fill="none" stroke={fondo} strokeWidth="6" />
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${(circ * p) / 100} ${circ}`}
          transform="rotate(-90 32 32)"
        />
      </svg>
      <span className="font-display relative text-[13px] leading-none font-semibold text-tinta">{p}%</span>
    </span>
  );
}
