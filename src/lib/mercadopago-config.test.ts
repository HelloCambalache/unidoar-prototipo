import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AVISOS_QUE_USAMOS, esAvisoQueUsamos, mercadoPagoActivo, secretoDelWebhook, tokenDeMercadoPago } from "@/lib/mercadopago-config";

describe("configuración de Mercado Pago", () => {
  it("apagado sin variables", () => {
    assert.equal(mercadoPagoActivo({}), false);
    assert.equal(tokenDeMercadoPago({}), undefined);
    assert.equal(secretoDelWebhook({}), undefined);
  });

  it("hacen falta el token Y la clave de los avisos", () => {
    assert.equal(mercadoPagoActivo({ MP_ACCESS_TOKEN: "TEST-abc" }), false);
    assert.equal(mercadoPagoActivo({ MP_WEBHOOK_SECRET: "clave" }), false);
    assert.equal(mercadoPagoActivo({ MP_ACCESS_TOKEN: "TEST-abc", MP_WEBHOOK_SECRET: "clave" }), true);
  });

  it("un valor vacío o con espacios no cuenta", () => {
    assert.equal(mercadoPagoActivo({ MP_ACCESS_TOKEN: "   ", MP_WEBHOOK_SECRET: "clave" }), false);
    assert.equal(mercadoPagoActivo({ MP_ACCESS_TOKEN: "TEST-abc", MP_WEBHOOK_SECRET: "" }), false);
    assert.equal(tokenDeMercadoPago({ MP_ACCESS_TOKEN: "  TEST-abc  " }), "TEST-abc");
  });

  it("solo los avisos de suscripción que usamos", () => {
    for (const t of AVISOS_QUE_USAMOS) assert.equal(esAvisoQueUsamos(t), true, t);
    for (const t of ["payment", "subscription_preapproval_plan", "", null, undefined, 3]) assert.equal(esAvisoQueUsamos(t), false, String(t));
  });
});
