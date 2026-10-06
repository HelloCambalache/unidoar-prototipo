import { cn, iniciales } from "@/lib/utils";

/** Logo cuadrado de una institución; sin logo, sus iniciales sobre el azul claro de marca. */
export function LogoInstitucion({
  nombre,
  logoUrl,
  tamano = 40,
  className,
}: {
  nombre: string;
  logoUrl?: string | null;
  tamano?: number;
  className?: string;
}) {
  const estilo = { width: tamano, height: tamano };
  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- logos subidos por las instituciones, sin dimensiones conocidas
      <img
        src={logoUrl}
        alt=""
        style={estilo}
        className={cn("flex-none rounded-lg bg-[#F5F5F1] object-contain", className)}
      />
    );
  }
  return (
    <span
      aria-hidden
      style={{ ...estilo, fontSize: Math.max(11, Math.round(tamano * 0.32)) }}
      className={cn(
        "inline-flex flex-none items-center justify-center rounded-lg bg-navy-50 font-semibold text-navy-700",
        className,
      )}
    >
      {iniciales(nombre)}
    </span>
  );
}
