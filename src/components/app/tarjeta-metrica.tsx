import Link from "next/link";
import { cn } from "@/lib/utils";

const TONOS = {
  azul: { punto: "bg-navy-700", valor: "text-navy-700" },
  naranja: { punto: "bg-naranja", valor: "text-naranja" },
  rojo: { punto: "bg-[#dc2626]", valor: "text-[#dc2626]" },
} as const;

const NOTAS = { sutil: "text-sutil", verde: "text-verde" } as const;

/**
 * Tarjeta de métrica de toda la app (dashboards, Publicaciones, Cursos…): punto de color +
 * etiqueta, número grande en Sora y una nota debajo. Con `href` se vuelve un link.
 */
export function TarjetaMetrica({
  etiqueta,
  valor,
  nota,
  notaTono = "sutil",
  tono = "azul",
  href,
  className,
}: {
  etiqueta: string;
  valor: React.ReactNode;
  nota?: string;
  /** Color de la nota: gris por defecto, verde para una variación positiva. */
  notaTono?: keyof typeof NOTAS;
  tono?: keyof typeof TONOS;
  href?: string;
  className?: string;
}) {
  const t = TONOS[tono];
  const clases = cn("block rounded-tarjeta bg-white px-[22px] py-5 shadow-tarjeta", className);
  const contenido = (
    <>
      <div className="mb-3 flex items-center gap-2">
        <span className={cn("size-2 flex-none rounded-full", t.punto)} />
        <span className="text-[12.5px] leading-tight font-semibold text-apagado">{etiqueta}</span>
      </div>
      <div className={cn("mb-1.5 font-display text-[36px] leading-none font-semibold tracking-[-0.03em]", t.valor)}>{valor}</div>
      {nota && <div className={cn("text-[12.5px] leading-[1.45]", NOTAS[notaTono])}>{nota}</div>}
    </>
  );
  if (href) {
    return (
      <Link
        href={href}
        className={cn(
          clases,
          "text-tinta transition-shadow hover:shadow-[0_8px_22px_rgba(31,36,33,.1)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-navy-700/30",
        )}
      >
        {contenido}
      </Link>
    );
  }
  return <div className={clases}>{contenido}</div>;
}
