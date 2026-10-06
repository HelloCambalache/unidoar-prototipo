import type { GrillaDisponibilidad } from "@/db/schema";
import { DIAS, FRANJAS, grillaVacia } from "@/lib/onboarding";

/*
 * La grilla semanal (franjas × días) vive en `docente_detalle.grilla_disponibilidad` y la lógica
 * (alternar casilleros, resumen, traducción a `docentes.disponibilidad`) es la del alta:
 * src/lib/onboarding.ts. Acá solo queda el caso de los docentes sin grilla guardada.
 */

/**
 * Docentes sin grilla (perfiles cargados a mano o de ejemplo) que solo tienen la lista de
 * turnos: cada turno se marca disponible de lunes a viernes (contraturno, todos los días).
 */
export function grillaDesdeLista(disponibilidad: string[]): GrillaDisponibilidad {
  const g = grillaVacia();
  const fullTime = disponibilidad.includes("Full time");
  const turnos = { manana: "Turno mañana", tarde: "Turno tarde", contraturno: "Contraturno / sábados" } as const;
  for (const f of FRANJAS) {
    if (!fullTime && !disponibilidad.includes(turnos[f.clave])) continue;
    g[f.clave] = DIAS.map((_, i) => (f.clave === "contraturno" || i < 5 ? "disponible" : "ocupada"));
  }
  return g;
}
