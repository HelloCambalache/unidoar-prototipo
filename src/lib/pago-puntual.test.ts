import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decidirPagoDePuntual, MEDIO_DE_PAGO_PUNTUAL, motivoParaNoOfrecerPagoPuntual, PARAMETRO_DE_VUELTA_PUNTUAL, tituloDelPagoPuntual } from "./pago-puntual";
import { cuerpoDePreferencia, decidirPagoDeSemestre, type PagoLeido } from "./pago-semestre";
import { permisoParaPublicarPuntual } from "./puntual";

const pago = (extra: Partial<PagoLeido> = {}): PagoLeido => ({
  id: "999",
  estado: "aprobado",
  monto: 110_000,
  moneda: "ARS",
  referencia: "0b1c2d3e-0000-4000-8000-000000000001",
  aprobadoEn: "2026-11-10T15:00:00.000-03:00",
  detalle: "accredited",
  ...extra,
});
const intento = (extra: Partial<{ estado: string; monto: number; pagoId: string | null }> = {}) => ({ estado: "pendiente", monto: 110_000, pagoId: null, ...extra });

describe("pago de una búsqueda puntual por Mercado Pago: qué se hace con cada pago", () => {
  it("un pago aprobado, en pesos y por el monto exacto deja la búsqueda pagada", () => {
    assert.deepEqual(decidirPagoDePuntual({ intento: intento(), pago: pago() }), { accion: "registrar" });
  });

  it("un monto distinto o una moneda distinta no se registra solo: lo mira el equipo", () => {
    const monto = decidirPagoDePuntual({ intento: intento(), pago: pago({ monto: 100_000 }) });
    assert.equal(monto.accion, "revisar");
    const moneda = decidirPagoDePuntual({ intento: intento(), pago: pago({ moneda: "USD" }) });
    assert.equal(moneda.accion, "revisar");
    assert.equal(decidirPagoDePuntual({ intento: intento(), pago: pago({ monto: null }) }).accion, "revisar");
  });

  it("un pago pendiente, en proceso o rechazado no mueve nada (se puede reintentar con el mismo link)", () => {
    for (const estado of ["pendiente", "rechazado", "desconocido"] as const) {
      assert.deepEqual(decidirPagoDePuntual({ intento: intento(), pago: pago({ estado }) }), { accion: "esperar" }, estado);
    }
  });

  it("el mismo pago repetido es un aviso repetido y no registra otra búsqueda", () => {
    assert.deepEqual(decidirPagoDePuntual({ intento: intento({ estado: "pagado", pagoId: "999" }), pago: pago() }), { accion: "ya-registrado" });
  });

  it("otro pago aprobado sobre una búsqueda ya paga es un cobro de más: se avisa al equipo y el motivo habla de una búsqueda, no de un semestre", () => {
    const d = decidirPagoDePuntual({ intento: intento({ estado: "pagado", pagoId: "111" }), pago: pago() });
    assert.equal(d.accion, "revisar");
    assert.match(d.accion === "revisar" ? d.motivo : "", /una búsqueda puntual/);
    assert.doesNotMatch(d.accion === "revisar" ? d.motivo : "", /semestre/);
    // El semestre sigue diciendo semestre.
    const s = decidirPagoDeSemestre({ intento: intento({ estado: "pagado", pagoId: "111" }), pago: pago() });
    assert.match(s.accion === "revisar" ? s.motivo : "", /semestre/);
  });

  it("una devolución solo importa si la búsqueda ya estaba paga", () => {
    assert.deepEqual(decidirPagoDePuntual({ intento: intento({ estado: "pagado", pagoId: "999" }), pago: pago({ estado: "devuelto" }) }), { accion: "devuelto" });
    assert.deepEqual(decidirPagoDePuntual({ intento: intento(), pago: pago({ estado: "devuelto" }) }), { accion: "esperar" });
  });
});

describe("pago de una búsqueda puntual por Mercado Pago: cuándo se ofrece", () => {
  it("se ofrece solo con el plan de búsqueda puntual, con precio y sin una búsqueda pagada sin publicar", () => {
    assert.equal(motivoParaNoOfrecerPagoPuntual({ esPuntual: true, precioDefinido: true, disponibles: 0 }), null);
  });

  it("con un plan con abono no hay nada que pagar por búsqueda", () => {
    assert.match(motivoParaNoOfrecerPagoPuntual({ esPuntual: false, precioDefinido: true, disponibles: 0 })!, /plan de búsqueda puntual/);
  });

  it("sin precio definido se coordina con el equipo", () => {
    assert.match(motivoParaNoOfrecerPagoPuntual({ esPuntual: true, precioDefinido: false, disponibles: 0 })!, /Contacto/);
  });

  it("con una búsqueda ya paga sin publicar no se vuelve a pagar por error: primero se publica", () => {
    assert.match(motivoParaNoOfrecerPagoPuntual({ esPuntual: true, precioDefinido: true, disponibles: 1 })!, /publicala primero/);
  });
});

describe("pago de una búsqueda puntual por Mercado Pago: el link y los textos", () => {
  const base = { referencia: "abc", titulo: "t", descripcion: "d", monto: 110_000, origen: "https://www.unidoar.com.ar", rutaDelAviso: "/api/mercadopago/webhook", ahora: new Date("2026-11-10T12:00:00Z") };

  it("el link vuelve a Plan y facturación con el parámetro de la búsqueda puntual, y el del semestre sigue igual", () => {
    const p = cuerpoDePreferencia({ ...base, parametroDeVuelta: PARAMETRO_DE_VUELTA_PUNTUAL });
    assert.equal(p.back_urls.success, "https://www.unidoar.com.ar/institucion/plan?pago_puntual=ok");
    assert.equal(p.back_urls.pending, "https://www.unidoar.com.ar/institucion/plan?pago_puntual=pendiente");
    assert.equal(p.back_urls.failure, "https://www.unidoar.com.ar/institucion/plan?pago_puntual=error");
    assert.equal(cuerpoDePreferencia(base).back_urls.success, "https://www.unidoar.com.ar/institucion/plan?pago_semestre=ok");
  });

  it("el número del intento viaja como referencia, que es lo único que dice de quién es el pago", () => {
    const p = cuerpoDePreferencia({ ...base, referencia: "0b1c2d3e" });
    assert.equal(p.external_reference, "0b1c2d3e");
    assert.equal(p.items[0]!.unit_price, 110_000);
    assert.equal(p.items[0]!.currency_id, "ARS");
  });

  it("el medio que queda anotado y el título que ve la persona", () => {
    assert.equal(MEDIO_DE_PAGO_PUNTUAL, "Mercado Pago");
    assert.equal(tituloDelPagoPuntual("Búsqueda puntual"), "UNIDOAR · Búsqueda puntual · una búsqueda");
  });

  it("quien no tiene una búsqueda pagada ve que se abona desde Plan y facturación (con Mercado Pago o por Contacto, según cómo pague)", () => {
    const r = permisoParaPublicarPuntual({ disponibles: 0, abiertas: 0, maxAbiertas: 1, sedes: 1, precio: "$ 110.000" });
    assert.equal(r.ok, false);
    assert.match(!r.ok ? r.error : "", /Plan y facturación/);
  });
});
