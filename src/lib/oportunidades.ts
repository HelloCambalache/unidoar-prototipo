import { z } from "zod";
import type { CategoriaDocente } from "@/db/schema";
import { CATEGORIA_INFO, CATEGORIAS, NIVELES, TIPOS_BUSQUEDA, TURNOS } from "@/lib/catalogo";
import { coincideAsignatura } from "@/lib/coincidencia";

/* Filtros del buscador de trabajo del docente. Viven en la URL (searchParams) para poder compartirlos. */

/** Valor de `?categoria=` que pide las búsquedas de todas las categorías (sin él, el profesional ve las de la suya). */
export const CATEGORIA_TODAS = "todas";

/**
 * El slider llega hasta acá y este valor significa "Toda la zona" (sin límite de km). Es 100 y no 50 porque en el perfil se puede elegir
 * "hasta 50 km", que es un radio de verdad: si "sin límite" fuera 50, esa elección mostraría ofertas de todo el país.
 */
export const RADIO_MAX = 100;
export const RADIO_MIN = 2;

export const filtrosOportunidadesSchema = z.object({
  q: z.string().trim().max(80).optional().catch(undefined),
  categoria: z.union([z.enum(CATEGORIAS), z.literal(CATEGORIA_TODAS)]).optional().catch(undefined),
  nivel: z.enum(NIVELES).optional().catch(undefined),
  turno: z.enum(TURNOS).optional().catch(undefined),
  tipo: z.enum(TIPOS_BUSQUEDA).optional().catch(undefined),
  radio: z.coerce.number().int().min(RADIO_MIN).max(RADIO_MAX).optional().catch(undefined),
  rapidas: z.literal("1").optional().catch(undefined),
  favoritos: z.literal("1").optional().catch(undefined),
  verificadas: z.literal("1").optional().catch(undefined),
  vista: z.enum(["lista", "mapa"]).optional().catch(undefined),
});
export type FiltrosOportunidades = z.infer<typeof filtrosOportunidadesSchema>;

/**
 * La categoría por la que se filtran las búsquedas. Sin elegir ninguna, un profesional ve las de SU categoría (un preceptor no
 * necesita las de guardavidas): el aviso de una búsqueda nueva también le llega solo por categoría. Elegir "Todas"
 * (`?categoria=todas`) o una categoría puntual manda sobre eso. Sin perfil (el sitio público) sin elegir no se filtra nada.
 */
export function categoriaDeBusqueda(elegida: FiltrosOportunidades["categoria"], propia?: CategoriaDocente | null): CategoriaDocente | undefined {
  if (elegida === CATEGORIA_TODAS) return undefined;
  return elegida ?? propia ?? undefined;
}

/**
 * Orden de las búsquedas de la lista: las rápidas primero; dentro de cada grupo, las de la materia del profesional y,
 * entre iguales, las más cercanas (las que no tienen distancia calculable, al final).
 */
export function compararOfertas(
  a: { rapida: boolean; disciplina: string; km: number | null },
  b: { rapida: boolean; disciplina: string; km: number | null },
  asignaturas: string[] = [],
) {
  if (a.rapida !== b.rapida) return a.rapida ? -1 : 1;
  const deSuMateria = (o: { disciplina: string }) => coincideAsignatura(o.disciplina, asignaturas);
  if (deSuMateria(a) !== deSuMateria(b)) return deSuMateria(a) ? -1 : 1;
  if (a.km !== null && b.km !== null) return a.km - b.km;
  if (a.km !== null) return -1;
  if (b.km !== null) return 1;
  return 0;
}

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

// Los nombres salen de CATEGORIA_INFO (la categoría "educador" se llama "Docente"): un solo lugar para cambiarlos.
export const ETIQUETA_FILTRO_CATEGORIA: Record<CategoriaDocente, string> = {
  educador: CATEGORIA_INFO.educador.label,
  entrenador: `${CATEGORIA_INFO.entrenador.label} / Instructor/a`,
  guardavidas: CATEGORIA_INFO.guardavidas.label,
};

/** Leyenda del mapa: se muestra solo para las categorías que tienen pines. */
export const LEYENDA_CATEGORIA: Record<CategoriaDocente, string> = {
  educador: CATEGORIA_INFO.educador.plural,
  entrenador: `${CATEGORIA_INFO.entrenador.plural} / Instructores`,
  guardavidas: CATEGORIA_INFO.guardavidas.plural,
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

/**
 * Las búsquedas urgentes abiertas (rápidas y a las que la persona todavía no se postuló) van primero; el resto conserva el
 * orden que ya traía. Lo usan Buscar trabajo de adentro y el público, para que se vean igual.
 */
export function urgentesPrimero<T extends { rapida: boolean; postulacion: unknown }>(ofertas: T[]): T[] {
  const esUrgente = (o: T) => o.rapida && !o.postulacion;
  return [...ofertas.filter(esUrgente), ...ofertas.filter((o) => !esUrgente(o))];
}
