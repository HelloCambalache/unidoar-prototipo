import { z } from "zod";
import type { CategoriaDocente } from "@/db/schema";
import { CATEGORIAS, NIVELES, TURNOS } from "@/lib/catalogo";

/* Filtros del buscador de trabajo del docente. Viven en la URL (searchParams) para poder compartirlos. */

/** El slider llega hasta acá y este valor significa "Toda la zona" (sin límite de km). */
export const RADIO_MAX = 50;
export const RADIO_MIN = 2;

export const filtrosOportunidadesSchema = z.object({
  q: z.string().trim().max(80).optional().catch(undefined),
  categoria: z.enum(CATEGORIAS).optional().catch(undefined),
  nivel: z.enum(NIVELES).optional().catch(undefined),
  turno: z.enum(TURNOS).optional().catch(undefined),
  radio: z.coerce.number().int().min(RADIO_MIN).max(RADIO_MAX).optional().catch(undefined),
  rapidas: z.literal("1").optional().catch(undefined),
  favoritos: z.literal("1").optional().catch(undefined),
  verificadas: z.literal("1").optional().catch(undefined),
  vista: z.enum(["lista", "mapa"]).optional().catch(undefined),
});
export type FiltrosOportunidades = z.infer<typeof filtrosOportunidadesSchema>;

type ParamsDePagina = Record<string, string | string[] | undefined>;

/** Lee y sanea los searchParams de la página: un valor inválido se ignora en vez de romper. */
export function leerFiltrosOportunidades(params: ParamsDePagina): FiltrosOportunidades {
  const plano = Object.fromEntries(Object.entries(params).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
  const filtros = filtrosOportunidadesSchema.parse(plano);
  return { ...filtros, q: filtros.q || undefined };
}

/** Arma la URL de una pantalla de búsqueda aplicando `cambios` sobre los filtros actuales (undefined/null/"" los quita). */
export function hrefOportunidades(
  base: string,
  filtros: FiltrosOportunidades,
  cambios: Partial<Record<keyof FiltrosOportunidades, string | number | null | undefined>> = {},
) {
  const params = new URLSearchParams();
  const todos: Record<string, string | number | null | undefined> = { ...filtros, ...cambios };
  for (const [clave, valor] of Object.entries(todos)) {
    if (valor !== undefined && valor !== null && valor !== "") params.set(clave, String(valor));
  }
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

/* Filtros de "Mis postulaciones" (también en la URL; `abrir` es el id de la postulación abierta en el cajón). */

export const filtrosPostulacionesSchema = z.object({
  q: z.string().trim().max(80).optional().catch(undefined),
  nivel: z.string().trim().max(60).optional().catch(undefined),
  zona: z.string().trim().max(160).optional().catch(undefined),
  tab: z.enum(["activas", "cerradas"]).catch("activas"),
  abrir: z.guid().optional().catch(undefined),
});
export type FiltrosPostulaciones = z.infer<typeof filtrosPostulacionesSchema>;

export function leerFiltrosPostulaciones(params: ParamsDePagina): FiltrosPostulaciones {
  const plano = Object.fromEntries(Object.entries(params).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
  const f = filtrosPostulacionesSchema.parse(plano);
  return { ...f, q: f.q || undefined, nivel: f.nivel || undefined, zona: f.zona || undefined };
}

export function hrefPostulaciones(
  filtros: FiltrosPostulaciones,
  cambios: Partial<Record<keyof FiltrosPostulaciones, string | null | undefined>> = {},
) {
  const params = new URLSearchParams();
  const todos: Record<string, string | null | undefined> = { ...filtros, ...cambios };
  // La pestaña por defecto no hace falta en la URL.
  if (todos.tab === "activas") delete todos.tab;
  for (const [clave, valor] of Object.entries(todos)) {
    if (valor) params.set(clave, valor);
  }
  const qs = params.toString();
  return qs ? `/docente/postulaciones?${qs}` : "/docente/postulaciones";
}

export const ETIQUETA_FILTRO_CATEGORIA: Record<CategoriaDocente, string> = {
  educador: "Docente",
  entrenador: "Entrenador/a / Instructor/a",
  guardavidas: "Guardavidas",
};

/** Leyenda del mapa: se muestra solo para las categorías que tienen pines. */
export const LEYENDA_CATEGORIA: Record<CategoriaDocente, string> = {
  educador: "Docentes",
  entrenador: "Entrenadores / Instructores",
  guardavidas: "Guardavidas",
};

/** "40 min", "18 hs", "3 días"; null si ya venció. */
export function tiempoRestante(hasta: Date | string, ahora = new Date()) {
  const min = Math.round((new Date(hasta).getTime() - ahora.getTime()) / 60_000);
  if (min <= 0) return null;
  if (min < 60) return `${min} min`;
  const horas = Math.round(min / 60);
  if (horas < 48) return `${horas} hs`;
  return `${Math.round(horas / 24)} días`;
}

/** Una búsqueda recibe postulaciones solo si está activa y, siendo rápida, no venció su plazo de respuesta. */
export function busquedaAbierta(
  b: { estado: "activa" | "pausada" | "cerrada"; rapida: boolean; venceEn: Date | null },
  ahora = new Date(),
) {
  if (b.estado !== "activa") return false;
  return !(b.rapida && b.venceEn && b.venceEn.getTime() <= ahora.getTime());
}

/** Los ids llegan de la URL o del cliente: se validan antes de tocar la base (un uuid mal formado haría fallar la query). */
export function esId(valor: unknown): valor is string {
  return z.guid().safeParse(valor).success;
}

export function nombreCompleto(d: { nombre: string; apellido: string }) {
  return `${d.nombre} ${d.apellido}`.trim();
}
