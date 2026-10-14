import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { esCuitValido, esDniValido, formatearCuit, soloDigitos } from "./documentos";

describe("esDniValido", () => {
  it("acepta 7 u 8 números, con o sin puntos", () => {
    assert.equal(esDniValido("12345678"), true);
    assert.equal(esDniValido("12.345.678"), true);
    assert.equal(esDniValido("5123456"), true);
    assert.equal(esDniValido(" 33 445 566 "), true);
  });

  it("rechaza menos de 7, más de 8 y letras", () => {
    assert.equal(esDniValido("123456"), false);
    assert.equal(esDniValido("123456789"), false);
    assert.equal(esDniValido("1234567a"), false);
    assert.equal(esDniValido(""), false);
  });
});

describe("esCuitValido", () => {
  it("acepta CUIT y CUIL con el dígito verificador correcto, con o sin guiones", () => {
    assert.equal(esCuitValido("20-12345678-6"), true);
    assert.equal(esCuitValido("20123456786"), true);
    assert.equal(esCuitValido("30-71234567-1"), true);
    // Resto 0 → dígito verificador 0.
    assert.equal(esCuitValido("27-12345678-0"), true);
  });

  it("rechaza un dígito verificador equivocado", () => {
    assert.equal(esCuitValido("20-12345678-5"), false);
    assert.equal(esCuitValido("30-71234567-9"), false);
  });

  it("rechaza la cantidad equivocada de números y las letras", () => {
    assert.equal(esCuitValido("20-1234567-6"), false);
    assert.equal(esCuitValido("20-123456789-6"), false);
    assert.equal(esCuitValido("20-1234567a-6"), false);
    assert.equal(esCuitValido(""), false);
  });

  it("un número cuyo resto da 10 no es válido con ningún dígito", () => {
    // Se busca una base de 10 números cuya suma ponderada deje resto 1 (el dígito sería 10, que no existe).
    const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
    let base = "";
    for (let n = 2000000000; n < 2000000100 && !base; n++) {
      const suma = String(n).split("").reduce((t, d, i) => t + Number(d) * pesos[i]!, 0);
      if (suma % 11 === 1) base = String(n);
    }
    assert.notEqual(base, "");
    for (let d = 0; d <= 9; d++) assert.equal(esCuitValido(`${base}${d}`), false);
  });
});

describe("formatearCuit y soloDigitos", () => {
  it("pone los guiones donde van", () => {
    assert.equal(formatearCuit("30712345671"), "30-71234567-1");
    assert.equal(formatearCuit("30-71234567-1"), "30-71234567-1");
    assert.equal(formatearCuit(" 30 71234567 1 "), "30-71234567-1");
  });

  it("soloDigitos saca espacios, puntos y guiones y deja lo demás", () => {
    assert.equal(soloDigitos("12.345-678 "), "12345678");
    assert.equal(soloDigitos("12a45"), "12a45");
  });
});
