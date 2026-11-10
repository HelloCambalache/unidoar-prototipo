/*
 * Cómo paga una institución: con Mercado Pago o por transferencia o efectivo (pedido de Flor, 2026-11-10).
 *
 * Regla: **todas pagan con Mercado Pago, salvo las que el equipo habilita a pagar por transferencia o efectivo** (desde la ficha de la institución,
 * tabla `habilitaciones_pago_manual`). Lo que cambia es **lo que VE la institución** (su popup de pago, sus carteles, Plan y facturación, las
 * instrucciones de cómo pagar); el equipo puede seguir registrando un pago manual a cualquiera si hace falta (decisión de Flor).
 *
 * Tres casos (`FormaDeCobro`):
 *  - `solo-mercadopago`: Mercado Pago está disponible para esta institución, no está habilitada y su plan se puede pagar así.
 *  - `las-dos`: igual, pero el equipo la habilitó: puede pagar con Mercado Pago o por transferencia o efectivo.
 *  - `manual`: como hasta ahora (transferencia o efectivo, lo registra el equipo). Es lo que pasa **mientras Mercado Pago no esté disponible PARA ELLA**
 *    (sin token; o con un token de PRUEBA si se prendió la protección `MP_PRUEBA_SOLO_EJEMPLO` y es una institución real: ver `debitoDisponiblePara`; sin
 *    esto nadie podría pagar) y con los planes que no tienen camino por Mercado Pago: la búsqueda puntual (se paga cada búsqueda, no hay cobro en línea)
 *    y Multisede sin convenio (no tiene un monto que cobrar).
 *
 * Código puro (sin base ni Next) para poder cuidarlo con una prueba. La lectura de la habilitación y de si Mercado Pago está disponible vive en
 * `src/lib/queries/pago-manual.ts`.
 */

export type FormaDeCobro = "solo-mercadopago" | "las-dos" | "manual";

export function formaDeCobroDe(e: {
  /** El equipo la habilitó a pagar por transferencia o efectivo. */
  habilitadaManual: boolean;
  /** Mercado Pago está disponible PARA ELLA (token cargado; con uno de prueba, también las reales salvo la protección `MP_PRUEBA_SOLO_EJEMPLO`): `debitoDisponiblePara`. */
  mercadoPagoDisponible: boolean;
  /** Su plan es la búsqueda puntual: no hay abono que debitar ni cobro en línea. */
  esPuntual: boolean;
  /** Su plan tiene un monto mensual que cobrar (Multisede sin convenio no lo tiene). */
  precioDefinido: boolean;
}): FormaDeCobro {
  if (!e.mercadoPagoDisponible || e.esPuntual || !e.precioDefinido) return "manual";
  return e.habilitadaManual ? "las-dos" : "solo-mercadopago";
}

/** ¿Puede la institución pagar por transferencia o efectivo? (todo menos «solo Mercado Pago»). */
export const puedePagarEnMano = (forma: FormaDeCobro) => forma !== "solo-mercadopago";

/** ¿Se le ofrece pagar con Mercado Pago? (todo menos «manual»). */
export const puedePagarConMercadoPago = (forma: FormaDeCobro) => forma !== "manual";

/** La frase para quien no sabe más que lo que hay que hacer, ante un plan sin pagar o con una factura vencida. */
export const PASO_MERCADO_PAGO = "Entrá a Plan y facturación y pagá con Mercado Pago: activá el débito automático mensual o, si preferís, pagá el semestre por adelantado.";
export const PASO_EN_MANO = "Escribinos por WhatsApp o desde Contacto y coordinamos el pago por transferencia o en efectivo.";

/** Cómo pagar, en orden, para un plan que todavía no tiene su primer pago (el popup y el cartel). */
export function pasosParaActivar(forma: FormaDeCobro): string[] {
  if (forma === "solo-mercadopago") {
    return [PASO_MERCADO_PAGO, "Apenas se acredite el pago, tu plan queda activo y se habilita todo: no tenés que hacer nada más."];
  }
  if (forma === "las-dos") {
    return [
      "Pagá con Mercado Pago desde Plan y facturación (débito automático mensual o el semestre por adelantado) o, si preferís transferencia o efectivo, escribinos y lo coordinamos.",
      "Apenas se acredite el pago, tu plan queda activo y se habilita todo: no tenés que hacer nada más.",
    ];
  }
  return [PASO_EN_MANO, "Apenas registremos el pago, tu plan queda activo y se habilita todo: no tenés que hacer nada más."];
}

