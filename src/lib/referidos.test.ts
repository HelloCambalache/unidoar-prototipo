import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  beneficioDeReferido,
  estadoDeReferido,
  generarCodigo,
  LARGO_DEL_CODIGO,
  normalizarCodigo,
  puedeAplicarBeneficio,
  puedeDeshacerBeneficio,
  resumenDeReferidos,
  rutaDeReferido,
  sePuedeAnotar,
  textoParaRecomendar,
} from "./referidos";

describe("estado de un referido", () => {
  it("recién registrada, todavía sin verificar", () => {
    assert.equal(estadoDeReferido({ verificada: false, beneficioEn: null }), "registrada");
  });

  it("se vuelve verificada cuando el equipo verifica a la institución recomendada, sin tocar nada más", () => {
    assert.equal(estadoDeReferido({ verificada: true, beneficioEn: null }), "verificada");
  });

  it("con el beneficio aplicado queda así, aunque después se le quite la verificación", () => {
    assert.equal(estadoDeReferido({ verificada: true, beneficioEn: new Date() }), "beneficio");
    assert.equal(estadoDeReferido({ verificada: false, beneficioEn: "2026-10-19T12:00:00Z" }), "beneficio");
  });
});

describe("qué puede hacer el equipo", () => {
  it("solo se aplica el beneficio de una verificada", () => {
    assert.equal(puedeAplicarBeneficio("verificada"), true);
    assert.equal(puedeAplicarBeneficio("registrada"), false);
    assert.equal(puedeAplicarBeneficio("beneficio"), false);
  });

  it("solo se deshace uno ya aplicado", () => {
    assert.equal(puedeDeshacerBeneficio("beneficio"), true);
    assert.equal(puedeDeshacerBeneficio("verificada"), false);
  });
});

describe("resumen de referidos", () => {
  it("cuenta cada paso y lo que espera al equipo", () => {
    const r = resumenDeReferidos(["registrada", "verificada", "verificada", "beneficio"]);
    assert.deepEqual(r, { total: 4, registradas: 1, verificadas: 2, conBeneficio: 1, paraAplicar: 2 });
  });

  it("sin referidos, todo en cero", () => {
    assert.deepEqual(resumenDeReferidos([]), { total: 0, registradas: 0, verificadas: 0, conBeneficio: 0, paraAplicar: 0 });
  });
});

describe("códigos de referido", () => {
  it("se generan con el largo justo y sin letras que se confunden", () => {
    let n = 0;
    const codigo = generarCodigo((max) => n++ % max);
    assert.equal(codigo.length, LARGO_DEL_CODIGO);
    assert.doesNotMatch(codigo, /[01ILO]/);
    assert.notEqual(normalizarCodigo(codigo), null);
  });

  it("cualquier código generado se reconoce como válido", () => {
    for (let i = 0; i < 200; i++) assert.notEqual(normalizarCodigo(generarCodigo((max) => Math.floor(Math.random() * max))), null);
  });

  it("al normalizar sube a mayúsculas y saca los espacios", () => {
    assert.equal(normalizarCodigo("  k7m2xq9d "), "K7M2XQ9D");
  });

  it("lo que no tiene la forma de un código no pasa", () => {
    assert.equal(normalizarCodigo(""), null);
    assert.equal(normalizarCodigo(null), null);
    assert.equal(normalizarCodigo("K7M2XQ9"), null); // corto
    assert.equal(normalizarCodigo("K7M2XQ9DD"), null); // largo
    assert.equal(normalizarCodigo("K7M2XQ90"), null); // 0 no existe
    assert.equal(normalizarCodigo("../etc/pw"), null);
    assert.equal(normalizarCodigo("K7M2 XQ9D"), null);
  });

  it("la ruta del enlace lleva el código", () => {
    assert.equal(rutaDeReferido("K7M2XQ9D"), "/referido/K7M2XQ9D");
  });

  it("el texto para recomendar lleva el enlace al final", () => {
    assert.match(textoParaRecomendar("https://www.unidoar.com.ar/referido/K7M2XQ9D"), /UNIDOAR.*https:\/\/www\.unidoar\.com\.ar\/referido\/K7M2XQ9D$/);
  });
});

describe("el beneficio sale de las condiciones del pack", () => {
  it("con los valores de lanzamiento: 6 meses, se pagan 5 y con referido 4", () => {
    assert.deepEqual(beneficioDeReferido({ meses: 6, mesesQueSePagan: 5, mesesConReferido: 4 }), {
      pagaConReferido: 4,
      pagaSinReferido: 5,
      mesesDelPack: 6,
      mesesDeMenos: 1,
    });
  });
});

describe("quién se puede recomendar", () => {
  const a = { id: "a", propietarioId: "u1" };
  it("una institución distinta, de otra persona, sí", () => {
    assert.equal(sePuedeAnotar(a, { id: "b", propietarioId: "u2" }), true);
  });

  it("nunca a sí misma", () => {
    assert.equal(sePuedeAnotar(a, a), false);
  });

  it("ni a otra institución de la misma persona", () => {
    assert.equal(sePuedeAnotar(a, { id: "b", propietarioId: "u1" }), false);
  });

  it("si no se conoce a la dueña de alguna, se anota (el equipo la revisa al verificar)", () => {
    assert.equal(sePuedeAnotar({ id: "a", propietarioId: null }, { id: "b", propietarioId: null }), true);
  });
});
