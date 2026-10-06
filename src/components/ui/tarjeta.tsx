import { cn } from "@/lib/utils";

/** Contenedor blanco con borde (radio 8px) usado en toda la app. */
export function Tarjeta({
  className,
  como: Tag = "div",
  ...props
}: React.HTMLAttributes<HTMLElement> & { como?: "div" | "section" | "article" | "li" }) {
  return <Tag className={cn("rounded-ud border border-borde bg-white p-5", className)} {...props} />;
}

/** Etiqueta de sección en mayúsculas chicas ("DETALLE DEL PUESTO"). */
export function EtiquetaSeccion({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("mb-2.5 text-[11px] leading-none font-semibold tracking-[.06em] text-sutil uppercase", className)} {...props} />
  );
}

/** Dato con ícono en una línea (zona, horario, tipo…). */
export function DatoLinea({
  icono,
  children,
  className,
}: {
  icono: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2 text-[13px] leading-snug text-tinta-2", className)}>
      <span className="text-apagado">{icono}</span>
      {children}
    </div>
  );
}
