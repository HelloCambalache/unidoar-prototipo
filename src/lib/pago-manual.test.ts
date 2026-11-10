import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  avisoDeFormaDePago,
  formaDeCobroDe,
  fraseDelCartelSinPago,
  pasosParaActivar,
  pasosParaLevantarLaMora,
  puedePagarConMercadoPago,
  puedePagarEnMano,
  resumenParaElEquipo,
  type FormaDeCobro,
} from "./pago-manual";

const entrada = { habilitadaManual: false, mercadoPagoDisponible: true, esPuntual: false, precioDefinido: true };
const FORMAS: FormaDeCobro[] = ["solo-mercadopago", "las-dos", "manual"];
const SIN_MANO = /transferencia|efectivo/i;

describe("cómo paga una institución", () => {
  it("con Mercado Pago disponible y sin habilitar, paga solo con Mercado Pago", () => {
    assert.equal(formaDeCobroDe(entrada), "solo-mercadopago");
  });

  it("si el equipo la habilitó, puede las dos formas", () => {
    assert.equal(formaDeCobroDe({ ...entrada, habilitadaManual: true }), "las-dos");
  });

  it("mientras Mercado Pago no esté disponible para ella, todas pagan como siempre (así nadie queda sin forma de pagar)", () => {
    assert.equal(formaDeCobroDe({ ...entrada, mercadoPagoDisponible: false }), "manual");
    assert.equal(formaDeCobroDe({ ...entrada, mercadoPagoDisponible: false, habilitadaManual: true }), "manual");
  });

  it("la búsqueda puntual y Multisede sin convenio no tienen camino por Mercado Pago: siguen como siempre", () => {
    assert.equal(formaDeCobroDe({ ...entrada, esPuntual: true }), "manual");
    assert.equal(formaDeCobroDe({ ...entrada, precioDefinido: false }), "manual");
    assert.equal(formaDeCobroDe({ ...entrada, esPuntual: true, habilitadaManual: true }), "manual");
  });

  it("solo «solo Mercado Pago» no puede pagar en mano, y solo «manual» no puede pagar con Mercado Pago", () => {
    assert.deepEqual(FORMAS.map(puedePagarEnMano), [false, true, true]);
    assert.deepEqual(FORMAS.map(puedePagarConMercadoPago), [true, true, false]);
  });
});

describe("textos según cómo paga", () => {
  it("a quien paga solo con Mercado Pago no se le habla de transferencia ni de efectivo en ningún paso ni cartel", () => {
    const textos = [
      ...pasosParaActivar("solo-mercadopago"),
      ...pasosParaLevantarLaMora("solo-mercadopago"),
      fraseDelCartelSinPago("solo-mercadopago", "publicar"),
      avisoDeFormaDePago("solo-mercadopago")!.texto,
      avisoDeFormaDePago("solo-mercadopago")!.titulo,
    ];
    for (const t of textos) assert.doesNotMatch(t, SIN_MANO, t);
    assert.match(pasosParaActivar("solo-mercadopago")[0]!, /Mercado Pago/);
    assert.match(pasosParaActivar("solo-mercadopago")[0]!, /Plan y facturación/);
  });

  it("a quien el equipo habilitó se le ofrecen las dos formas", () => {
    for (const t of [pasosParaActivar("las-dos")[0]!, pasosParaLevantarLaMora("las-dos")[0]!, fraseDelCartelSinPago("las-dos", "publicar")]) {
      assert.match(t, /Mercado Pago/, t);
      assert.match(t, /transferencia o efectivo/, t);
    }
    assert.ok(avisoDeFormaDePago("las-dos"));
  });

  it("quien paga como siempre ve lo de siempre y ningún aviso nuevo", () => {
    assert.match(pasosParaActivar("manual")[0]!, /transferencia o en efectivo/);
    assert.match(pasosParaLevantarLaMora("manual")[0]!, /transferencia o en efectivo/);
    assert.match(fraseDelCartelSinPago("manual", "publicar"), /registremos tu primer pago/);
    for (const t of [...pasosParaActivar("manual"), ...pasosParaLevantarLaMora("manual")]) assert.doesNotMatch(t, /Mercado Pago/, t);
    assert.equal(avisoDeFormaDePago("manual"), null);
  });

  it("el cartel de cuenta sin pago dice qué se frena en las tres formas", () => {
    for (const f of FORMAS) assert.ok(fraseDelCartelSinPago(f, "publicar búsquedas").includes("publicar búsquedas"), f);
  });

  it("los pasos terminan diciendo que no hay que hacer nada más", () => {
    for (const f of FORMAS) {
      assert.match(pasosParaActivar(f).at(-1)!, /no tenés que hacer nada más/, f);
      assert.match(pasosParaLevantarLaMora(f).at(-1)!, /no tenés que hacer nada más/, f);
    }
  });
});

describe("lo que dice la ficha del equipo", () => {
  it("explica qué pasa hoy en cada caso", () => {
    assert.match(resumenParaElEquipo("solo-mercadopago", false), /Paga con Mercado Pago/);
    assert.match(resumenParaElEquipo("las-dos", true), /Habilitada/);
  });

  it("si Mercado Pago no está disponible, avisa que hoy la habilitación no cambia nada y qué va a pasar cuando lo esté", () => {
    assert.match(resumenParaElEquipo("manual", true), /Hoy esto no cambia nada/);
    assert.match(resumenParaElEquipo("manual", false), /Cuando Mercado Pago esté disponible/);
  });
});
