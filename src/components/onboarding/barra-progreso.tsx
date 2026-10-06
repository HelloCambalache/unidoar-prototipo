import { cn } from "@/lib/utils";

/** Barra fina bajo el encabezado del alta: azul en institución, bordó en docente (colores del prototipo). */
export function BarraProgreso({ progreso, rol }: { progreso: number; rol: "institucion" | "docente" }) {
  return (
    <div
      role="progressbar"
      aria-label="Avance del alta"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={progreso}
      className="h-[3px] bg-borde"
    >
      <div
        style={{ width: `${progreso}%` }}
        className={cn("h-full transition-[width] duration-300", rol === "institucion" ? "bg-navy-700" : "bg-rosa")}
      />
    </div>
  );
}
