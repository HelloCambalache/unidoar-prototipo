import { BotonLink } from "@/components/ui/button";
import { cartelDeMora, type Mora } from "@/lib/mora";
import { cn } from "@/lib/utils";

/**
 * Cartel de una factura vencida en el área de la institución (reglas y textos en src/lib/mora.ts). Dentro de los 15 días de gracia avisa hasta
 * cuándo hay tiempo; pasados, dice que la cuenta está limitada (no puede publicar búsquedas, invitar a postularse ni publicar cursos) y se levanta
 * sola cuando el equipo registra el pago. Sin mora no dibuja nada. En Plan y facturación (`enPlan`) no repite el botón que lleva ahí.
 */
export function AvisoDeMora({ mora, enPlan = false, className }: { mora: Mora; enPlan?: boolean; className?: string }) {
  const cartel = cartelDeMora(mora);
  if (!cartel) return null;
  const limite = cartel.tono === "limite";
  return (
    <section
      role={limite ? "alert" : "status"}
      aria-label="Factura vencida"
      className={cn(
        "mb-5 flex max-w-[980px] flex-wrap items-center justify-between gap-4 rounded-caja border px-[18px] py-3.5",
        limite ? "border-[#F2C4C4] bg-[#FDECEC]" : "border-[#F2D9B3] bg-[#FEF1DF]",
        className,
      )}
    >
      <div className="min-w-[260px] flex-1 max-[560px]:min-w-0">
        <h2 className={cn("m-0 mb-0.5 text-[15px] leading-snug font-semibold", limite ? "text-[#8A1F1F]" : "text-[#8A4B07]")}>{cartel.titulo}</h2>
        <p className={cn("m-0 text-[13px] leading-normal", limite ? "text-[#8A1F1F]" : "text-[#8A4B07]")}>{cartel.texto}</p>
      </div>
      {!enPlan && (
        <BotonLink href="/institucion/plan" variante={limite ? "primario" : "secundario"} tamano="sm" className="flex-none">
          Ver mis facturas
        </BotonLink>
      )}
    </section>
  );
}
