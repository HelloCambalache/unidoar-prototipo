import { BotonLink } from "@/components/ui/button";
import { pesos } from "@/lib/planes";

/**
 * Aviso del inicio de la institución para que active el débito automático: aparece cuando la institución ya está verificada, su plan es
 * mensual y todavía no lo activó (ver `avisoDeDebito`). Lleva a Plan y facturación, donde se activa; desaparece solo cuando queda activo.
 */
export function AvisoDebito({ monto }: { monto: number | null }) {
  return (
    <section
      aria-label="Débito automático"
      className="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-caja border border-navy-100 bg-navy-50 px-[18px] py-3.5"
    >
      <div className="min-w-[260px] flex-1 max-[560px]:min-w-0">
        <h2 className="m-0 mb-0.5 text-[15px] leading-snug font-semibold text-tinta">Activá el débito automático para pagar tu plan sin pensarlo</h2>
        <p className="m-0 text-[13px] leading-normal text-apagado">
          Mercado Pago cobra {monto ? `${pesos(monto)} por mes` : "tu plan cada mes"} en tu tarjeta. Lo autorizás una sola vez y podés cancelarlo cuando
          quieras.
        </p>
      </div>
      <BotonLink href="/institucion/plan" variante="primario" tamano="sm" className="flex-none">
        Activar débito automático
      </BotonLink>
    </section>
  );
}
