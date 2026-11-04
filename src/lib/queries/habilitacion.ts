import "server-only";
import { cache } from "react";
import { getDb } from "@/db";
import { asignaturas } from "@/db/schema";
import {
  claveDeRubro,
  habilitacionParaBusqueda as decidir,
  type BusquedaParaHabilitar,
  type Habilitacion,
  type PerfilParaHabilitar,
  type RubrosDelCatalogo,
} from "@/lib/habilitacion";

/** El catálogo de asignaturas con su rubro (una lectura por pedido: es una tabla chica que edita el equipo en Categorías). */
export const rubrosDelCatalogo = cache(async (): Promise<RubrosDelCatalogo> => {
  const filas = await getDb().select({ categoria: asignaturas.categoria, nombre: asignaturas.nombre, rubro: asignaturas.rubro }).from(asignaturas);
  return new Map(filas.map((f) => [claveDeRubro(f.categoria, f.nombre), f.rubro]));
});

/** ¿Este profesional puede postularse a esta búsqueda? Ver `src/lib/habilitacion.ts` para la regla. */
export async function habilitacionParaBusqueda(perfil: PerfilParaHabilitar, busqueda: BusquedaParaHabilitar): Promise<Habilitacion> {
  return decidir(perfil, busqueda, await rubrosDelCatalogo());
}
