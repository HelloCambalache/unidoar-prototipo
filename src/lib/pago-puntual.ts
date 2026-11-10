import { decidirPagoDeSemestre, type DecisionDelPago, type PagoLeido } from "@/lib/pago-semestre";

/*
 * Pago de UNA búsqueda puntual por Mercado Pago (el plan sin abono; pedido del cliente, 2026-11-10): un pago único con Checkout Pro, igual que el del
 * semestre por adelantado (ver src/lib/pago-semestre.ts: las reglas del pago —qué estado es cada uno, cuándo se acepta, cómo vuelve la persona— son las
 * mismas y se reusan). La institución toca «Pagar una búsqueda», el servidor calcula el monto (el precio del plan de búsqueda puntual o el acordado con
 * la institución; nunca viene del navegador) y le arma el link; cuando Mercado Pago avisa que se aprobó, queda UNA búsqueda pagada y disponible
 * (`creditos_busqueda`), igual que cuando la registra el equipo. Código puro, sin base ni red.
 */

/** El medio que queda anotado en la búsqueda pagada. */
export const MEDIO_DE_PAGO_PUNTUAL = "Mercado Pago";

/** El parámetro que agregan a Plan y facturación las direcciones de vuelta de Mercado Pago (el del semestre es `pago_semestre`). */
export const PARAMETRO_DE_VUELTA_PUNTUAL = "pago_puntual";

/** "UNIDOAR · Búsqueda puntual · una búsqueda": lo que ve la persona en Mercado Pago. */
export const tituloDelPagoPuntual = (plan: string) => `UNIDOAR · ${plan} · una búsqueda`;

/** Qué hacer con un pago de Mercado Pago de un intento de búsqueda puntual: las mismas reglas que el semestre (monto exacto, en pesos, aprobado). */
export const decidirPagoDePuntual = (e: Parameters<typeof decidirPagoDeSemestre>[0]): DecisionDelPago => decidirPagoDeSemestre(e, "una búsqueda puntual");

/**
 * ¿Se puede ofrecer pagar una búsqueda por Mercado Pago ahora? Devuelve el motivo si no (null si sí). Solo vale para el plan de búsqueda puntual con su
 * precio definido, y no mientras haya una búsqueda ya pagada sin publicar (para no pagar dos veces por error: primero se publica la que ya está paga).
 */
export function motivoParaNoOfrecerPagoPuntual(e: { esPuntual: boolean; precioDefinido: boolean; disponibles: number }): string | null {
  if (!e.esPuntual) return "El pago de una búsqueda por Mercado Pago es para el plan de búsqueda puntual.";
  if (!e.precioDefinido) return "Tu plan se acuerda con el equipo: escribinos desde Contacto para coordinar el pago.";
  if (e.disponibles > 0) return "Ya tenés una búsqueda pagada sin publicar: publicala primero y después podés abonar otra.";
  return null;
}

export type { PagoLeido };