/** Cómo pagar, en orden, para levantar la limitación de una factura vencida. */
export function pasosParaLevantarLaMora(forma: FormaDeCobro): string[] {
  const cierre = "Apenas se acredite el pago, la limitación se levanta sola: no tenés que hacer nada más.";
  if (forma === "solo-mercadopago") {
    return ["Pagá con Mercado Pago desde Plan y facturación. Si no te alcanza con eso para ponerte al día, escribinos y lo resolvemos.", cierre];
  }
  if (forma === "las-dos") {
    return ["Pagá con Mercado Pago desde Plan y facturación o, si preferís transferencia o efectivo, escribinos y lo coordinamos.", cierre];
  }
  return ["Pagá la factura vencida por transferencia o en efectivo: el detalle está en Plan y facturación. Si necesitás coordinarlo, escribinos.", cierre];
}

/** La frase del cartel de una cuenta nueva sin pago, según cómo paga. */
export function fraseDelCartelSinPago(forma: FormaDeCobro, queSeLimita: string): string {
  if (forma === "solo-mercadopago") {
    return `Hasta que se acredite tu primer pago no podés ${queSeLimita}. Pagá con Mercado Pago desde Plan y facturación: apenas se acredite se habilita todo.`;
  }
  if (forma === "las-dos") {
    return `Hasta que se acredite tu primer pago no podés ${queSeLimita}. Pagá con Mercado Pago desde Plan y facturación o escribinos para coordinar transferencia o efectivo: apenas se acredite se habilita todo.`;
  }
  return `Hasta que registremos tu primer pago no podés ${queSeLimita}. Escribinos y coordinamos el pago por transferencia o en efectivo: apenas lo registremos se habilita todo.`;
}

/**
 * Lo que dice Plan y facturación arriba de todo sobre cómo paga la institución (null si no hay nada que aclarar: es el caso `manual`, que se ve como
 * siempre).
 */
export function avisoDeFormaDePago(forma: FormaDeCobro): { titulo: string; texto: string } | null {
  if (forma === "solo-mercadopago") {
    return {
      titulo: "Tu institución paga con Mercado Pago",
      texto:
        "Activá el débito automático mensual o pagá el semestre por adelantado: Mercado Pago cobra en tu tarjeta y nosotros nunca la vemos ni la guardamos. Cada pago acreditado queda registrado solo en tus facturas.",
    };
  }
  if (forma === "las-dos") {
    return {
      titulo: "Podés pagar con Mercado Pago o por transferencia o efectivo",
      texto:
        "El equipo habilitó a tu institución a pagar también por transferencia o en efectivo: si preferís esa forma, escribinos desde Contacto y coordinamos el pago (lo registramos nosotros). Con Mercado Pago el pago queda registrado solo.",
    };
  }
  return null;
}

/** Lo que dice la ficha del equipo: cómo paga hoy esta institución, y por qué. */
export function resumenParaElEquipo(forma: FormaDeCobro, habilitadaManual: boolean): string {
  if (forma === "solo-mercadopago") return "Paga con Mercado Pago: la institución no ve la opción de transferencia o efectivo.";
  if (forma === "las-dos") return "Habilitada: puede pagar con Mercado Pago o por transferencia o efectivo.";
  return habilitadaManual
    ? "Habilitada para transferencia o efectivo. Hoy esto no cambia nada (Mercado Pago no está disponible para ella o su plan no se paga así); cuando lo esté, podrá usar las dos formas."
    : "Hoy paga como siempre (transferencia o efectivo, lo registra el equipo): Mercado Pago no está disponible para ella o su plan no se paga así. Cuando Mercado Pago esté disponible, pasará a pagar con Mercado Pago salvo que la habilites.";
}
