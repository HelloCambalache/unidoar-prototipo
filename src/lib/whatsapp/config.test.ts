import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { VERSION_DE_API_POR_DEFECTO, modoWhatsapp, versionDeApi, whatsappActivo } from "./config";

describe("modo de los avisos por WhatsApp", () => {
  it("sin token o sin número está apagado", () => {
    assert.equal(modoWhatsapp({}), "apagado");
    assert.equal(modoWhatsapp({ WHATSAPP_TOKEN: "t" }), "apagado");
    assert.equal(modoWhatsapp({ WHATSAPP_PHONE_NUMBER_ID: "1" }), "apagado");
    assert.equal(modoWhatsapp({ WHATSAPP_TOKEN: "  ", WHATSAPP_PHONE_NUMBER_ID: "1" }), "apagado");
  });

  it("con token y número sale por Meta", () => {
    assert.equal(modoWhatsapp({ WHATSAPP_TOKEN: "t", WHATSAPP_PHONE_NUMBER_ID: "1" }), "meta");
  });

  it("WHATSAPP_MODO manda sobre todo lo demás", () => {
    assert.equal(modoWhatsapp({ WHATSAPP_MODO: "apagado", WHATSAPP_TOKEN: "t", WHATSAPP_PHONE_NUMBER_ID: "1" }), "apagado");
    assert.equal(modoWhatsapp({ WHATSAPP_MODO: "CONSOLA" }), "consola");
    assert.equal(modoWhatsapp({ WHATSAPP_MODO: "otra cosa" }), "apagado");
  });

  it("las pantallas solo ofrecen los avisos si hay algo que los mande o los imprima", () => {
    assert.equal(whatsappActivo({}), false);
    assert.equal(whatsappActivo({ WHATSAPP_MODO: "consola" }), true);
    assert.equal(whatsappActivo({ WHATSAPP_TOKEN: "t", WHATSAPP_PHONE_NUMBER_ID: "1" }), true);
  });

  it("la versión de la API se puede cambiar sin tocar el código", () => {
    assert.equal(versionDeApi({}), VERSION_DE_API_POR_DEFECTO);
    assert.equal(versionDeApi({ WHATSAPP_API_VERSION: "v25.0" }), "v25.0");
  });
});
