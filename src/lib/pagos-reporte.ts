import { filtrarPorNombre } from "@/lib/buscar-por-nombre";
import { diasEntreFechas, esFechaIso } from "@/lib/planes";
import { MEDIOS_PAGO } from "@/lib/cobros";

/*
 * Reporte de pagos del backoffice (Cobros → Pagos, pedido de Flor, 2026-11-10): todos los pagos que entraron, de cualquier institución y por cualquier
 * medio, con la fecha, el concepto y **el método con el que se pagó**, filtrables y descargables en CSV. Reglas puras (sin base ni Next) para poder
 * cuidarlas con una prueba; las lecturas están en `src/lib/queries/backoffice-pagos.ts`.
 *
 * Qué cuenta como pago: cada factura PAGA (una mensual, un semestre al contado o un cobro del débito automático o del pago del semestre por Mercado
 * Pago, que también dejan su factura paga) y cada búsqueda puntual pagada (que no es una factura). Los cobros rechazados no son pagos. Un semestre
 * cuenta una sola vez, con su monto entero y el día en que se pagó.
 */

/** Cuando el pago no tiene el medio anotado (un dato viejo). */
export const SIN_DATO = "Sin dato";

/** Los medios que se pueden elegir en el filtro. */
export const MEDIOS_DEL_REPORTE: readonly string[] = [...MEDIOS_PAGO, SIN_DATO];

/** El medio como se muestra: lo que está anotado o «Sin dato». */
export const medioDelPago = (medio: string | null | undefined): string => medio?.trim() || SIN_DATO;

export type PagoDelReporte = {
  /** Para distinguir las filas (una factura y una búsqueda puntual pueden tener el mismo número). */
  clave: string;
  /** El id de la factura o de la búsqueda puntual pagada (según `tipo`): a qué pago se le adjunta el comprobante. */
  pagoId: string;
  /** El día en que se pagó, en hora de Argentina (`YYYY-MM-DD`). */
  fecha: string;
  institucionId: string;
  institucion: string;
  cuit: string | null;
  tipo: "factura" | "puntual";
  /** «Noviembre 2026», «6 meses (octubre 2026 a marzo 2027)» o «Búsqueda puntual». */
  concepto: string;
  /** La clave del plan en ese momento. */
  plan: string;
  medio: string;
  /** Pesos enteros. */
  monto: number;
  /** El número del comprobante de la factura (el que lleva el mail y la hoja de la app); null en la búsqueda puntual, que no es una factura. */
  comprobante: string | null;
  /** El comprobante de pago que adjuntó el equipo (la captura o el PDF de la transferencia, el recibo…), o null si todavía no hay. */
  adjunto: { id: string; nombre: string } | null;
};

export type FiltrosDePagos = {
  /** Primer día (inclusive), `YYYY-MM-DD`. */
  desde: string;
  /** Último día (inclusive), `YYYY-MM-DD`. */
  hasta: string;
  /** Uno de `MEDIOS_DEL_REPORTE`, o «» para todos. */
  medio: string;
  /** Parte del nombre de la institución. */
  q: string;
  /** Incluye los pagos de las instituciones de ejemplo (por defecto no: son pruebas). */
  conEjemplo: boolean;
  /** Solo los pagos que tienen el comprobante adjunto («con»), solo los que no («sin») o todos (`""`). */
  adjunto: "" | "con" | "sin";
};

const unico = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** El primer día del mes de una fecha: «2026-11-10» → «2026-11-01». */
export const primerDiaDelMes = (fecha: string) => `${fecha.slice(0, 7)}-01`;

/** Suma días a una fecha `YYYY-MM-DD` (puede ser negativo). */
export function sumarDiasAFecha(fecha: string, dias: number): string {
  const [a, m, d] = fecha.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10);
}

/** El último día del mes de una fecha: «2026-11-10» → «2026-11-30». */
export function ultimoDiaDelMes(fecha: string): string {
  const [a, m] = fecha.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10);
}

/**
 * Lee los filtros de la dirección (`?desde=&hasta=&medio=&q=&ejemplo=1`). Sin fechas (o con una que no existe) muestra **el mes en curso**; si
 * `desde` es posterior a `hasta` los da vuelta; un medio que no es de la lista se ignora. Nunca lanza: todo lo que viene de la URL se desconfía.
 */
export function leerFiltrosDePagos(sp: Record<string, string | string[] | undefined>, hoy: string): FiltrosDePagos {
  let desde = unico(sp.desde);
  let hasta = unico(sp.hasta);
  if (!esFechaIso(desde)) desde = primerDiaDelMes(hoy);
  if (!esFechaIso(hasta)) hasta = hoy;
  if (desde > hasta) [desde, hasta] = [hasta, desde];
  const medio = unico(sp.medio);
  const adjunto = unico(sp.adjunto);
  return {
    desde,
    hasta,
    medio: MEDIOS_DEL_REPORTE.includes(medio) ? medio : "",
    q: unico(sp.q).trim().slice(0, 80),
    conEjemplo: unico(sp.ejemplo) === "1",
    adjunto: adjunto === "con" || adjunto === "sin" ? adjunto : "",
  };
}

