import type { FiltrosDocentes } from "@/lib/filtros-docentes";

/*
 * Panel de filtros en el celular (buscador de profesionales de la institución y buscador de trabajo del profesional). Por debajo de 760 px el
 * panel queda plegado detrás de un botón «Filtros» y, abierto, termina en un «Continuar» que lo cierra y lleva a los resultados (los filtros
 * se aplican solos al tocarlos: sin ese botón no había forma evidente de salir). Reglas puras: sin React ni base.
 */

/** `id` de la columna de resultados: a donde lleva «Continuar» (lo lleva la columna de resultados de cada buscador). */
export const ID_DE_RESULTADOS = "resultados-de-busqueda";

/** Cuántos filtros hay puestos DENTRO del panel (categoría, subcategorías, zonas y disponibilidad); los de la barra de arriba no cuentan acá. */
export function filtrosDelPanel(f: Pick<FiltrosDocentes, "categoria" | "disciplinas" | "zonas" | "disponibilidad">): number {
  return (f.categoria ? 1 : 0) + f.disciplinas.length + f.zonas.length + f.disponibilidad.length;
}

/** Lo que dice el pie del panel al lado de «Continuar»: cuántos profesionales quedaron con esos filtros. */
export function resumenDeResultados(total: number): string {
  if (total <= 0) return "Sin resultados con estos filtros";
  return total === 1 ? "1 profesional" : `${total} profesionales`;
}
