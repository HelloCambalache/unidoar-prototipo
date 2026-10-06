import type { EstadoVerificacionDocente } from "@/lib/backoffice-docentes";
import { pendientesDePerfil, type DatosDePerfil } from "@/lib/perfil";

/*
 * Scoring interno de docentes (0 a 100): un solo número para ordenar y priorizar en el backoffice
 * ("¿a quién conviene empujar o contactar primero?"). NUNCA se muestra a docentes ni a instituciones,
 * y no alimenta el orden del buscador de las instituciones: es una herramienta del equipo.
 *
 * Es una función pura (sin base de datos): las consultas del backoffice le pasan los datos ya contados.
 * Cuatro componentes, cada uno con su tope; la suma es el puntaje:
 *
 *   Perfil          hasta 35  proporción de pasos del perfil completos (foto, resumen, zonas, experiencia…),
 *                             sin contar la verificación para no premiarla dos veces.
 *   Verificación    hasta 30  identidad verificada 20, título/credencial 5, certificado de buena conducta 5.
 *   Actividad       hasta 20  postulaciones enviadas (hasta 5 → 12 puntos) y qué tan reciente fue la última
 *                             actividad (≤ 14 días 8, ≤ 45 días 5, ≤ 90 días 2).
 *   Contrataciones  hasta 15  las contrataciones cerradas (hasta 3 → 15 puntos).
 *
 * Los pesos están en PESOS: ajustarlos es cambiar un número, y el desglose de la ficha lo refleja solo.
 */

export const PESOS = {
  perfil: 35,
  identidad: 20,
  titulo: 5,
  antecedentes: 5,
  postulaciones: 12,
  recencia: 8,
  contrataciones: 15,
} as const;

/** Postulaciones a partir de las cuales ya no suma más. */
const TOPE_POSTULACIONES = 5;
/** Contrataciones a partir de las cuales ya no suma más. */
const TOPE_CONTRATACIONES = 3;
/** Tramos de "última actividad": hasta N días → fracción de los puntos de recencia. */
const TRAMOS_RECENCIA = [
  { dias: 14, fraccion: 1 },
  { dias: 45, fraccion: 5 / 8 },
  { dias: 90, fraccion: 2 / 8 },
] as const;

export type EntradaScoring = {
  /** 0 a 100: pasos del perfil completos, sin contar la verificación (ver `porcentajePerfilParaScoring`). */
  perfilPct: number;
  verificacion: EstadoVerificacionDocente;
  tituloVerificado: boolean;
  antecedentesVerificados: boolean;
  /** Postulaciones que el propio docente envió (no cuentan las invitaciones de las instituciones). */
  postulaciones: number;
  contrataciones: number;
  /** Días desde su última actividad (notificación o postulación); null si nunca tuvo. */
  diasSinActividad: number | null;
};

export type ParteScoring = { clave: "perfil" | "verificacion" | "actividad" | "contrataciones"; etiqueta: string; puntos: number; maximo: number };

const entre = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/** El porcentaje de perfil que usa el scoring: el mismo cálculo que ve el docente, menos el paso de verificación. */
export function porcentajePerfilParaScoring(d: DatosDePerfil) {
  const pasos = pendientesDePerfil(d).pasos.filter((p) => p.clave !== "verificacion");
  if (pasos.length === 0) return 0;
  return Math.round((pasos.filter((p) => p.ok).length / pasos.length) * 100);
}

/** El puntaje separado por componente (para explicarlo en la ficha) y el total, redondeado y entre 0 y 100. */
export function desgloseScoring(e: EntradaScoring): { total: number; partes: ParteScoring[] } {
  const perfil = (entre(e.perfilPct, 0, 100) / 100) * PESOS.perfil;

  const verificacion =
    (e.verificacion === "verificado" ? PESOS.identidad : 0) +
    (e.tituloVerificado ? PESOS.titulo : 0) +
    (e.antecedentesVerificados ? PESOS.antecedentes : 0);

  const tramo = e.diasSinActividad == null ? null : TRAMOS_RECENCIA.find((t) => e.diasSinActividad! <= t.dias);
  const actividad =
    (Math.min(Math.max(e.postulaciones, 0), TOPE_POSTULACIONES) / TOPE_POSTULACIONES) * PESOS.postulaciones +
    (tramo ? tramo.fraccion * PESOS.recencia : 0);

  const contrataciones = (Math.min(Math.max(e.contrataciones, 0), TOPE_CONTRATACIONES) / TOPE_CONTRATACIONES) * PESOS.contrataciones;

  const partes: ParteScoring[] = [
    { clave: "perfil", etiqueta: "Perfil completo", puntos: perfil, maximo: PESOS.perfil },
    {
      clave: "verificacion",
      etiqueta: "Verificación",
      puntos: verificacion,
      maximo: PESOS.identidad + PESOS.titulo + PESOS.antecedentes,
    },
    { clave: "actividad", etiqueta: "Actividad", puntos: actividad, maximo: PESOS.postulaciones + PESOS.recencia },
    { clave: "contrataciones", etiqueta: "Contrataciones", puntos: contrataciones, maximo: PESOS.contrataciones },
  ];
  const total = Math.round(entre(partes.reduce((s, p) => s + p.puntos, 0), 0, 100));
  return { total, partes: partes.map((p) => ({ ...p, puntos: Math.round(p.puntos * 10) / 10 })) };
}

/** Solo el número (0 a 100). */
export const calcularScoring = (e: EntradaScoring) => desgloseScoring(e).total;
