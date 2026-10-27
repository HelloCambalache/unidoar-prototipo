import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { enlaceWhatsapp } from "@/lib/pipeline";
import { CONTACTO_SITIO, logosEnMovimiento, MINIMO_PARA_TIRA_EN_MOVIMIENTO } from "@/lib/publico";

describe("tira de logos de la portada", () => {
  it("con pocas fundadoras se muestran quietas, sin repetir ninguna; con varias, corre", () => {
    assert.equal(logosEnMovimiento(1), false, "una sola no se repite nueve veces para llenar el ancho");
    assert.equal(logosEnMovimiento(MINIMO_PARA_TIRA_EN_MOVIMIENTO - 1), false);
    assert.equal(logosEnMovimiento(MINIMO_PARA_TIRA_EN_MOVIMIENTO), true);
    assert.equal(logosEnMovimiento(24), true);
  });
});

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
