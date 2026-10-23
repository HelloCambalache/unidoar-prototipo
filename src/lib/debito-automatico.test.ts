import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  accionSobreLaFactura,
  cuerpoDeNuevoMonto,
  cuerpoDePlan,
  decidirActivacion,
  decidirAltaDeSuscripcion,
  decidirSincronizacion,
  detalleDeRechazo,
  diaDeCobroDelDebito,
  esPlanDebitable,
  esUrlDeMercadoPago,
  estadoDeSuscripcion,
  estadoGuardado,
  leerCobro,
  montoCobrable,
  motivoDeSuscripcion,
  primerCobroDiferido,
  puedeReutilizarPlan,
  suscripcionVigente,
} from "@/lib/debito-automatico";

describe("primer cobro de un débito cuando el mes ya está pago", () => {
  it("si el mes en curso no está pago no hay prueba: el primer cobro sale al suscribirse y paga ese mes", () => {
    assert.equal(primerCobroDiferido({ hoy: "2026-10-20", diaDeCobro: 20, mesActualPago: false }), null);
  });

  it("si el mes ya está pago, el primer cobro es el día de cobro del mes que viene", () => {
    assert.deepEqual(primerCobroDiferido({ hoy: "2026-10-20", diaDeCobro: 20, mesActualPago: true }), { dias: 31, fecha: "2026-11-20" });
    // Sin día de cobro cargado, el 10.
    assert.deepEqual(primerCobroDiferido({ hoy: "2026-10-31", diaDeCobro: null, mesActualPago: true }), { dias: 10, fecha: "2026-11-10" });
  });

  it("atraviesa el fin de año y los meses cortos", () => {
    assert.deepEqual(primerCobroDiferido({ hoy: "2026-12-15", diaDeCobro: 10, mesActualPago: true }), { dias: 26, fecha: "2027-01-10" });
    // Un día de cobro 31 cae el último día de un mes corto.
    assert.deepEqual(primerCobroDiferido({ hoy: "2027-01-31", diaDeCobro: 31, mesActualPago: true }), { dias: 28, fecha: "2027-02-28" });
  });

  it("nunca difiere más de dos meses ni devuelve días que no sean positivos", () => {
    for (const hoy of ["2026-10-01", "2026-12-31", "2027-02-28"]) {
      for (const dia of [1, 10, 20, 28, 31, null]) {
        const r = primerCobroDiferido({ hoy, diaDeCobro: dia, mesActualPago: true });
        assert.ok(r === null || (r.dias > 0 && r.dias <= 62), `${hoy} día ${dia}`);
        assert.ok(r !== null, `${hoy} día ${dia}: siempre hay un próximo cobro del mes que viene`);
      }
    }
  });
});

