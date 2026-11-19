import { z } from "zod";
import { etiquetaPeriodo } from "@/lib/cobros";
import { pesos, type AcuerdoDePrecio } from "@/lib/planes";

/*
 * Precio acordado con una institución (reglas puras, sin base: las usan la pantalla del equipo y la acción que guarda). El tope del abono
 * es el precio de lista del plan (`Planes.rangoDeAbono` / `errorDeAcuerdo`; no hay mínimo y el monto puede ser 0 = «sin cargo»); un convenio a medida
 * acepta cualquier monto. Un acuerdo puede tener un fin (`hasta`, el último mes en que rige): acá viven la forma de lo que se carga, cuándo vence y
 * cómo se cuenta.
 */

export const MODALIDADES_DE_ACUERDO = ["abono", "total"] as const;
export type ModalidadDeAcuerdo = (typeof MODALIDADES_DE_ACUERDO)[number];

export const ETIQUETA_DE_MODALIDAD: Record<ModalidadDeAcuerdo, string> = {
  abono: "Abono acordado",
  total: "Convenio a medida",
};

/** El último mes en que rige un acuerdo: «2026-12» (inclusive). */
const mesDeFin = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Elegí un mes de la lista.");

/** Lo que carga el equipo desde la ficha de cobros. El monto y la modalidad se validan además contra el precio de lista del plan (`errorDeAcuerdo`). */
export const acuerdoSchema = z.object({
  modalidad: z.enum(MODALIDADES_DE_ACUERDO, { error: "Elegí qué tipo de precio es" }),
  monto: z
    .number({ error: "Escribí el monto en pesos." })
    .int("El monto tiene que ser un número entero, sin centavos.")
    .min(0, "El monto no puede ser negativo.")
    .max(10_000_000, "Revisá el monto: es demasiado alto."),
  /** Hasta qué mes rige; vacío o ausente = sin fecha de fin. */
  hasta: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : undefined))
    .pipe(mesDeFin.optional()),
  nota: z
    .string()
    .trim()
    .max(200, "Máximo 200 caracteres.")
    .optional()
    .transform((v) => (v ? v : undefined)),
});
export type AcuerdoCargado = z.input<typeof acuerdoSchema>;

/** ¿Rige el acuerdo en este período ("2026-11")? Sin fecha de fin rige siempre; con una, hasta ese mes inclusive. */
export const acuerdoRigeEn = (hasta: string | null | undefined, periodo: string) => !hasta || periodo <= hasta;

/** Por qué un fin de acuerdo no se puede guardar (null si está bien): no puede ser un mes que ya pasó. */
export function errorDeHasta(hasta: string | null | undefined, periodoDeHoy: string): string | null {
  if (!hasta) return null;
  return hasta < periodoDeHoy ? `${etiquetaPeriodo(hasta)} ya pasó: elegí este mes o uno posterior.` : null;
}

/**
 * Lo mínimo de un acuerdo para calcular con él (`montoDePlan`): sin la nota, que es interna. Lleva el plan para el que se acordó cuando está
 * anotado (`acuerdoQueRige`: el acuerdo solo rige con ese plan) y hasta cuándo rige. Con `periodo`, un acuerdo que ya terminó (su fin es anterior)
 * deja de contar: es null y la institución vuelve al precio de lista.
 */
export function paraCalcular(
  fila: { modalidad: string; monto: number; plan?: string | null; hasta?: string | null } | null | undefined,
  periodo?: string,
): AcuerdoDePrecio | null {
  if (!fila) return null;
  if (fila.modalidad !== "abono" && fila.modalidad !== "total") return null;
  if (periodo && !acuerdoRigeEn(fila.hasta, periodo)) return null;
  return { modalidad: fila.modalidad, monto: fila.monto, ...(fila.plan ? { plan: fila.plan } : {}), ...(fila.hasta ? { hasta: fila.hasta } : {}) };
}

/** «hasta diciembre 2026», o «» si no tiene fin. */
export const textoDeFin = (hasta: string | null | undefined) => (hasta ? `hasta ${etiquetaPeriodo(hasta).toLowerCase()}` : "");

/** "Abono acordado: $ 48.000 por mes" · "Convenio a medida: $ 180.000 por mes (total, sin importar las sedes)" · "Sin cargo hasta diciembre 2026" */
export function describirAcuerdo(a: AcuerdoDePrecio) {
  const fin = textoDeFin(a.hasta);
  if (a.monto === 0) return `Sin cargo${fin ? ` ${fin}` : ""}`;
  const base =
    a.modalidad === "total"
      ? `${ETIQUETA_DE_MODALIDAD.total}: ${pesos(a.monto)} por mes (total, sin importar las sedes)`
      : `${ETIQUETA_DE_MODALIDAD.abono}: ${pesos(a.monto)} por mes`;
  return fin ? `${base}, ${fin}` : base;
}

/** Una línea para la auditoría: "de lista a abono acordado $ 48.000" / "de convenio $ 180.000 a lista". Solo montos, nunca la nota. */
export function describirCambioDeAcuerdo(antes: AcuerdoDePrecio | null, despues: AcuerdoDePrecio | null) {
  const cual = (a: AcuerdoDePrecio | null) => {
    if (!a) return "precio de lista";
    const fin = textoDeFin(a.hasta);
    const cuerpo = a.monto === 0 ? "sin cargo" : `${a.modalidad === "total" ? "convenio" : "abono acordado"} ${pesos(a.monto)}`;
    return fin ? `${cuerpo} ${fin}` : cuerpo;
  };
  return `${cual(antes)} → ${cual(despues)}`;
}

/** Lo que se le responde al equipo cuando intenta cobrar o facturar a una institución que hoy no paga nada. */
export const SIN_CARGO_NO_SE_COBRA =
  "Esta institución no tiene cargo por ahora (su precio acordado es $0): no hay nada que facturar ni cobrar. Si hay que cobrarle, cambiá su precio en «Precio» de esta ficha.";
