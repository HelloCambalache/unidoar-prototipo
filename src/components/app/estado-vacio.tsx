import { cn } from "@/lib/utils";

/** Lista vacía con explicación y, si corresponde, una acción para salir de ahí. */
export function EstadoVacio({
  titulo,
  texto,
  accion,
  className,
}: {
  titulo: string;
  texto?: string;
  accion?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-tarjeta border-[1.5px] border-dashed border-[#CFCBC3] bg-white/70 px-6 py-12 text-center", className)}>
      <div className="font-display text-[17px] font-semibold text-navy-900">{titulo}</div>
      {texto && <p className="mx-auto mt-1.5 mb-0 max-w-[46ch] text-[13.5px] leading-normal text-apagado">{texto}</p>}
      {accion && <div className="mt-4 flex justify-center">{accion}</div>}
    </div>
  );
}