describe("qué hacer al activar el débito", () => {
  const base = { hoy: "2026-10-20", diaDeCobro: 20, mesActualPago: true, diferirActivo: false, esDemo: false };

  it("con el mes sin pagar se activa ya, sea cual sea el interruptor", () => {
    for (const diferirActivo of [false, true]) {
      for (const esDemo of [false, true]) {
        assert.deepEqual(decidirActivacion({ ...base, mesActualPago: false, diferirActivo, esDemo }), { accion: "ahora" });
      }
    }
  });

  it("con el mes ya pago y el interruptor apagado, una institución real espera al mes que viene", () => {
    assert.deepEqual(decidirActivacion(base), { accion: "esperar", desde: "2026-11-01" });
    assert.deepEqual(decidirActivacion({ ...base, hoy: "2026-12-31" }), { accion: "esperar", desde: "2027-01-01" });
  });

  it("con un semestre pago por adelantado espera hasta el mes siguiente al último cubierto", () => {
    const semestre = { ...base, hoy: "2026-11-15", pagoHasta: "2027-03" };
    assert.deepEqual(decidirActivacion(semestre), { accion: "esperar", desde: "2027-04-01", hasta: "2027-03" });
    // El interruptor del período de prueba no lo salva: diferir al mes que viene seguiría cobrando meses ya pagos.
    assert.deepEqual(decidirActivacion({ ...semestre, diferirActivo: true }), { accion: "esperar", desde: "2027-04-01", hasta: "2027-03" });
    // Las de ejemplo activan igual.
    assert.deepEqual(decidirActivacion({ ...semestre, esDemo: true }), { accion: "ahora" });
  });

  it("si lo único pago es el mes en curso (pagoHasta no pasa de este mes), vale la regla de siempre", () => {
    assert.deepEqual(decidirActivacion({ ...base, pagoHasta: "2026-10" }), { accion: "esperar", desde: "2026-11-01" });
    assert.deepEqual(decidirActivacion({ ...base, pagoHasta: "2026-10", diferirActivo: true }), { accion: "con-prueba", dias: 31, fecha: "2026-11-20" });
    assert.deepEqual(decidirActivacion({ ...base, pagoHasta: null }), { accion: "esperar", desde: "2026-11-01" });
  });

  it("con el mes ya pago y el interruptor apagado, una institución de ejemplo activa igual (cobro inmediato)", () => {
    assert.deepEqual(decidirActivacion({ ...base, esDemo: true }), { accion: "ahora" });
  });

  it("con el interruptor prendido, el primer cobro se difiere al próximo día de cobro", () => {
    assert.deepEqual(decidirActivacion({ ...base, diferirActivo: true }), { accion: "con-prueba", dias: 31, fecha: "2026-11-20" });
    assert.deepEqual(decidirActivacion({ ...base, diferirActivo: true, esDemo: true }), { accion: "con-prueba", dias: 31, fecha: "2026-11-20" });
  });
});

describe("el día en que cobra el débito", () => {
  it("es el día en que se suscribió, en hora de Argentina", () => {
    assert.equal(diaDeCobroDelDebito({ creada: "2026-10-20T18:50:47.000-03:00", proximoCobro: "2026-11-20T00:00:00.000-03:00" }), 20);
    // 01:30 UTC del 21 todavía es el 20 en Argentina (UTC-3).
    assert.equal(diaDeCobroDelDebito({ creada: "2026-10-21T01:30:00.000Z", proximoCobro: null }), 20);
  });

  it("sin fecha de alta usa el próximo cobro, y sin ninguna válida, null", () => {
    assert.equal(diaDeCobroDelDebito({ creada: null, proximoCobro: "2026-11-20T00:00:00.000-03:00" }), 20);
    assert.equal(diaDeCobroDelDebito({ creada: "no es una fecha", proximoCobro: "2026-12-05T12:00:00.000-03:00" }), 5);
    assert.equal(diaDeCobroDelDebito({ creada: undefined, proximoCobro: undefined }), null);
    assert.equal(diaDeCobroDelDebito({ creada: "", proximoCobro: "basura" }), null);
  });
});

describe("planes que se pueden debitar", () => {
  it("todos los mensuales sí y el anual no", () => {
    for (const c of ["colegio", "deportiva", "multisede", "fundador", "estandar"]) assert.equal(esPlanDebitable(c), true, c);
    assert.equal(esPlanDebitable("anual"), false);
  });
});

