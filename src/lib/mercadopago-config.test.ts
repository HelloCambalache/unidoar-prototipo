import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AVISOS_QUE_USAMOS,
  esAvisoQueUsamos,
  diferirPrimerCobroActivo,
  esCuentaDePrueba,
  esTokenDePrueba,
  mercadoPagoActivo,
  secretoDelWebhook,
  tokenDeMercadoPago,
} from "@/lib/mercadopago-config";

describe("¿los cobros son de prueba?", () => {
  it("un token que empieza con TEST- es de prueba; uno de producción (APP_USR-) o vacío, no", () => {
    assert.equal(esTokenDePrueba("TEST-123456-abc"), true);
    assert.equal(esTokenDePrueba("  test-123  "), true);
    assert.equal(esTokenDePrueba("APP_USR-123456-abc"), false);
    for (const t of ["", "   ", null, undefined]) assert.equal(esTokenDePrueba(t), false, String(t));
  });

  it("una cuenta de prueba se reconoce por su mail, su usuario o sus etiquetas", () => {
    assert.equal(esCuentaDePrueba({ email: "test_user_328791889392025651@testuser.com" }), true);
    assert.equal(esCuentaDePrueba({ email: "otro@testuser.com" }), true);
    assert.equal(esCuentaDePrueba({ nickname: "TESTUSER328791889392025651" }), true);
    assert.equal(esCuentaDePrueba({ tags: ["normal", "test_user"] }), true);
  });

  it("una cuenta real, o sin datos, no es de prueba", () => {
    assert.equal(esCuentaDePrueba({ email: "unidoar@gmail.com", nickname: "UNIDOAR.COM", tags: ["normal", "credits"] }), false);
    assert.equal(esCuentaDePrueba({ email: "tester@empresa.com" }), false);
    for (const c of [{}, null, undefined, { email: 5, nickname: {}, tags: "test_user" }]) assert.equal(esCuentaDePrueba(c as never), false);
  });
});

describe("interruptor del primer cobro diferido", () => {
  it("apagado salvo que valga exactamente 1", () => {
    assert.equal(diferirPrimerCobroActivo({}), false);
    assert.equal(diferirPrimerCobroActivo({ MP_DIFERIR_PRIMER_COBRO: "1" }), true);
    assert.equal(diferirPrimerCobroActivo({ MP_DIFERIR_PRIMER_COBRO: " 1 " }), true);
    for (const v of ["0", "", "true", "si", "2"]) assert.equal(diferirPrimerCobroActivo({ MP_DIFERIR_PRIMER_COBRO: v }), false, v);
  });
});

describe("configuración de Mercado Pago", () => {
  it("apagado sin variables", () => {
    assert.equal(mercadoPagoActivo({}), false);
    assert.equal(tokenDeMercadoPago({}), undefined);
    assert.equal(secretoDelWebhook({}), undefined);
  });

  it("alcanza con el token: la clave de los avisos es opcional", () => {
    assert.equal(mercadoPagoActivo({ MP_ACCESS_TOKEN: "APP_USR-abc" }), true);
    assert.equal(mercadoPagoActivo({ MP_ACCESS_TOKEN: "APP_USR-abc", MP_WEBHOOK_SECRET: "clave" }), true);
  });

  it("sin el token no se activa, aunque esté la clave de los avisos", () => {
    assert.equal(mercadoPagoActivo({ MP_WEBHOOK_SECRET: "clave" }), false);
  });

  it("un valor vacío o con espacios no cuenta", () => {
    assert.equal(mercadoPagoActivo({ MP_ACCESS_TOKEN: "   " }), false);
    assert.equal(mercadoPagoActivo({ MP_ACCESS_TOKEN: "" }), false);
    assert.equal(tokenDeMercadoPago({ MP_ACCESS_TOKEN: "  APP_USR-abc  " }), "APP_USR-abc");
    assert.equal(secretoDelWebhook({ MP_WEBHOOK_SECRET: "  " }), undefined);
  });

  it("solo los avisos que usamos: las suscripciones y los pagos del semestre", () => {
    assert.deepEqual([...AVISOS_QUE_USAMOS], ["subscription_preapproval", "subscription_authorized_payment", "payment"]);
    for (const t of AVISOS_QUE_USAMOS) assert.equal(esAvisoQueUsamos(t), true, t);
    for (const t of ["subscription_preapproval_plan", "merchant_order", "point_integration_wh", "", null, undefined, 3]) assert.equal(esAvisoQueUsamos(t), false, String(t));
  });
});
