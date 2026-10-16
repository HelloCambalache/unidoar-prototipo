import { NodosMarca } from "@/components/app/nodos-marca";
import { cn } from "@/lib/utils";

/** Panel azul de cierre (redondeado, con los nodos del logo): etiqueta + título a la izquierda y acciones a la derecha. */
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
    <section className={cn("bg-lienzo px-12 py-12 max-[900px]:px-6 max-[560px]:py-8", className)}>
      <div className="relative mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-10 overflow-hidden rounded-marco bg-navy-900 px-12 py-12 max-[560px]:gap-6 max-[560px]:px-6 max-[560px]:py-9">
        <NodosMarca className="absolute -top-14 -right-10 w-[260px] opacity-90 max-[700px]:hidden" />
        <div className="relative max-w-[600px]">
          {etiqueta && <div className="mb-3.5">{etiqueta}</div>}
          <h2 className="font-display m-0 mb-1.5 text-[32px] leading-[1.15] font-semibold tracking-[-0.025em] text-white max-[560px]:text-2xl">
            {titulo}
          </h2>
          {texto && <p className="m-0 text-[15px] leading-normal text-white/70">{texto}</p>}
        </div>
        <div className="relative flex flex-wrap gap-3 [&>a]:rounded-full">{acciones}</div>
      </div>
    </section>
  );
}