describe("estado de la suscripción", () => {
  it("traduce lo que informa Mercado Pago", () => {
    assert.equal(estadoDeSuscripcion("pending"), "pendiente");
    assert.equal(estadoDeSuscripcion("authorized"), "autorizada");
    assert.equal(estadoDeSuscripcion("paused"), "pausada");
    assert.equal(estadoDeSuscripcion("cancelled"), "cancelada");
    assert.equal(estadoDeSuscripcion("canceled"), "cancelada");
  });

  it("un estado desconocido no se traduce (no pisa lo que ya teníamos)", () => {
    assert.equal(estadoDeSuscripcion("algo-nuevo"), null);
    assert.equal(estadoDeSuscripcion(undefined), null);
    assert.equal(estadoDeSuscripcion(null), null);
    assert.equal(estadoDeSuscripcion(""), null);
  });

  it("los estados guardados son los nuestros y no pasan por el traductor de Mercado Pago", () => {
    for (const e of ["pendiente", "autorizada", "pausada", "cancelada"] as const) {
      assert.equal(estadoGuardado(e), e, e);
      // El error que mostraba "cancelado" una suscripción autorizada: el traductor solo entiende los estados de Mercado Pago.
      assert.equal(estadoDeSuscripcion(e), null, e);
    }
    for (const e of ["authorized", "algo", "", null, undefined]) assert.equal(estadoGuardado(e as string), null, String(e));
  });

  it("pendiente, activa y en pausa impiden crear otra; cancelada no", () => {
    for (const e of ["pendiente", "autorizada", "pausada"]) assert.equal(suscripcionVigente(e), true, e);
    for (const e of ["cancelada", "", null, undefined, "x"]) assert.equal(suscripcionVigente(e as string), false, String(e));
  });
});

describe("armado del plan de la institución", () => {
  const datos = {
    institucion: "Colegio San Andrés del Norte",
    planLabel: "Plan Colegios",
    monto: 59000,
    volverA: "https://www.unidoar.com.ar/institucion/plan",
  };

  it("pide un plan mensual en pesos, sin mail de quien paga ni referencia (Mercado Pago los descarta o los valida contra cuentas reales)", () => {
    const c = cuerpoDePlan(datos);
    assert.deepEqual(c.auto_recurring, { frequency: 1, frequency_type: "months", transaction_amount: 59000, currency_id: "ARS" });
    assert.equal(c.back_url, "https://www.unidoar.com.ar/institucion/plan");
    assert.equal(c.reason, "UNIDOAR · Plan Colegios · Colegio San Andrés del Norte");
    assert.equal("payer_email" in c, false);
    assert.equal("external_reference" in c, false);
  });

  it("con días de prueba el plan lleva un free_trial en días, y sin ellos no lleva nada", () => {
    const con = cuerpoDePlan({ ...datos, diasDePrueba: 31 });
    assert.deepEqual(con.auto_recurring, {
      frequency: 1,
      frequency_type: "months",
      transaction_amount: 59000,
      currency_id: "ARS",
      free_trial: { frequency: 31, frequency_type: "days" },
    });
    for (const dias of [0, undefined, -3, 2.5, NaN]) assert.equal("free_trial" in cuerpoDePlan({ ...datos, diasDePrueba: dias }).auto_recurring, false, String(dias));
  });

  it("un plan con otros días de prueba no se reutiliza", () => {
    const guardado = { plan: "colegio", monto: 59000, diasDePrueba: 31 };
    assert.equal(puedeReutilizarPlan(guardado, { plan: "colegio", monto: 59000, diasDePrueba: 31 }), true);
    assert.equal(puedeReutilizarPlan(guardado, { plan: "colegio", monto: 59000, diasDePrueba: 30 }), false);
    assert.equal(puedeReutilizarPlan(guardado, { plan: "colegio", monto: 59000 }), false);
    assert.equal(puedeReutilizarPlan({ plan: "colegio", monto: 59000 }, { plan: "colegio", monto: 59000, diasDePrueba: 0 }), true);
  });

  it("el plan se reutiliza solo si sigue siendo el mismo plan y el mismo monto", () => {
    const guardado = { plan: "colegio", monto: 59000 };
    assert.equal(puedeReutilizarPlan(guardado, { plan: "colegio", monto: 59000 }), true);
    assert.equal(puedeReutilizarPlan(guardado, { plan: "colegio", monto: 65000 }), false);
    assert.equal(puedeReutilizarPlan(guardado, { plan: "multisede", monto: 59000 }), false);
    assert.equal(puedeReutilizarPlan(null, { plan: "colegio", monto: 59000 }), false);
    assert.equal(puedeReutilizarPlan(undefined, { plan: "colegio", monto: 59000 }), false);
  });

  it("el motivo es corto y no tiene espacios de más", () => {
    assert.equal(motivoDeSuscripcion("Plan  Colegios", "Colegio   Norte"), "UNIDOAR · Plan Colegios · Colegio Norte");
    assert.ok(motivoDeSuscripcion("Plan Colegios", "x".repeat(300)).length <= 100);
  });

  it("cambiar el monto solo toca el monto", () => {
    assert.deepEqual(cuerpoDeNuevoMonto(65000), { auto_recurring: { transaction_amount: 65000, currency_id: "ARS" } });
  });

  it("solo se cobra un monto entero y positivo", () => {
    assert.equal(montoCobrable(59000), true);
    for (const m of [0, -1, 10.5, NaN, Infinity, "5900", null, undefined]) assert.equal(montoCobrable(m), false, String(m));
  });
});

