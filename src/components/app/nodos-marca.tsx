import { cn } from "@/lib/utils";

/** Los tres nodos unidos del isotipo, como decoración de los banners oscuros. Siempre decorativo. */
export function NodosMarca({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 420 320" aria-hidden className={cn("pointer-events-none", className)}>
      <line x1="120" y1="90" x2="300" y2="170" stroke="#fff" strokeOpacity=".22" strokeWidth="3" />
      <line x1="120" y1="90" x2="160" y2="260" stroke="#fff" strokeOpacity=".22" strokeWidth="3" />
      <line x1="300" y1="170" x2="160" y2="260" stroke="#fff" strokeOpacity=".22" strokeWidth="3" />
      <circle cx="120" cy="90" r="44" fill="#C2187A" />
      <circle cx="300" cy="170" r="54" fill="#22B8D9" />
      <circle cx="160" cy="260" r="38" fill="#F59332" />
    </svg>
  );
}
