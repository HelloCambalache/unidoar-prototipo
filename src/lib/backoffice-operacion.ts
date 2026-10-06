import { inicioDeAnio, MS } from "@/lib/fechas";

/*
 * Períodos de "Cómo viene la operación" y formato de sus números. Sin acceso a base:
 * lo usan la query, la página y el selector del navegador.
 */

export const PERIODOS = [
  { clave: "semana", etiqueta: "Última semana", frase: "en la última semana" },
  { clave: "mes", etiqueta: "Último mes", frase: "en el último mes" },
  { clave: "trimestre", etiqueta: "Últimos 3 meses", frase: "en los últimos 3 meses" },
  { clave: "anio", etiqueta: "Lo que va del año", frase: "en lo que va del año" },
  { clave: "ciclo", etiqueta: "Ciclo lectivo", frase: "en el ciclo lectivo" },
] as const;
export type PeriodoClave = (typeof PERIODOS)[number]["clave"];

export const PERIODO_POR_DEFECTO: PeriodoClave = "mes";

export const leerPeriodo = (v: string | string[] | undefined): PeriodoClave => {
  const valor = Array.isArray(v) ? v[0] : v;
  return PERIODOS.find((p) => p.clave === valor)?.clave ?? PERIODO_POR_DEFECTO;
};

/** Menos postulantes que esto tras una semana = flojita (llamar a la institución). */
export const MINIMO_POSTULANTES = 3;
/**
 * Relación docentes ↔ búsquedas abiertas por zona. Por debajo de MINIMO hay búsquedas que no se van a cubrir
 * ("falta oferta"); entre MINIMO y OK está justo. Son umbrales de criterio operativo, no un dato de la base.
 */
export const DOCENTES_POR_BUSQUEDA_MINIMO = 3;
export const DOCENTES_POR_BUSQUEDA_OK = 6;

const ZONA = "America/Argentina/Buenos_Aires";

/** Año y mes (1 a 12) de hoy en hora argentina. */
function hoyEnArgentina(ahora: Date) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("es-AR", { timeZone: ZONA, year: "numeric", month: "numeric" })
      .formatToParts(ahora)
      .map((x) => [x.type, x.value]),
  );
  return { anio: Number(p.year), mes: Number(p.month) };
}

/** El ciclo lectivo arranca el 1° de marzo: antes de esa fecha sigue el del año anterior. */
function inicioDeCiclo(ahora: Date) {
  const { anio, mes } = hoyEnArgentina(ahora);
  const anioCiclo = mes >= 3 ? anio : anio - 1;
  return { anioCiclo, desde: new Date(`${anioCiclo}-03-01T00:00:00-03:00`) };
}

export type RangoPeriodo = {
  clave: PeriodoClave;
  /** "Último mes", "Ciclo lectivo 2026". */
  etiqueta: string;
  /** "en el último mes" (para las notas de las tarjetas). */
  frase: string;
  desde: Date;
  hasta: Date;
  /** Inicio del período anterior de igual duración (termina donde empieza este). */
  anteriorDesde: Date;
};

export function rangoDelPeriodo(clave: PeriodoClave, ahora = new Date()): RangoPeriodo {
  const base = PERIODOS.find((p) => p.clave === clave)!;
  let desde: Date;
  let etiqueta: string = base.etiqueta;
  let frase: string = base.frase;
  switch (clave) {
    case "semana":
      desde = new Date(ahora.getTime() - 7 * MS.DIA);
      break;
    case "mes":
      desde = new Date(ahora.getTime() - 30 * MS.DIA);
      break;
    case "trimestre":
      desde = new Date(ahora.getTime() - 90 * MS.DIA);
      break;
    case "anio":
      desde = inicioDeAnio(ahora);
      break;
    case "ciclo": {
      const ciclo = inicioDeCiclo(ahora);
      desde = ciclo.desde;
      etiqueta = `Ciclo lectivo ${ciclo.anioCiclo}`;
      frase = `en el ciclo lectivo ${ciclo.anioCiclo}`;
      break;
    }
  }
  return { clave, etiqueta, frase, desde, hasta: ahora, anteriorDesde: new Date(desde.getTime() - (ahora.getTime() - desde.getTime())) };
}

/** Opciones del selector (la del ciclo lleva el año en curso). */
export function opcionesDePeriodo(ahora = new Date()) {
  return PERIODOS.map((p) => ({ clave: p.clave, etiqueta: p.clave === "ciclo" ? rangoDelPeriodo("ciclo", ahora).etiqueta : p.etiqueta }));
}

const numero = new Intl.NumberFormat("es-AR");
export const enteroAR = (n: number) => numero.format(n);

/** "42 min", "4,2 h", "3,5 días": para promedios de tiempo medidos en horas. */
export function duracionDeHoras(horas: number) {
  const dec = (n: number) => new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format(n);
  if (horas < 1) return `${Math.max(1, Math.round(horas * 60))} min`;
  if (horas < 48) return `${dec(horas)} h`;
  return `${dec(horas / 24)} días`;
}

/** ["Tigre", "San Isidro", "CABA"] → "Tigre, San Isidro y CABA". */
export function listaLegible(xs: string[]) {
  return xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}`;
}