describe("a dónde mandamos a la persona", () => {
  it("solo a Mercado Pago, con https", () => {
    assert.equal(esUrlDeMercadoPago("https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_id=abc"), true);
    assert.equal(esUrlDeMercadoPago("https://mercadopago.com.ar/x"), true);
    assert.equal(esUrlDeMercadoPago("https://www.mercadopago.com/x"), true);
  });

  it("rechaza cualquier otro sitio, http y lo que no es una dirección", () => {
    for (const u of [
      "http://www.mercadopago.com.ar/x",
      "https://mercadopago.com.ar.evil.com/x",
      "https://evilmercadopago.com.ar/x",
      "https://www.mercadopago.com.evil.com/",
      "https://user@evil.com/",
      "javascript:alert(1)",
      "//www.mercadopago.com.ar/",
      "",
      null,
      undefined,
      42,
    ]) {
      assert.equal(esUrlDeMercadoPago(u), false, String(u));
    }
  });
});

describe("una suscripción nueva que no teníamos anotada", () => {
  const nueva = { idNuevo: "NUEVA" };
  const vieja = (estado: string) => ({ estado, suscripcionId: "VIEJA" });

  it("una cancelada o de estado desconocido no crea nada", () => {
    assert.equal(decidirAltaDeSuscripcion({ ...nueva, estadoNuevo: "cancelada", propia: null }), "ignorar");
    assert.equal(decidirAltaDeSuscripcion({ ...nueva, estadoNuevo: null, propia: null }), "ignorar");
    assert.equal(decidirAltaDeSuscripcion({ ...nueva, estadoNuevo: "cancelada", propia: vieja("pendiente") }), "ignorar");
  });

  it("sin nada anotado, o con una cancelada, se crea (la persona acaba de suscribirse)", () => {
    for (const estadoNuevo of ["pendiente", "autorizada", "pausada"] as const) {
      assert.equal(decidirAltaDeSuscripcion({ ...nueva, estadoNuevo, propia: null }), "crear", estadoNuevo);
      assert.equal(decidirAltaDeSuscripcion({ ...nueva, estadoNuevo, propia: vieja("cancelada") }), "crear", estadoNuevo);
    }
  });

  it("con una activa o en pausa, la nueva es una duplicada (Mercado Pago cobraría las dos)", () => {
    for (const estado of ["autorizada", "pausada"]) {
      assert.equal(decidirAltaDeSuscripcion({ ...nueva, estadoNuevo: "autorizada", propia: vieja(estado) }), "duplicada", estado);
      assert.equal(decidirAltaDeSuscripcion({ ...nueva, estadoNuevo: "pendiente", propia: vieja(estado) }), "duplicada", estado);
    }
  });

  it("con una pendiente, solo una autorizada la reemplaza", () => {
    assert.equal(decidirAltaDeSuscripcion({ ...nueva, estadoNuevo: "autorizada", propia: vieja("pendiente") }), "reemplazar");
    assert.equal(decidirAltaDeSuscripcion({ ...nueva, estadoNuevo: "pendiente", propia: vieja("pendiente") }), "ignorar");
    assert.equal(decidirAltaDeSuscripcion({ ...nueva, estadoNuevo: "pausada", propia: vieja("pendiente") }), "ignorar");
  });

  it("si la fila ya es esta misma suscripción (otro camino la anotó un instante antes), no es un duplicado de sí misma", () => {
    // Es el caso de la carrera entre el aviso de Mercado Pago y la vuelta de la persona: nunca se cancela la suscripción buena.
    for (const estado of ["pendiente", "autorizada", "pausada", "cancelada"]) {
      for (const estadoNuevo of ["pendiente", "autorizada", "pausada", "cancelada", null] as const) {
        assert.equal(decidirAltaDeSuscripcion({ idNuevo: "X", estadoNuevo, propia: { estado, suscripcionId: "X" } }), "misma", `${estado} / ${estadoNuevo}`);
      }
    }
  });
});

