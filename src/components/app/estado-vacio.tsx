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
    <div className={cn("rounded-ud border border-dashed border-borde-fuerte bg-white/60 px-6 py-10 text-center", className)}>
      <div className="text-[15px] font-semibold text-tinta">{titulo}</div>
      {texto && <p className="mx-auto mt-1.5 mb-0 max-w-[46ch] text-[13.5px] leading-normal text-apagado">{texto}</p>}
      {accion && <div className="mt-4 flex justify-center">{accion}</div>}
    </div>
  );
}
