import { cn } from "@/lib/utils";

/**
 * Tabla con el estilo del prototipo (`cbl-table--hover`): cabecera en mayúsculas,
 * filas con hover, contenedor con borde que hace scroll horizontal en mobile.
 */
export function Tabla({ className, children, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto overflow-y-hidden rounded-ud border border-borde bg-white">
      <table
        className={cn(
          "w-full min-w-[540px] border-collapse text-sm text-tinta",
          "[&_thead_th]:border-b [&_thead_th]:border-borde [&_thead_th]:bg-superficie [&_thead_th]:px-3.5 [&_thead_th]:py-2.5 [&_thead_th]:text-left [&_thead_th]:text-xs [&_thead_th]:font-semibold [&_thead_th]:tracking-[.03em] [&_thead_th]:text-apagado [&_thead_th]:uppercase",
          "[&_tbody_td]:border-b [&_tbody_td]:border-borde [&_tbody_td]:px-3.5 [&_tbody_td]:py-3",
          "[&_tbody_tr:last-child_td]:border-b-0 [&_tbody_tr]:transition-colors [&_tbody_tr:hover]:bg-superficie",
          className,
        )}
        {...props}
      >
        {children}
      </table>
    </div>
  );
}
