import { cn } from "@/lib/utils";

/**
 * El logo de la identidad nueva: el isotipo con "UNIDOAR" escrito al lado. Es para fondos oscuros (el nombre va en blanco):
 * la cabecera y el pie del sitio público y la foto del ingreso y del alta. `sm` es la versión chica, para el pie.
 * El enlace que lo envuelve pone el nombre accesible ("UNIDOAR, ir al inicio"): el isotipo es decorativo.
 */
export function LogoMarca({ tamano = "md", className }: { tamano?: "md" | "sm"; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- isotipo fijo */}
      <img src="/assets/unidoar-logo.png" alt="" className={cn("flex-none object-contain", tamano === "sm" ? "size-8" : "size-10")} />
      <span
        className={cn(
          "font-display font-semibold tracking-[0.08em] text-white",
          tamano === "sm" ? "text-[16px]" : "text-[18px]",
        )}
      >
        UNIDOAR
      </span>
    </span>
  );
}
