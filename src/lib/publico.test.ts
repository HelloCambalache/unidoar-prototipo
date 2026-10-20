import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { enlaceWhatsapp } from "@/lib/pipeline";
import { CONTACTO_SITIO } from "@/lib/publico";

describe("contacto del sitio", () => {
  it("el email tiene forma de email y no es uno de los buzones que nunca existieron", () => {
    assert.match(CONTACTO_SITIO.email, /^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    assert.ok(!/^(hola|facturacion|no-responder)@unidoar\.com/.test(CONTACTO_SITIO.email), "ese buzón no recibe mails");
  });

  it("el WhatsApp se reconoce como número argentino y arma su enlace wa.me", () => {
    assert.ok(CONTACTO_SITIO.whatsapp, "la tarjeta de WhatsApp de /contacto necesita el número");
    assert.equal(enlaceWhatsapp(CONTACTO_SITIO.whatsapp), "https://wa.me/5491154735876");
  });
});
