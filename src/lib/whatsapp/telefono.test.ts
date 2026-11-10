import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { claveDeNumero, numeroEnmascarado, numeroParaWhatsapp } from "./telefono";

describe("número para WhatsApp", () => {
  it("un celular argentino escrito de cualquier forma da el mismo número internacional", () => {
    for (const escrito of ["11 5473-5876", "011 15 5473-5876", "+54 9 11 5473-5876", "(011) 15-5473 5876", "5491154735876", "1154735876"]) {
      assert.equal(numeroParaWhatsapp(escrito), "5491154735876", escrito);
    }
  });

  it("una característica de 3 dígitos también se reconoce", () => {
    assert.equal(numeroParaWhatsapp("0351 15 612 3456"), "5493516123456");
  });

  it("lo que no es un celular argentino se rechaza", () => {
    for (const escrito of ["", "   ", "abc", "123", "+1 555 147 2782", "11 5473", null, undefined]) {
      assert.equal(numeroParaWhatsapp(escrito), null, String(escrito));
    }
  });
});

describe("clave de un número (para saber si dos son el mismo)", () => {
  it("con o sin el 9 y con o sin el 54 da los mismos 10 dígitos", () => {
    for (const n of ["5491154735876", "541154735876", "1154735876", "+54 9 11 5473-5876"]) {
      assert.equal(claveDeNumero(n), "1154735876", n);
    }
  });

  it("lo que no tiene la forma de un número argentino no tiene clave", () => {
    for (const n of ["", "123", "15551472782", "+1 555 147 2782", null, undefined]) {
      assert.equal(claveDeNumero(n), null, String(n));
    }
  });
});

describe("número enmascarado", () => {
  it("deja solo los últimos 4 dígitos", () => {
    assert.equal(numeroEnmascarado("5491154735876"), "••• 5876");
    assert.equal(numeroEnmascarado("12"), "•••");
    assert.equal(numeroEnmascarado(null), "•••");
  });
});
