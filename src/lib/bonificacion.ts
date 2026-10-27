/*
 * Meses bonificados por recomendar. Cuando una institución recomendada paga su primera factura, el equipo aplica el beneficio a quien la recomendó:
 * cada recomendación suma **meses bonificados** (1 de lanzamiento, editable en Planes): una fila anotada (`meses_bonificados`) que queda guardada
 * hasta que se gasta.
 *
 * Regla del cliente (2026-10-27): como máximo **1 mes bonificado por semestre**. Lo que sobra no se pierde: queda guardado y se gasta de a uno,
 * en los semestres siguientes (`puedeBonificarPeriodo`: nunca dos meses bonificados con menos de 6 meses de distancia). Cómo se gasta:
 *
 *  - Paga mes a mes sin débito automático: el cron no crea la factura de ese mes (no se cobra, no hay recordatorios) y anota qué mes fue.
 *  - Paga mes a mes con débito automático autorizado: Mercado Pago cobra igual (cambiar el monto o pausar es riesgoso: una suba puede pedirle a
 *    la persona que apruebe de nuevo). El mes queda anotado con ese cobro y el equipo lo **devuelve a mano** desde Mercado Pago y lo marca.
 *  - Paga el semestre de contado: al registrarlo se gasta un mes bonificado y paga un mes menos (`pack.mesesConReferido` de Planes en lugar de
 *    `mesesQueSePagan`); el mes queda anotado como el último del semestre.
 *
 * Código puro (sin base ni Next): lo usan el cron, las acciones, las pantallas y las pruebas.
 */

/**
 * Cómo se aplicó el beneficio de una recomendación. Hoy siempre es `meses` (créditos que se gastan según la regla de arriba); `pack` es lo de
 * antes (un pack por adelantado cargado a mano, sin saldo) y solo queda para leer lo ya aplicado.
 */
export const TIPOS_DE_BENEFICIO = ["pack", "meses"] as const;
export type TipoDeBeneficio = (typeof TIPOS_DE_BENEFICIO)[number];

/** Distancia mínima, en meses, entre dos meses bonificados por recomendar: uno por semestre. */
export const MESES_ENTRE_BONIFICACIONES = 6;

/** Cuántos meses hay de un período ("2026-11") a otro: positivo si `hasta` es posterior. */
export function mesesEntre(desde: string, hasta: string): number {
  const valor = (p: string) => Number(p.slice(0, 4)) * 12 + Number(p.slice(5, 7)) - 1;
  return valor(hasta) - valor(desde);
}

/**
 * ¿Se puede bonificar `periodo`? Solo si ningún otro mes bonificado queda a menos de 6 meses de distancia, antes o después: así nunca hay dos en
 * el mismo semestre. `yaBonificados` son los períodos que ya quedaron bonificados (el mismo `periodo` no cuenta: es el que se está resolviendo).
 */
export function puedeBonificarPeriodo(periodo: string, yaBonificados: readonly string[]): boolean {
  return yaBonificados.every((p) => p === periodo || Math.abs(mesesEntre(p, periodo)) >= MESES_ENTRE_BONIFICACIONES);
}

/** Lo que se le explica a la institución sobre el tope: se usa de a uno por semestre y lo que sobra queda guardado. */
export const TEXTO_DEL_TOPE = "Se usa 1 mes bonificado por semestre como máximo: los demás quedan guardados para los semestres siguientes.";

/** Máximo de meses que se pueden bonificar por una recomendación (el valor de Planes y lo que acepta la acción). */
export const MAX_MESES_BONIFICADOS = 12;

/** "1 mes" · "2 meses" */
export const mesesTexto = (n: number) => `${n} ${n === 1 ? "mes" : "meses"}`;

/** "1 mes bonificado" · "2 meses bonificados" */
export const mesesBonificadosTexto = (n: number) => `${mesesTexto(n)} ${n === 1 ? "bonificado" : "bonificados"}`;

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

/** De los meses bonificados de una institución, lo que necesita saber la pantalla del semestre al contado: cuántos tiene sin gastar y cuáles gastó. */
export function bonificacionParaSemestre(meses: readonly { estado: EstadoDeMes; periodo: string | null }[]) {
  return {
    disponibles: meses.filter((m) => m.estado === "disponible").length,
    usados: meses.flatMap((m) => (m.periodo ? [m.periodo] : [])),
  };
}

/**
 * Cómo se gasta un mes bonificado cuando llega el cobro del débito automático de `periodo`. Si el mes ya estaba anotado como bonificado
 * sin cobro (el cron lo bonificó antes de que se activara el débito), ahora tiene un cobro que devolver: se le agrega. Si ya tenía el cobro,
 * no hay nada que hacer. Si no estaba anotado, se toma uno disponible (si hay).
 */
export type GastoDelCobro = "agregar-cobro" | "ya-estaba" | "tomar-disponible" | "ninguno";

export function gastoDelCobro(e: {
  mesAnotado: { cobroId: string | null } | null;
  disponibles: number;
  /** El tope de 1 por semestre permite bonificar este mes (`puedeBonificarPeriodo`); sin dato, sí. Solo cuenta para tomar uno nuevo. */
  permitido?: boolean;
}): GastoDelCobro {
  if (e.mesAnotado) return e.mesAnotado.cobroId ? "ya-estaba" : "agregar-cobro";
  return e.disponibles > 0 && (e.permitido ?? true) ? "tomar-disponible" : "ninguno";
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
/**
 * Lo que se le dice a quien va a registrar un pago que cae en un mes bonificado por recomendar (la institución no lo paga): hay que confirmarlo,
 * y el mes bonificado vuelve a quedar disponible para otro mes. `meses` son las etiquetas ya escritas ("noviembre 2026").
 */
export function avisoDeCobroEnMesBonificado(meses: readonly string[], contexto: "pago" | "semestre"): string {
  const uno = meses.length === 1;
  const lista = meses.join(", ");
  const es = uno ? "es un mes bonificado" : "son meses bonificados";
  const vuelve = uno ? "el mes bonificado vuelve a quedar disponible" : "los meses bonificados vuelven a quedar disponibles";
  return contexto === "pago"
    ? `${lista} ${es} por recomendar: la institución no ${uno ? "lo paga" : "los paga"}. Si igual lo cobraste, confirmalo: ${vuelve} para otro mes.`
    : `${lista} ${es} por recomendar y el semestre ${uno ? "lo cubre" : "los cubre"}. Si igual lo registrás, confirmalo: ${vuelve} para otros meses.`;
}

export const textoDeMesBonificado =(e: { periodo: string; recomendada: string | null; conDebito: boolean; montoTexto?: string }) =>
  e.conDebito
    ? `el débito automático de ${e.periodo}${e.montoTexto ? ` (${e.montoTexto})` : ""} está bonificado${e.recomendada ? ` por recomendar a ${e.recomendada}` : ""}: te devolvemos lo cobrado a tu medio de pago en Mercado Pago.`
    : `${e.periodo} está bonificado${e.recomendada ? ` por recomendar a ${e.recomendada}` : ""}: no se te factura ese mes.`;
