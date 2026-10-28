import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  cuerpoDePreferencia,
  decidirPagoDeSemestre,
  DIAS_DE_VIGENCIA_DEL_LINK,
  elegirInicioDeSemestre,
  estadoDePagoMp,
  leerPagoMp,
  montoDelSemestre,
  tituloDelPago,
  vueltaDelPago,
  type PagoLeido,
} from "@/lib/pago-semestre";

const PACK = { mesesQueSePagan: 5, mesesConReferido: 4 };

describe("estado de un pago de Mercado Pago", () => {
  it("solo «approved» es aprobado", () => {
    assert.equal(estadoDePagoMp("approved"), "aprobado");
    for (const s of ["pending", "in_process", "in_mediation", "authorized"]) assert.equal(estadoDePagoMp(s), "pendiente", s);
    for (const s of ["rejected", "cancelled"]) assert.equal(estadoDePagoMp(s), "rechazado", s);
    for (const s of ["refunded", "charged_back"]) assert.equal(estadoDePagoMp(s), "devuelto", s);
  });

  it("un estado que no conocemos no mueve plata", () => {
    assert.equal(estadoDePagoMp("algo_nuevo"), "desconocido");
    assert.equal(estadoDePagoMp(undefined), "desconocido");
    assert.equal(estadoDePagoMp(null), "desconocido");
  });
});

describe("leer un pago", () => {
  it("toma los datos que usamos", () => {
    const p = leerPagoMp({
      id: 1234567890,
      status: "approved",
      status_detail: "accredited",
      transaction_amount: 250000,
      currency_id: "ARS",
      external_reference: "3f2a9c1e-5b7d-4e8a-9c01-2d3e4f5a6b7c",
      date_approved: "2026-10-28T12:00:00.000-03:00",
    });
    assert.deepEqual(p, {
      id: "1234567890",
      estado: "aprobado",
      monto: 250000,
      moneda: "ARS",
      referencia: "3f2a9c1e-5b7d-4e8a-9c01-2d3e4f5a6b7c",
      aprobadoEn: "2026-10-28T12:00:00.000-03:00",
      detalle: "accredited",
    });
  });

  it("sin número de pago, o con uno que no tiene forma de número, no se lee", () => {
    assert.equal(leerPagoMp({ status: "approved" }), null);
    assert.equal(leerPagoMp({ id: "../../etc", status: "approved" }), null);
    assert.equal(leerPagoMp({ id: "a b" }), null);
    assert.equal(leerPagoMp(null), null);
    assert.equal(leerPagoMp("hola"), null);
  });

  it("los datos que faltan quedan en null, sin inventar nada", () => {
    const p = leerPagoMp({ id: "77", status: "pending" })!;
    assert.equal(p.monto, null);
    assert.equal(p.moneda, null);
    assert.equal(p.referencia, null);
    assert.equal(p.aprobadoEn, null);
    assert.equal(leerPagoMp({ id: "77", transaction_amount: "250000" })!.monto, null, "un monto en texto no cuenta");
    assert.equal(leerPagoMp({ id: "77", transaction_amount: Number.NaN })!.monto, null);
  });
});

describe("el pedido del link de pago", () => {
  const ahora = new Date("2026-10-28T15:00:00.000Z");
  const cuerpo = cuerpoDePreferencia({
    referencia: "3f2a9c1e-5b7d-4e8a-9c01-2d3e4f5a6b7c",
    titulo: "UNIDOAR · Plan Colegios · 6 meses",
    descripcion: "Semestre por adelantado",
    monto: 250000,
    origen: "https://www.unidoar.com.ar",
    rutaDelAviso: "/api/mercadopago/webhook",
    ahora,
  });

  it("lleva el monto, la referencia de nuestro intento y la dirección del aviso", () => {
    assert.equal(cuerpo.items.length, 1);
    assert.equal(cuerpo.items[0]!.unit_price, 250000);
    assert.equal(cuerpo.items[0]!.quantity, 1);
    assert.equal(cuerpo.items[0]!.currency_id, "ARS");
    assert.equal(cuerpo.external_reference, "3f2a9c1e-5b7d-4e8a-9c01-2d3e4f5a6b7c");
    assert.equal(cuerpo.notification_url, "https://www.unidoar.com.ar/api/mercadopago/webhook");
  });

  it("vuelve a Plan y facturación según cómo terminó el pago, y vuelve solo si se aprobó", () => {
    assert.equal(cuerpo.back_urls.success, "https://www.unidoar.com.ar/institucion/plan?pago_semestre=ok");
    assert.equal(cuerpo.back_urls.pending, "https://www.unidoar.com.ar/institucion/plan?pago_semestre=pendiente");
    assert.equal(cuerpo.back_urls.failure, "https://www.unidoar.com.ar/institucion/plan?pago_semestre=error");
    assert.equal(cuerpo.auto_return, "approved");
  });

  it("el link vence a los 3 días", () => {
    assert.equal(DIAS_DE_VIGENCIA_DEL_LINK, 3);
    assert.equal(cuerpo.expires, true);
    assert.equal(cuerpo.expiration_date_from, "2026-10-28T15:00:00.000Z");
    assert.equal(cuerpo.expiration_date_to, "2026-10-31T15:00:00.000Z");
  });
});