describe("lectura de un cobro", () => {
  const base = {
    id: 987654,
    preapproval_id: "2c93808493f2a9",
    status: "processed",
    debit_date: "2026-10-20T15:00:00.000-04:00",
    transaction_amount: 59000,
    retry_attempt: 0,
    payment: { id: 123456789, status: "approved", status_detail: "accredited" },
  };

  it("un pago aprobado se lee como aprobado, con el mes en que se debitó", () => {
    const c = leerCobro(base)!;
    assert.equal(c.resultado, "aprobado");
    assert.equal(c.id, "987654");
    assert.equal(c.suscripcionId, "2c93808493f2a9");
    assert.equal(c.monto, 59000);
    assert.equal(c.pagoId, "123456789");
    assert.equal(c.periodo, "2026-10");
    assert.equal(c.debitoEn, "2026-10-20");
    assert.equal(c.detalle, "accredited");
  });

  it("el mes sale del día en Argentina, no del de Mercado Pago ni de UTC", () => {
    // 31/10 a las 22:30 en Argentina = 01/11 01:30 UTC: sigue siendo octubre acá.
    assert.equal(leerCobro({ ...base, debit_date: "2026-11-01T01:30:00.000Z" })!.periodo, "2026-10");
    // 01/11 a las 00:30 en Argentina: ya es noviembre.
    assert.equal(leerCobro({ ...base, debit_date: "2026-11-01T03:30:00.000Z" })!.periodo, "2026-11");
  });

  it("un rechazo es rechazado (y puede reintentarse): no mueve plata", () => {
    const c = leerCobro({ ...base, status: "recycling", retry_attempt: 2, payment: { id: 5, status: "rejected", status_detail: "cc_rejected_insufficient_amount" } })!;
    assert.equal(c.resultado, "rechazado");
    assert.equal(c.intento, 2);
    assert.equal(c.detalle, "cc_rejected_insufficient_amount");
  });

  it("sin pago todavía es pendiente; un cobro cancelado, cancelado", () => {
    assert.equal(leerCobro({ ...base, status: "scheduled", payment: undefined })!.resultado, "pendiente");
    assert.equal(leerCobro({ ...base, status: "cancelled", payment: undefined })!.resultado, "cancelado");
  });

  it("solo 'approved' cuenta como cobrado (nada de 'in_process' ni valores raros)", () => {
    for (const s of ["in_process", "pending", "authorized", "refunded", "algo"]) {
      assert.notEqual(leerCobro({ ...base, payment: { id: 1, status: s } })!.resultado, "aprobado", s);
    }
  });

  it("si falta lo mínimo para ligarlo, no se lee", () => {
    assert.equal(leerCobro(null), null);
    assert.equal(leerCobro(undefined), null);
    assert.equal(leerCobro({ ...base, id: undefined }), null);
    assert.equal(leerCobro({ ...base, preapproval_id: undefined }), null);
  });

  it("datos faltantes o raros no rompen: fecha, monto e intento quedan en null o 0", () => {
    const c = leerCobro({ ...base, debit_date: "no es una fecha", transaction_amount: -5, retry_attempt: -3 })!;
    assert.equal(c.periodo, null);
    assert.equal(c.debitoEn, null);
    assert.equal(c.monto, null);
    assert.equal(c.intento, 0);
  });
});

