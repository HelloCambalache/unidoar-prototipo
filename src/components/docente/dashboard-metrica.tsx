import { cn } from "@/lib/utils";

const TONOS = {
  azul: { tarjeta: "bg-white", punto: "bg-navy-700", etiqueta: "text-apagado", valor: "text-navy-900", nota: "text-apagado" },
  rosa: { tarjeta: "bg-white", punto: "bg-rosa", etiqueta: "text-apagado", valor: "text-navy-900", nota: "text-apagado" },
  naranja: {
    tarjeta: "bg-naranja-tint",
    punto: "bg-naranja",
    etiqueta: "text-naranja-ink",
    valor: "text-[#3E1409]",
    nota: "text-naranja-ink",
  },
} as const;

/** La tarjeta de métrica del tablero: etiqueta con punto de color, número grande y una línea de contexto. */
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
    <div className={cn("rounded-tarjeta px-[22px] py-5 shadow-tarjeta", t.tarjeta)}>
      <div className="mb-2.5 flex items-center gap-2">
        <span aria-hidden className={cn("size-2 flex-none rounded-full", t.punto)} />
        <span className={cn("text-[13px] leading-tight font-semibold", t.etiqueta)}>{etiqueta}</span>
      </div>
      <div className={cn("font-display mb-1.5 text-[38px] leading-none font-semibold tracking-[-0.03em]", t.valor)}>
        {valor}
      </div>
      <div className={cn("text-[13px] leading-[1.45]", t.nota)}>{nota}</div>
    </div>
  );
}
