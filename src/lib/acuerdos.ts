import { z } from "zod";
import { pesos, type AcuerdoDePrecio } from "@/lib/planes";

/*
 * Precio acordado con una institución (reglas puras, sin base: las usan la pantalla del equipo y la acción que guarda). El rango del abono
 * depende del plan (`Planes.rangoDeAbono` / `errorDeAcuerdo`); acá viven la forma de lo que se carga y cómo se cuenta.
 */

export const MODALIDADES_DE_ACUERDO = ["abono", "total"] as const;
export type ModalidadDeAcuerdo = (typeof MODALIDADES_DE_ACUERDO)[number];

export const ETIQUETA_DE_MODALIDAD: Record<ModalidadDeAcuerdo, string> = {
  abono: "Abono acordado",
  total: "Convenio a medida",
};

/** Lo que carga el equipo desde la ficha de cobros. El monto y la modalidad se validan además contra el rango del plan (`errorDeAcuerdo`). */
export const acuerdoSchema = z.object({
  modalidad: z.enum(MODALIDADES_DE_ACUERDO, { error: "Elegí qué tipo de precio es" }),
  monto: z
    .number({ error: "Escribí el monto en pesos." })
    .int("El monto tiene que ser un número entero, sin centavos.")
    .min(1, "El monto tiene que ser mayor que cero.")
    .max(10_000_000, "Revisá el monto: es demasiado alto."),
  nota: z
    .string()
    .trim()
    .max(200, "Máximo 200 caracteres.")
    .optional()
    .transform((v) => (v ? v : undefined)),
});
export type AcuerdoCargado = z.input<typeof acuerdoSchema>;

/**
 * Lo mínimo de un acuerdo para calcular con él (`montoDePlan`): sin la nota, que es interna. Lleva el plan para el que se acordó cuando está
 * anotado (`acuerdoQueRige`: el acuerdo solo rige con ese plan).
 */
export function paraCalcular(fila: { modalidad: string; monto: number; plan?: string | null } | null | undefined): AcuerdoDePrecio | null {
  if (!fila) return null;
  if (fila.modalidad !== "abono" && fila.modalidad !== "total") return null;
  return { modalidad: fila.modalidad, monto: fila.monto, ...(fila.plan ? { plan: fila.plan } : {}) };
}

/** "Abono acordado: $ 48.000 por mes" · "Convenio a medida: $ 180.000 por mes (total, sin importar las sedes)" */
export function describirAcuerdo(a: AcuerdoDePrecio) {
  return a.modalidad === "total"
    ? `${ETIQUETA_DE_MODALIDAD.total}: ${pesos(a.monto)} por mes (total, sin importar las sedes)`
    : `${ETIQUETA_DE_MODALIDAD.abono}: ${pesos(a.monto)} por mes`;
}

/** Una línea para la auditoría: "de lista a abono acordado $ 48.000" / "de convenio $ 180.000 a lista". Solo montos, nunca la nota. */
export function describirCambioDeAcuerdo(antes: AcuerdoDePrecio | null, despues: AcuerdoDePrecio | null) {
  const cual = (a: AcuerdoDePrecio | null) => (a ? `${a.modalidad === "total" ? "convenio" : "abono acordado"} ${pesos(a.monto)}` : "precio de lista");
  return `${cual(antes)} → ${cual(despues)}`;
}