describe("qué se hace con la factura del mes", () => {
  it("sin factura se crea ya paga; impaga o vencida se marca paga; ya paga se deja y se avisa del doble pago", () => {
    assert.equal(accionSobreLaFactura(null), "crear-paga");
    assert.equal(accionSobreLaFactura(undefined), "crear-paga");
    assert.equal(accionSobreLaFactura({ estado: "pendiente" }), "marcar-paga");
    assert.equal(accionSobreLaFactura({ estado: "vencida" }), "marcar-paga");
    assert.equal(accionSobreLaFactura({ estado: "pagada" }), "ya-estaba-paga");
  });
});

describe("poner al día el monto de una suscripción", () => {
  it("si el monto es el mismo no se toca nada", () => {
    assert.deepEqual(decidirSincronizacion({ plan: "colegio", monto: 59000, esperado: 59000 }), { accion: "nada" });
  });

  it("si cambió el precio o las sedes, se actualiza al monto de hoy", () => {
    assert.deepEqual(decidirSincronizacion({ plan: "colegio", monto: 59000, esperado: 65000 }), { accion: "cambiar-monto", monto: 65000 });
    assert.deepEqual(decidirSincronizacion({ plan: "multisede", monto: 60000, esperado: 90000 }), { accion: "cambiar-monto", monto: 90000 });
  });

  it("si pasó al plan anual, la suscripción mensual se cancela (aunque el monto coincida)", () => {
    assert.deepEqual(decidirSincronizacion({ plan: "anual", monto: 59000, esperado: 590000 }), { accion: "cancelar" });
    assert.deepEqual(decidirSincronizacion({ plan: "anual", monto: 59000, esperado: null }), { accion: "cancelar" });
  });

  it("sin un monto válido no se toca nada (mejor cobrar el de antes que uno raro)", () => {
    for (const esperado of [null, 0, -5, 10.5, NaN]) {
      assert.deepEqual(decidirSincronizacion({ plan: "colegio", monto: 59000, esperado }), { accion: "nada" }, String(esperado));
    }
  });
});

describe("qué dijo Mercado Pago de un rechazo (para el log)", () => {
  it("junta el mensaje, el error y los códigos de causa", () => {
    const d = detalleDeRechazo({
      message: "Invalid users involved",
      error: "bad_request",
      causes: [{ code: 2000, description: "payer_email no es válido" }, { code: "X1" }],
    });
    assert.equal(d, "Invalid users involved | bad_request | 2000: payer_email no es válido | X1");
  });

  it("no repite el mismo texto", () => {
    assert.equal(detalleDeRechazo({ message: "boom", error: "boom" }), "boom");
  });

  it("tapa los mails, que podrían repetir el que escribió la persona", () => {
    const d = detalleDeRechazo({ message: "El mail persona@ejemplo.com no pertenece a un usuario de prueba" });
    assert.equal(d.includes("@"), false);
    assert.match(d, /\[mail\]/);
  });

  it("acota el largo y tolera cualquier forma", () => {
    assert.ok(detalleDeRechazo({ message: "x".repeat(2000) }).length <= 400);
    assert.equal(detalleDeRechazo({}), "");
    assert.equal(detalleDeRechazo({ causes: "no es una lista" }), "");
    assert.equal(detalleDeRechazo({ causes: [null, 3, "x", { description: "ok" }] }), "ok");
  });
});
