import { Icono } from "@/components/icons";
import { avisoDeFormaDePago, type FormaDeCobro } from "@/lib/pago-manual";
import { cn } from "@/lib/utils";

/**
 * Lo primero que dice Plan y facturación sobre cómo paga la institución (reglas y textos en src/lib/pago-manual.ts): «Tu institución paga con
 * Mercado Pago» o, si el equipo la habilitó, que también puede pagar por transferencia o efectivo. Quien paga como siempre (Mercado Pago no
 * está disponible o su plan no se paga así) no ve nada: no hay nada que aclarar.
 */
export function AvisoDeFormaDePago({ forma, puntual = false, className }: { forma: FormaDeCobro; /** Su plan es el de búsqueda puntual: se paga cada búsqueda. */ puntual?: boolean; className?: string }) {
  const aviso = avisoDeFormaDePago(forma, puntual);
  if (!aviso) return null;
  return (
    <section
      role="note"
      aria-label="Cómo pagás"
      className={cn("mb-5 flex max-w-[980px] items-start gap-3.5 rounded-caja border border-navy-100 bg-navy-50 px-[18px] py-3.5", className)}
    >
      <span aria-hidden className="mt-0.5 flex size-8 flex-none items-center justify-center rounded-full bg-navy-700 text-white">
        <Icono nombre="plan" tamano={16} />
      </span>
      <div className="min-w-0">
        <h2 className="m-0 mb-0.5 text-[15px] leading-snug font-semibold text-navy-700">{aviso.titulo}</h2>
        <p className="m-0 text-[13px] leading-normal text-tinta-2">{aviso.texto}</p>
      </div>
    </section>
  );
}
