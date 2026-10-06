import { cn } from "@/lib/utils";

/** Banda azul de cierre: etiqueta + título a la izquierda y acciones a la derecha. */
export function BandaCTA({
  etiqueta,
  titulo,
  texto,
  acciones,
  className,
}: {
  etiqueta?: React.ReactNode;
  titulo: string;
  texto?: string;
  acciones: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "flex flex-wrap items-center justify-between gap-10 bg-navy-700 px-10 py-11 max-[560px]:gap-6 max-[560px]:px-6",
        className,
      )}
    >
      <div className="max-w-[600px]">
        {etiqueta && <div className="mb-3.5">{etiqueta}</div>}
        <h2 className="m-0 mb-1.5 text-[28px] leading-[1.2] font-semibold tracking-[-0.02em] text-white max-[560px]:text-2xl">
          {titulo}
        </h2>
        {texto && <p className="m-0 text-sm leading-normal text-white/65">{texto}</p>}
      </div>
      <div className="flex flex-wrap gap-3">{acciones}</div>
    </section>
  );
}
