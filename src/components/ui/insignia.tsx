import { cn } from "@/lib/utils";
import { CATEGORIA_INFO } from "@/lib/catalogo";
import type { CategoriaDocente } from "@/db/schema";

const TONOS = {
  neutro: "bg-[#F0EFEA] text-tinta-2",
  azul: "bg-navy-50 text-navy-700",
  verde: "bg-verde-tint text-verde",
  rosa: "bg-rosa-tint text-rosa",
  naranja: "bg-naranja-tint text-naranja-ink",
  ambar: "bg-[#FEF1DF] text-[#8A4B07]",
} as const;

export function Insignia({
  tono = "neutro",
  punto,
  className,
  children,
}: {
  tono?: keyof typeof TONOS;
  punto?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-[5px] text-xs font-semibold leading-none whitespace-nowrap",
        TONOS[tono],
        className,
      )}
    >
      {punto && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

/** Check circular en el color de la categoría (no un badge de texto genérico). */
export function Verificado({
  categoria = "educador",
  tamano = 16,
  className,
}: {
  categoria?: CategoriaDocente;
  tamano?: number;
  className?: string;
}) {
  const color = CATEGORIA_INFO[categoria].color;
  return (
    <svg
      role="img"
      aria-label="Verificado"
      width={tamano}
      height={tamano}
      viewBox="0 0 16 16"
      className={cn("flex-none", className)}
    >
      <circle cx="8" cy="8" r="8" fill={color} />
      <path d="M4.6 8.3 7 10.6l4.4-4.7" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Avatar({
  iniciales,
  fotoUrl,
  tamano = 40,
  className,
  fondo = "#E5E9FB",
  texto = "#16214F",
}: {
  iniciales: string;
  fotoUrl?: string | null;
  tamano?: number;
  className?: string;
  fondo?: string;
  texto?: string;
}) {
  const estilo = { width: tamano, height: tamano, fontSize: Math.max(10, Math.round(tamano * 0.34)) };
  if (fotoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- fotos de perfil pequeñas, sin dimensiones conocidas
      <img src={fotoUrl} alt="" style={estilo} className={cn("flex-none rounded-full object-cover", className)} />
    );
  }
  return (
    <span
      style={{ ...estilo, background: fondo, color: texto }}
      className={cn("inline-flex flex-none items-center justify-center rounded-full font-semibold", className)}
    >
      {iniciales}
    </span>
  );
}
