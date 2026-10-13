import type { CategoriaDocente } from "@/db/schema";
import { TURNO_A_DISPONIBILIDAD } from "@/lib/busquedas";
import { kmLegible } from "@/lib/geo";

/*
 * Qué profesionales recomendar a una institución y por qué. Cada candidato recibe un puntaje con lo que sabemos de él y de las
 * búsquedas abiertas de la institución (¿da la disciplina que buscan?, ¿en su nivel y turno?, ¿qué tan cerca está?, ¿cuánta
 * experiencia tiene?, ¿tiene el título verificado?) y los MOTIVOS que lo explican, para mostrarle a la institución por qué le
 * aparece esa persona. Funciones puras: sin base ni modelo.
 */

export type CandidatoRecomendable = {
  categoria: CategoriaDocente;
  asignaturas: string[];
  niveles: string[];
  disponibilidad: string[];
  aniosExperiencia: number | null;
  tituloVerificado: boolean;
  /** Distancia a la sede más cercana; null si no se pudo calcular. */
  km: number | null;
};

/** Lo que se sabe de una búsqueda abierta de la institución. */
export type BusquedaAbierta = {
  categoria: CategoriaDocente;
  disciplina: string;
  nivel: string | null;
  turno: string | null;
};

export type Puntuado = { puntaje: number; motivos: string[] };

const igual = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Hasta 20 puntos por cercanía: dentro de 2 km es lo máximo y baja con la distancia. */
export const puntosPorCercania = (km: number | null) => (km == null ? 0 : Math.max(0, Math.round(20 - Math.max(0, km - 2) * 0.9)));

/** Un punto por año de experiencia, hasta 10. */
export const puntosPorExperiencia = (anios: number | null) => Math.min(10, Math.max(0, anios ?? 0));

/** Lo que una búsqueda suma a un candidato: la disciplina pesa más que el nivel y el turno. */
function afinidadConBusqueda(c: CandidatoRecomendable, b: BusquedaAbierta) {
  if (c.categoria !== b.categoria) return { puntos: 0, motivos: [] as string[] };
  const motivos: string[] = [];
  let puntos = 0;
  if (b.disciplina && c.asignaturas.some((a) => igual(a, b.disciplina))) {
    puntos += 40;
    motivos.push(`Da ${b.disciplina}, como tu búsqueda abierta`);
  }
  if (b.nivel && c.niveles.some((n) => igual(n, b.nivel!))) {
    puntos += 8;
    motivos.push(`Trabaja en nivel ${b.nivel.toLowerCase()}`);
  }
  const turnoDisponible = b.turno ? TURNO_A_DISPONIBILIDAD[b.turno as keyof typeof TURNO_A_DISPONIBILIDAD] : undefined;
  if (b.turno && turnoDisponible && c.disponibilidad.some((d) => turnoDisponible.includes(d))) {
    puntos += 8;
    motivos.push(`Disponible en turno ${b.turno.toLowerCase()}`);
  }
  return { puntos, motivos };
}

/**
 * El puntaje de un candidato (cuanto más alto, más recomendable) y los motivos, del más importante al menos. Se toma la búsqueda
 * abierta con la que más coincide; sin búsquedas, cuentan solo la cercanía, la experiencia y el título.
 */
export function puntuarCandidato(c: CandidatoRecomendable, busquedas: BusquedaAbierta[]): Puntuado {
  const mejor = busquedas.map((b) => afinidadConBusqueda(c, b)).sort((a, b) => b.puntos - a.puntos)[0] ?? { puntos: 0, motivos: [] };
  const motivos = [...mejor.motivos];
  const cerca = kmLegible(c.km);
  // kmLegible ya trae el "a": "a 5 km" → "A 5 km de tu sede".
  if (c.km != null && c.km <= 10 && cerca) motivos.push(`${cerca.charAt(0).toUpperCase()}${cerca.slice(1)} de tu sede`);
  if ((c.aniosExperiencia ?? 0) >= 3) motivos.push(`${c.aniosExperiencia} años de experiencia`);
  if (c.tituloVerificado) motivos.push("Título verificado");
  const puntaje = mejor.puntos + puntosPorCercania(c.km) + puntosPorExperiencia(c.aniosExperiencia) + (c.tituloVerificado ? 5 : 0);
  return { puntaje, motivos };
}

/** Ordena de más a menos recomendable; ante un empate, el más cercano primero. */
export function ordenarPorPuntaje<T extends { puntaje: number; km: number | null }>(candidatos: T[]): T[] {
  return [...candidatos].sort((a, b) => b.puntaje - a.puntaje || (a.km ?? Infinity) - (b.km ?? Infinity));
}
