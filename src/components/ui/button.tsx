import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Botón de marca. Alturas mínimas del HANDOFF: 46px (md), 34px (sm, más chico para
 * tarjetas), 52px (lg). Evitar botones "finitos"; siempre con hover distinguible.
 */
const BASE =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-transparent font-semibold leading-none whitespace-nowrap select-none transition-colors duration-150 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-navy-700/30 disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50";

const TAMANOS = {
  sm: "min-h-[34px] px-3.5 text-[12.5px] rounded-lg",
  md: "min-h-[46px] px-[22px] text-[14px]",
  lg: "min-h-[52px] px-[22px] text-[16px]",
} as const;

const VARIANTES = {
  /** Azul marca (acciones principales de la app). */
  primario: "bg-navy-700 text-white hover:bg-navy-900 shadow-sm",
  /** Naranja (CTA primario de landing y publicar). */
  cta: "bg-naranja text-white hover:bg-[#c44a35] shadow-sm",
  secundario: "bg-white text-tinta border-borde hover:border-borde-fuerte hover:bg-superficie",
  fantasma: "bg-transparent text-apagado hover:bg-black/5 hover:text-tinta",
  exito: "bg-verde-tint text-verde border-verde-borde hover:bg-[#d8eee4]",
  peligro: "bg-[#dc2626] text-white hover:bg-[#b91c1c]",
} as const;

export type BotonVariante = keyof typeof VARIANTES;
export type BotonTamano = keyof typeof TAMANOS;

type Comun = {
  variante?: BotonVariante;
  tamano?: BotonTamano;
  bloque?: boolean;
  className?: string;
};

export function botonClases({ variante = "primario", tamano = "md", bloque, className }: Comun) {
  return cn(BASE, TAMANOS[tamano], VARIANTES[variante], bloque && "flex w-full", className);
}

export function Boton({
  variante,
  tamano,
  bloque,
  className,
  type = "button",
  ...props
}: Comun & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type={type} className={botonClases({ variante, tamano, bloque, className })} {...props} />;
}

export function BotonLink({
  variante,
  tamano,
  bloque,
  className,
  ...props
}: Comun & React.ComponentProps<typeof Link>) {
  return <Link className={botonClases({ variante, tamano, bloque, className })} {...props} />;
}