/** Los rangos de un toque del reporte. */
export function atajosDeFechas(hoy: string): { clave: string; etiqueta: string; desde: string; hasta: string }[] {
  const inicioDeEsteMes = primerDiaDelMes(hoy);
  const finDelMesPasado = sumarDiasAFecha(inicioDeEsteMes, -1);
  return [
    { clave: "este-mes", etiqueta: "Este mes", desde: inicioDeEsteMes, hasta: hoy },
    { clave: "mes-pasado", etiqueta: "Mes pasado", desde: primerDiaDelMes(finDelMesPasado), hasta: ultimoDiaDelMes(finDelMesPasado) },
    { clave: "30-dias", etiqueta: "Últimos 30 días", desde: sumarDiasAFecha(hoy, -29), hasta: hoy },
    { clave: "este-anio", etiqueta: "Este año", desde: `${hoy.slice(0, 4)}-01-01`, hasta: hoy },
  ];
}

/** ¿Es el mismo rango? (para marcar el atajo activo). */
export const mismoRango = (a: { desde: string; hasta: string }, b: { desde: string; hasta: string }) => a.desde === b.desde && a.hasta === b.hasta;

/** Los pagos de las instituciones cuyo nombre tiene todas las palabras escritas (sin importar mayúsculas ni tildes). */
export function filtrarPagosPorInstitucion(pagos: PagoDelReporte[], q: string): PagoDelReporte[] {
  return filtrarPorNombre(
    pagos.map((p) => ({ nombre: p.institucion, p })),
    q,
  ).map((x) => x.p);
}

/** Los pagos que tienen (o no tienen) el comprobante adjunto; con `""` no se filtra nada. */
export function filtrarPagosPorAdjunto(pagos: PagoDelReporte[], adjunto: FiltrosDePagos["adjunto"]): PagoDelReporte[] {
  if (adjunto === "con") return pagos.filter((p) => p.adjunto !== null);
  if (adjunto === "sin") return pagos.filter((p) => p.adjunto === null);
  return pagos;
}

/** De más nuevo a más viejo; a igual día, por institución y concepto (para que el orden no cambie de una carga a otra). */
export function ordenarPagos(pagos: PagoDelReporte[]): PagoDelReporte[] {
  return [...pagos].sort(
    (a, b) => b.fecha.localeCompare(a.fecha) || a.institucion.localeCompare(b.institucion, "es") || a.concepto.localeCompare(b.concepto, "es") || a.clave.localeCompare(b.clave),
  );
}

export type TotalPorMedio = { medio: string; cantidad: number; monto: number };

/** Cuánto entró en total y por cada medio (el que más plata puso, primero). */
export function totalesDePagos(pagos: readonly PagoDelReporte[]): { total: number; cantidad: number; porMedio: TotalPorMedio[] } {
  const porMedio = new Map<string, TotalPorMedio>();
  let total = 0;
  for (const p of pagos) {
    total += p.monto;
    const actual = porMedio.get(p.medio) ?? { medio: p.medio, cantidad: 0, monto: 0 };
    actual.cantidad += 1;
    actual.monto += p.monto;
    porMedio.set(p.medio, actual);
  }
  return {
    total,
    cantidad: pagos.length,
    porMedio: [...porMedio.values()].sort((a, b) => b.monto - a.monto || a.medio.localeCompare(b.medio, "es")),
  };
}

/* ───────────────────────────── CSV ───────────────────────────── */

/** Una celda del CSV: entre comillas, con las comillas escapadas y, si empieza como una fórmula (=, +, -, @), con un apóstrofo delante para que Excel no la ejecute. */
export function celdaCsv(valor: string): string {
  const seguro = /^[=+\-@\t\r]/.test(valor) ? `'${valor}` : valor;
  return `"${seguro.replaceAll('"', '""')}"`;
}

const COLUMNAS_CSV = ["Fecha de pago", "Institución", "CUIT", "Concepto", "Plan", "Medio de pago", "Monto", "N.º de comprobante (UNIDOAR)", "Comprobante de pago adjunto"];

/** `2026-11-10` → `10/11/2026`. */
export const fechaParaCsv = (fecha: string) => fecha.split("-").reverse().join("/");

/**
 * El reporte como CSV: separado por punto y coma y con BOM (así Excel en español lo abre bien), una fila por pago y, al final, una fila con el total.
 * El monto va como número entero de pesos, sin separador de miles, para poder sumarlo.
 */
export function csvDePagos(pagos: readonly PagoDelReporte[], nombrePlan: (clave: string) => string): string {
  const filas = pagos.map((p) =>
    [fechaParaCsv(p.fecha), p.institucion, p.cuit ?? "", p.concepto, nombrePlan(p.plan), p.medio, String(p.monto), p.comprobante ?? "", p.adjunto ? "Sí" : "No"].map(celdaCsv).join(";"),
  );
  const { total } = totalesDePagos(pagos);
  const pie = ["Total", "", "", "", "", "", String(total), "", ""].map(celdaCsv).join(";");
  return `﻿${[COLUMNAS_CSV.map(celdaCsv).join(";"), ...filas, pie].join("\r\n")}\r\n`;
}

/** El nombre del archivo: `pagos-2026-11-01-a-2026-11-10.csv`. */
export const nombreDelCsv = (f: Pick<FiltrosDePagos, "desde" | "hasta">) => `pagos-${f.desde}-a-${f.hasta}.csv`;

/** Cuántos días abarca el rango (inclusive): para avisar de un reporte muy largo. */
export const diasDelRango = (f: Pick<FiltrosDePagos, "desde" | "hasta">) => diasEntreFechas(f.desde, f.hasta) + 1;
