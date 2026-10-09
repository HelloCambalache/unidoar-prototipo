import { cn } from "@/lib/utils";

/**
 * "Construido con ♥ por Cambalache Studio": la firma del estudio. Los estilos están en globals.css (`.firma-cambalache`).
 * Sobre fondo oscuro se pasa `oscura` (cambian solo el texto y el borde). El corazón NO se personaliza: color, viewBox y
 * `crispEdges` son parte de la firma (si se cambian, se ve borroso).
 */
export function FirmaCambalache({ oscura = false, className }: { oscura?: boolean; className?: string }) {
  return (
    <p className={cn("firma-cambalache", oscura && "firma-cambalache--oscura", className)}>
      Construido con{" "}
      <svg
        className="firma-cambalache__corazon"
        role="img"
        aria-label="cariño"
        viewBox="0 0 14 12"
        width="12"
        height="11"
        shapeRendering="crispEdges"
      >
        <path fill="currentColor" d="M2 0h4v2H2zM8 0h4v2H8zM0 2h14v4H0zM2 6h10v2H2zM4 8h6v2H4zM6 10h2v2H6z" />
      </svg>{" "}
      por{" "}
      <a href="https://cambalache.studio" target="_blank" rel="noopener noreferrer">
        Cambalache Studio
      </a>
    </p>
  );
}