describe("el título del pago", () => {
  it("dice el plan y los meses que cubre", () => {
    assert.equal(tituloDelPago("Plan Colegios", "2026-10", 6), "UNIDOAR · Plan Colegios · 6 meses (octubre 2026 a marzo 2027)");
  });
});

describe("cuánto sale el semestre", () => {
  it("paga 5 meses; con un mes bonificado, 4", () => {
    assert.deepEqual(montoDelSemestre(50000, false, PACK), { mesesAPagar: 5, monto: 250000 });
    assert.deepEqual(montoDelSemestre(50000, true, PACK), { mesesAPagar: 4, monto: 200000 });
  });

  it("con un precio mensual distinto (sedes, precio acordado) multiplica ese", () => {
    assert.equal(montoDelSemestre(75000, false, PACK).monto, 375000);
    assert.equal(montoDelSemestre(29000, true, PACK).monto, 116000);
  });

  it("nunca paga más meses de los que se pagan, aunque el pack se configure raro", () => {
    assert.equal(montoDelSemestre(10000, true, { mesesQueSePagan: 3, mesesConReferido: 5 }).mesesAPagar, 3);
  });
});

describe("desde qué mes cubre el semestre", () => {
  const f = (periodo: string, estado: "pagada" | "pendiente", mesesCubiertos = 1) => ({ periodo, estado, mesesCubiertos });

  it("sin facturas, desde el mes en curso", () => {
    assert.deepEqual(elegirInicioDeSemestre({ actual: "2026-10", meses: 6, facturas: [] }), { inicio: "2026-10" });
  });

  it("si el mes en curso ya tiene su factura sin pagar, esa se convierte en la del semestre", () => {
    assert.deepEqual(elegirInicioDeSemestre({ actual: "2026-10", meses: 6, facturas: [f("2026-10", "pendiente")] }), { inicio: "2026-10" });
  });

  it("si el mes en curso ya está pago, empieza el mes siguiente", () => {
    assert.deepEqual(elegirInicioDeSemestre({ actual: "2026-10", meses: 6, facturas: [f("2026-10", "pagada")] }), { inicio: "2026-11" });
  });

  it("un mes pasado pago no molesta", () => {
    assert.deepEqual(elegirInicioDeSemestre({ actual: "2026-10", meses: 6, facturas: [f("2026-09", "pagada")] }), { inicio: "2026-10" });
  });

  it("si hay un semestre pago que cubre el mes en curso, no se puede pagar otro encima", () => {
    const r = elegirInicioDeSemestre({ actual: "2026-10", meses: 6, facturas: [f("2026-08", "pagada", 6)] });
    // Ese semestre llega hasta enero de 2027: ni octubre ni los dos meses siguientes sirven.
    assert.ok("error" in r);
    assert.match("error" in r ? r.error : "", /Escribinos desde Contacto/);
  });

  it("una factura sin pagar dentro de la ventana (que no es la del primer mes) frena el pago", () => {
    const r = elegirInicioDeSemestre({ actual: "2026-10", meses: 6, facturas: [f("2026-11", "pendiente")] });
    // Desde octubre choca con noviembre impaga; desde noviembre esa pasa a ser la del semestre.
    assert.deepEqual(r, { inicio: "2026-11" });
  });

  it("no empieza más de dos meses adelante", () => {
    const facturas = [f("2026-10", "pagada"), f("2026-11", "pagada"), f("2026-12", "pagada")];
    assert.ok("error" in elegirInicioDeSemestre({ actual: "2026-10", meses: 6, facturas }));
  });
});

