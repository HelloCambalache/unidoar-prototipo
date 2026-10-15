import { cn } from "@/lib/utils";

/**
 * Título de pantalla de la app: h1 de 24px + bajada opcional + acciones a la derecha
 * (en mobile las acciones bajan y ocupan todo el ancho).
 */
export function EncabezadoPagina({
  titulo,
  bajada,
  acciones,
  className,
}: {
  titulo: string;
  bajada?: string;
  acciones?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-5 flex items-start justify-between gap-4 max-[860px]:flex-col max-[860px]:items-stretch max-[860px]:gap-3.5 max-[860px]:[&>div:last-child>*]:w-full",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="font-display m-0 text-[28px] leading-[1.15] font-semibold tracking-[-0.025em] text-navy-900 max-[860px]:text-[24px]">{titulo}</h1>
        {bajada && <p className="mt-1.5 mb-0 text-[15px] leading-normal text-apagado">{bajada}</p>}
      </div>
      {acciones && <div className="flex flex-none items-center gap-2.5">{acciones}</div>}
    </div>
  );
}
