import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AVISOS_QUE_USAMOS, esAvisoQueUsamos, mercadoPagoActivo, secretoDelWebhook, tokenDeMercadoPago } from "@/lib/mercadopago-config";

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

  it("solo los avisos de suscripción que usamos", () => {
    for (const t of AVISOS_QUE_USAMOS) assert.equal(esAvisoQueUsamos(t), true, t);
    for (const t of ["payment", "subscription_preapproval_plan", "", null, undefined, 3]) assert.equal(esAvisoQueUsamos(t), false, String(t));
  });
});