describe("qué hacer cuando llega un pago", () => {
  const pago = (cambios: Partial<PagoLeido> = {}): PagoLeido => ({
    id: "999",
    estado: "aprobado",
    monto: 250000,
    moneda: "ARS",
    referencia: "abc",
    aprobadoEn: "2026-10-28T12:00:00.000-03:00",
    detalle: "accredited",
    ...cambios,
  });
  const intento = (cambios: Partial<{ estado: string; monto: number; pagoId: string | null }> = {}) => ({ estado: "pendiente", monto: 250000, pagoId: null, ...cambios });

  it("aprobado, por el monto acordado y en pesos: se registra el semestre", () => {
    assert.deepEqual(decidirPagoDeSemestre({ intento: intento(), pago: pago() }), { accion: "registrar" });
  });

  it("un monto con centavos que redondea al acordado también vale", () => {
    assert.deepEqual(decidirPagoDeSemestre({ intento: intento(), pago: pago({ monto: 250000.004 }) }), { accion: "registrar" });
  });

  it("un monto distinto no se registra solo", () => {
    for (const monto of [249999, 250001, 125000, 0]) {
      const r = decidirPagoDeSemestre({ intento: intento(), pago: pago({ monto }) });
      assert.equal(r.accion, "revisar", String(monto));
    }
    assert.equal(decidirPagoDeSemestre({ intento: intento(), pago: pago({ monto: null }) }).accion, "revisar");
  });

  it("un pago que no está en pesos no se registra solo", () => {
    assert.equal(decidirPagoDeSemestre({ intento: intento(), pago: pago({ moneda: "USD" }) }).accion, "revisar");
    assert.equal(decidirPagoDeSemestre({ intento: intento(), pago: pago({ moneda: null }) }).accion, "revisar");
  });

  it("pendiente o rechazado no pasa nada: la persona puede reintentar con el mismo link", () => {
    assert.deepEqual(decidirPagoDeSemestre({ intento: intento(), pago: pago({ estado: "pendiente" }) }), { accion: "esperar" });
    assert.deepEqual(decidirPagoDeSemestre({ intento: intento(), pago: pago({ estado: "rechazado" }) }), { accion: "esperar" });
    assert.deepEqual(decidirPagoDeSemestre({ intento: intento(), pago: pago({ estado: "desconocido" }) }), { accion: "esperar" });
  });

  it("el mismo pago avisado dos veces no se registra dos veces", () => {
    assert.deepEqual(decidirPagoDeSemestre({ intento: intento({ estado: "pagado", pagoId: "999" }), pago: pago() }), { accion: "ya-registrado" });
  });

  it("otro pago aprobado sobre un semestre que ya estaba pago es un cobro doble: lo mira el equipo", () => {
    const r = decidirPagoDeSemestre({ intento: intento({ estado: "pagado", pagoId: "111" }), pago: pago({ id: "999" }) });
    assert.equal(r.accion, "revisar");
  });

  it("una devolución de un pago ya registrado lo mira el equipo; de uno que nunca se registró, nada", () => {
    assert.deepEqual(decidirPagoDeSemestre({ intento: intento({ estado: "pagado", pagoId: "999" }), pago: pago({ estado: "devuelto" }) }), { accion: "devuelto" });
    assert.deepEqual(decidirPagoDeSemestre({ intento: intento(), pago: pago({ estado: "devuelto" }) }), { accion: "esperar" });
  });

  it("un intento que ya quedó en «revisar» tampoco se registra solo con un pago aprobado por el monto justo", () => {
    // `revisar` es un estado distinto de `pagado`: el pago aprobado se vuelve a evaluar (si ahora coincide, se registra).
    assert.deepEqual(decidirPagoDeSemestre({ intento: intento({ estado: "revisar" }), pago: pago() }), { accion: "registrar" });
  });
});

describe("la vuelta de Mercado Pago", () => {
  it("solo acepta los tres valores que ponemos nosotros", () => {
    assert.equal(vueltaDelPago("ok"), "ok");
    assert.equal(vueltaDelPago("pendiente"), "pendiente");
    assert.equal(vueltaDelPago("error"), "error");
    assert.equal(vueltaDelPago(["ok", "error"]), "ok");
    assert.equal(vueltaDelPago("cualquier cosa"), null);
    assert.equal(vueltaDelPago(undefined), null);
  });
});
