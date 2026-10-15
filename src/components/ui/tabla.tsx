import { cn } from "@/lib/utils";

/**
 * Tabla con el estilo del prototipo (`cbl-table--hover`): cabecera en mayúsculas,
 * filas con hover, contenedor con borde que hace scroll horizontal en mobile.
 */
export function Tabla({ className, children, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto overflow-y-hidden rounded-tarjeta bg-white px-2 pb-1 shadow-tarjeta">
      <table
        className={cn(
          "w-full min-w-[540px] border-collapse text-sm text-tinta",
          "[&_thead_th]:border-b [&_thead_th]:border-linea [&_thead_th]:bg-white [&_thead_th]:px-4 [&_thead_th]:pt-4 [&_thead_th]:pb-3 [&_thead_th]:text-left [&_thead_th]:text-[11.5px] [&_thead_th]:font-semibold [&_thead_th]:tracking-[.06em] [&_thead_th]:text-apagado [&_thead_th]:uppercase",
          "[&_tbody_td]:border-b [&_tbody_td]:border-[#F1EFEA] [&_tbody_td]:px-4 [&_tbody_td]:py-3.5",
          "[&_tbody_tr:last-child_td]:border-b-0 [&_tbody_tr]:transition-colors [&_tbody_tr:hover]:bg-[#F7F6F2]",
          className,
        )}
        {...props}
      >
        {children}
      </table>
    </div>
  );
}
