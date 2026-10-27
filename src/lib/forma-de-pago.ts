import { pesos, type Planes, type PlanClave } from "@/lib/planes";

/*
 * Cómo prefiere pagar el abono una institución: mes a mes o el semestre por adelantado (pagás 5 meses y usás 6; los valores salen de Planes).
 * Es una preferencia que la institución elige al crear la cuenta o desde Plan y facturación: no cobra nada, el equipo registra el semestre cuando
 * llega el pago (ver «Semestre al contado» en CLAUDE.md). Código puro (sin base ni Next): lo usan las acciones, las pantallas y las pruebas.
 */

export const FORMAS_DE_PAGO = ["mensual", "semestral"] as const;
export type FormaDePago = (typeof FORMAS_DE_PAGO)[number];

/** Lo que se guarda en `formas_de_pago.forma`: solo se anota el semestre (sin fila, es mensual). */
export const esFormaDePago = (v: unknown): v is FormaDePago => typeof v === "string" && (FORMAS_DE_PAGO as readonly string[]).includes(v);

/**
 * ¿Puede una institución con este plan pedir pagar el semestre? Solo con un abono mensual: la búsqueda puntual se paga por búsqueda y un
 * convenio de Multisede lo acuerda el equipo (no hay un precio de lista del que bonificar un mes).
 */
export function puedePagarSemestre(P: Planes, plan: string): boolean {
  return P.planDe(plan).periodo === "mes" && !P.esPuntual(plan) && !P.planDe(plan).porSede;
}

/** Cuánto sale el semestre de una institución y cómo se compone, para mostrárselo (con sus sedes y su precio acordado, si lo tiene). */
export function resumenDeSemestre(P: Planes, plan: PlanClave, sedes: number, acuerdo?: Parameters<Planes["montoDePlan"]>[2]) {
  const { meses, mesesQueSePagan } = P.condiciones.pack;
  const mensual = P.montoDePlan(plan, sedes, acuerdo);
  return {
    meses,
    mesesQueSePagan,
    mensual,
    total: mensual * mesesQueSePagan,
    ahorro: mensual * (meses - mesesQueSePagan),
  };
}

/** "Pagás 5 meses y usás 6: $250.000 en lugar de $300.000." */
export function textoDeSemestre(r: ReturnType<typeof resumenDeSemestre>): string {
  return `Pagás ${r.mesesQueSePagan} meses y usás ${r.meses}: ${pesos(r.total)} en lugar de ${pesos(r.mensual * r.meses)}.`;
}

/** Lo que ve el equipo en la campanita cuando una institución elige o pide pagar el semestre. */
export function avisoAlEquipoDeSemestre(e: { alCrearLaCuenta: boolean; total: number; meses: number }): string {
  return e.alCrearLaCuenta
    ? `eligió pagar el abono por semestre al crear su cuenta (${pesos(e.total)} por ${e.meses} meses). Cuando verifiques la cuenta, coordiná el pago y registralo en su ficha de cobros.`
    : `pidió pagar el abono por semestre (${pesos(e.total)} por ${e.meses} meses). Coordiná el pago con la institución y registralo en su ficha de cobros.`;
}
