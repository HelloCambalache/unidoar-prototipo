/*
 * Meses bonificados por recomendar (opción B del esquema comercial: «pagando mes a mes, N meses bonificados por institución recomendada»).
 * Cuando una institución recomendada paga su primera factura, el equipo puede aplicar el beneficio de dos maneras: el pack por adelantado
 * (paga menos meses del semestre, se carga al facturar) o, para quien paga mes a mes, **meses bonificados**: cada uno es una fila anotada
 * (`meses_bonificados`) que se gasta en la próxima factura que se genere.
 *
 *  - Sin débito automático: el cron no crea la factura de un mes bonificado (no se cobra, no hay recordatorios) y anota qué mes fue.
 *  - Con débito automático autorizado: Mercado Pago cobra igual (cambiar el monto o pausar es riesgoso: una suba puede pedirle a la persona
 *    que apruebe de nuevo). El mes queda anotado con ese cobro y el equipo lo **devuelve a mano** desde Mercado Pago y lo marca.
 *
 * Código puro (sin base ni Next): lo usan el cron, las acciones, las pantallas y las pruebas.
 */

/** Cómo se aplicó el beneficio de una recomendación: pack por adelantado (se carga al facturar) o meses bonificados (se descuentan solos). */
export const TIPOS_DE_BENEFICIO = ["pack", "meses"] as const;
export type TipoDeBeneficio = (typeof TIPOS_DE_BENEFICIO)[number];

/** Máximo de meses que se pueden bonificar por una recomendación (el valor de Planes y lo que acepta la acción). */
export const MAX_MESES_BONIFICADOS = 12;

/** "1 mes" · "2 meses" */
export const mesesTexto = (n: number) => `${n} ${n === 1 ? "mes" : "meses"}`;

/** "1 mes bonificado" · "2 meses bonificados" */
export const mesesBonificadosTexto = (n: number) => `${mesesTexto(n)} ${n === 1 ? "bonificado" : "bonificados"}`;

/**
 * ¿Se le pueden bonificar meses a una institución con este plan? Solo a quien paga mes a mes: la búsqueda puntual no tiene una mensualidad
 * de la que descontar (a esa se le aplica el beneficio como pack por adelantado, a mano). `esPuntual` sale de `Planes.esPuntual(plan)`.
 */
export const puedeBonificarMeses = (esPuntual: boolean) => !esPuntual;

/** En qué está un mes bonificado, para mostrarlo. */
export type EstadoDeMes = "disponible" | "usado" | "a-devolver" | "devuelto";

export const ETIQUETA_DE_MES: Record<EstadoDeMes, string> = {
  disponible: "Disponible",
  usado: "Bonificado",
  "a-devolver": "Devolución en curso",
  devuelto: "Devuelto",
};

/**
 * Un mes bonificado sin usar está disponible; uno usado sin cobro (no se facturó) quedó bonificado; uno usado sobre un débito automático ya
 * cobrado tiene que devolverse, y pasa a devuelto cuando el equipo lo marca.
 */
export function estadoDeMes(m: { periodo: string | null; cobroId: string | null; devueltoEn: Date | string | null | undefined }): EstadoDeMes {
  if (!m.periodo) return "disponible";
  if (!m.cobroId) return "usado";
  return m.devueltoEn ? "devuelto" : "a-devolver";
}

/** Cuántos hay en cada estado (de meses que ya traen su `estado`, ver `estadoDeMes`). */
export function resumenDeMeses(meses: readonly { estado: EstadoDeMes }[]) {
  const cuenta = (e: EstadoDeMes) => meses.filter((m) => m.estado === e).length;
  return {
    total: meses.length,
    disponibles: cuenta("disponible"),
    usados: cuenta("usado") + cuenta("a-devolver") + cuenta("devuelto"),
    aDevolver: cuenta("a-devolver"),
    devueltos: cuenta("devuelto"),
  };
}

/**
 * Cómo se gasta un mes bonificado cuando llega el cobro del débito automático de `periodo`. Si el mes ya estaba anotado como bonificado
 * sin cobro (el cron lo bonificó antes de que se activara el débito), ahora tiene un cobro que devolver: se le agrega. Si ya tenía el cobro,
 * no hay nada que hacer. Si no estaba anotado, se toma uno disponible (si hay).
 */
export type GastoDelCobro = "agregar-cobro" | "ya-estaba" | "tomar-disponible" | "ninguno";

export function gastoDelCobro(e: { mesAnotado: { cobroId: string | null } | null; disponibles: number }): GastoDelCobro {
  if (e.mesAnotado) return e.mesAnotado.cobroId ? "ya-estaba" : "agregar-cobro";
  return e.disponibles > 0 ? "tomar-disponible" : "ninguno";
}

/** Lo que el equipo ve al aplicar el beneficio: cuántos meses y cómo. */
export function textoDeBeneficioAplicado(e: { tipo: TipoDeBeneficio | null; meses: number }) {
  return e.tipo === "meses" ? mesesBonificadosTexto(e.meses) : "Pack por adelantado";
}

/** Por qué no se puede deshacer un beneficio de meses bonificados (o null si se puede): ya se gastó alguno. */
export function motivoParaNoDeshacer(mesesUsados: number): string | null {
  return mesesUsados > 0
    ? `Ya se ${mesesUsados === 1 ? "usó 1 de los meses bonificados" : `usaron ${mesesUsados} de los meses bonificados`}: no se puede deshacer.`
    : null;
}

/** Los textos de la campanita de la institución cuando se gasta un mes (`periodo` ya escrito, por ejemplo «Noviembre 2026»). */
export const textoDeMesBonificado = (e: { periodo: string; recomendada: string | null; conDebito: boolean; montoTexto?: string }) =>
  e.conDebito
    ? `el débito automático de ${e.periodo}${e.montoTexto ? ` (${e.montoTexto})` : ""} está bonificado${e.recomendada ? ` por recomendar a ${e.recomendada}` : ""}: te devolvemos lo cobrado a tu medio de pago en Mercado Pago.`
    : `${e.periodo} está bonificado${e.recomendada ? ` por recomendar a ${e.recomendada}` : ""}: no se te factura ese mes.`;
