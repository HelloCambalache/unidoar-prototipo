import { z } from "zod";
import { CATEGORIAS } from "@/lib/catalogo";
import type { CategoriaDocente } from "@/db/schema";

/* Reglas del ABM de categorías del backoffice. Sin acceso a base: las usan el cliente y las server actions. */

/** Bajada de cada categoría de cargo en el menú del ABM. */
export const DESCRIPCION_CATEGORIA: Record<CategoriaDocente, string> = {
  educador: "Profesionales de aula: materias, niveles e idiomas de colegios, jardines e institutos.",
  entrenador: "Entrenadores e instructores de clubes, gimnasios y escuelas deportivas.",
  guardavidas: "Guardavidas de piletas, natatorios, playas, ríos y colonias.",
};

/** Clave para comparar nombres sin distinguir mayúsculas, tildes ni espacios de más. */
export const claveDeNombre = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const espaciosSimples = (s: string) => s.replace(/\s+/g, " ");

export const nombreAsignaturaSchema = z
  .string()
  .trim()
  .min(2, "Escribí el nombre (mínimo 2 letras)")
  .max(100, "Máximo 100 caracteres")
  .transform(espaciosSimples);

export const nombreRubroSchema = z
  .string()
  .trim()
  .min(2, "Escribí el nombre del rubro (mínimo 2 letras)")
  .max(80, "Máximo 80 caracteres")
  .transform(espaciosSimples);

export const categoriaSchema = z.enum(CATEGORIAS, { error: "Esa categoría no existe" });

export const asignaturaNuevaSchema = z.object({
  categoria: categoriaSchema,
  /** Rubro existente (texto exacto) o, con `nuevoRubro`, el nombre del rubro que se crea. */
  rubro: nombreRubroSchema,
  nombre: nombreAsignaturaSchema,
  nuevoRubro: z.boolean().default(false),
});
export type AsignaturaNueva = z.input<typeof asignaturaNuevaSchema>;

export const renombreAsignaturaSchema = z.object({ nombre: nombreAsignaturaSchema });

export const renombreRubroSchema = z.object({
  categoria: categoriaSchema,
  rubro: z.string().trim().min(1, "Falta el rubro").max(80),
  nuevoNombre: nombreRubroSchema,
});
