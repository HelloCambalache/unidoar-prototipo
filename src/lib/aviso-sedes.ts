import { etiquetaPeriodo, sumarMeses } from "@/lib/cobros";
import { pesos, type AcuerdoDePrecio, type Planes } from "@/lib/planes";

/*
 * El cartel de la pantalla «Sedes» de una institución: cuánto suma agregar una sede, según su plan y su precio acordado. Se avisa ahí, antes
 * de agregarla, y no recién en la factura. Código puro (sin base ni Next): lo arma la página con lo que ya leyó y lo prueban las pruebas.
 */

/**
 * El texto del cartel, o null si no hay nada que avisar.
 *  - Búsqueda puntual: no tiene abono, así que sumar sedes no cuesta; eso sí, cada búsqueda se publica en una sola sede.
 *  - Convenio a medida (monto fijo): sumar sedes no cambia lo que paga.
 *  - Plan por sede (Multisede): cada sede paga el precio entero.
 *  - Los demás: cada sede adicional paga el abono (el de lista o el acordado) con el descuento de Planes. Desde `sedesMultisede` sedes el valor
 *    se acuerda con el equipo (plan Multisede). Con un semestre pago que cubre meses por delante, la sede nueva se suma recién cuando termina.
 * `semestrePagoHasta` es el último mes cubierto por un semestre pago ("2027-03") si cubre meses posteriores al actual; null si no.
 */
export function avisoDeSedes(e: { plan: string; acuerdo: AcuerdoDePrecio | null; P: Planes; semestrePagoHasta: string | null }): string | null {
  const { plan, acuerdo, P, semestrePagoHasta } = e;
  const { descuentoSedeExtra, sedesMultisede } = P.condiciones;

  if (P.esPuntual(plan)) {
    return "Tu plan es de búsqueda puntual: no tiene abono, así que sumar sedes no cambia lo que pagás. Cada búsqueda se publica en una sola sede.";
  }
  if (acuerdo?.modalidad === "total") return "Tu convenio con UNIDOAR es un monto fijo por mes: sumar sedes no cambia lo que pagás.";
  if (P.planDe(plan).porSede) return `Tu plan cobra cada sede: ${pesos(P.precioDeSedeExtra(plan, acuerdo))} por mes por sede, desde la próxima factura.`;
  if (descuentoSedeExtra >= 100) return "Las sedes adicionales no tienen costo: sumarlas no cambia lo que pagás.";

  const cuando = semestrePagoHasta
    ? `Tu semestre pago cubre hasta ${etiquetaPeriodo(semestrePagoHasta).toLowerCase()}: la sede nueva se suma a tu abono desde la factura de ${etiquetaPeriodo(sumarMeses(semestrePagoHasta, 1)).toLowerCase()}.`
    : "Se cobra desde la próxima factura.";
  const descuento = descuentoSedeExtra > 0 ? ` (${descuentoSedeExtra} % menos que la primera)` : "";
  return `Cada sede adicional se suma a tu abono: ${pesos(P.precioDeSedeExtra(plan, acuerdo))} por mes${descuento}. ${cuando} Desde ${sedesMultisede} sedes el valor se acuerda con el equipo (plan Multisede).`;
}
