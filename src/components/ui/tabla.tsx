import { DesplazableX } from "@/components/ui/desplazable-x";
import { cn } from "@/lib/utils";

/**
 * Tabla con el estilo del prototipo (`cbl-table--hover`): cabecera en mayúsculas, filas con hover, contenedor con borde. Si no entra en el ancho
 * hace scroll horizontal y lo avisa (degradado y botón en el borde): una tabla ancha no se ve «cortada» sin que se note.
 */
export function Tabla({ className, children, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <DesplazableX
      fondo="blanco"
      etiquetaMas="Ver más columnas"
      envoltorio="overflow-hidden rounded-tarjeta bg-white shadow-tarjeta"
      className="overflow-y-hidden px-2 pb-1"
    >
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
    </DesplazableX>
  );
}
