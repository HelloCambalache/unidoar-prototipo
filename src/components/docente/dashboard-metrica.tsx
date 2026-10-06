import { cn } from "@/lib/utils";

const TONOS = {
  azul: { punto: "bg-navy-700", valor: "text-navy-700" },
  rosa: { punto: "bg-rosa", valor: "text-rosa" },
  naranja: { punto: "bg-naranja", valor: "text-naranja" },
} as const;

/** La tarjeta de métrica del tablero: punto de color, etiqueta, número grande y una línea de contexto. */
export function DashboardMetrica({
  tono,
  etiqueta,
  valor,
  nota,
}: {
  tono: keyof typeof TONOS;
  etiqueta: string;
  valor: number;
  nota: string;
}) {
  const t = TONOS[tono];
  return (
    <div className="rounded-[18px] border border-borde bg-white p-5">
      <div className="mb-3 flex items-center gap-2">
        <span aria-hidden className={cn("size-2 flex-none rounded-full", t.punto)} />
        <span className="text-[12.5px] leading-tight font-semibold text-apagado">{etiqueta}</span>
      </div>
      <div className={cn("font-display mb-1.5 text-[34px] leading-none font-bold tracking-[-0.03em]", t.valor)}>{valor}</div>
      <div className="text-[12.5px] leading-[1.45] text-sutil">{nota}</div>
    </div>
  );
}
