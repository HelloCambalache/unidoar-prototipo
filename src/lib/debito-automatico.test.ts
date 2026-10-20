import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  accionSobreLaFactura,
  cuerpoDeNuevoMonto,
  cuerpoDeSuscripcion,
  decidirSincronizacion,
  detalleDeRechazo,
  esEmailDePago,
  esPlanDebitable,
  esUrlDeMercadoPago,
  estadoDeSuscripcion,
  leerCobro,
  montoCobrable,
  motivoDeSuscripcion,
  suscripcionVigente,
} from "@/lib/debito-automatico";

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

  it("pendiente, activa y en pausa impiden crear otra; cancelada no", () => {
    for (const e of ["pendiente", "autorizada", "pausada"]) assert.equal(suscripcionVigente(e), true, e);
    for (const e of ["cancelada", "", null, undefined, "x"]) assert.equal(suscripcionVigente(e as string), false, String(e));
  });
});

describe("armado de la suscripción", () => {
  const datos = {
    institucionId: "3f2b8c1e-5d4a-4c7b-9e0a-1b2c3d4e5f60",
    institucion: "Colegio San Andrés del Norte",
    planLabel: "Plan Colegios",
    monto: 59000,
    email: "pagos@colegio.edu.ar",
    volverA: "https://www.unidoar.com.ar/institucion/plan",
  };

  it("pide una suscripción mensual en pesos, pendiente de que la persona la autorice", () => {
    const c = cuerpoDeSuscripcion(datos);
    assert.equal(c.status, "pending");
    assert.deepEqual(c.auto_recurring, { frequency: 1, frequency_type: "months", transaction_amount: 59000, currency_id: "ARS" });
    assert.equal(c.external_reference, datos.institucionId);
    assert.equal(c.payer_email, "pagos@colegio.edu.ar");
    assert.equal(c.back_url, "https://www.unidoar.com.ar/institucion/plan");
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

  it("el mail de pago tiene forma de mail", () => {
    assert.equal(esEmailDePago("a@b.co"), true);
    for (const e of ["", "a@b", "a b@c.com", "@c.com", "a@", `${"x".repeat(120)}@c.com`, null, undefined]) assert.equal(esEmailDePago(e), false, String(e));
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
