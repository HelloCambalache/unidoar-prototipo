import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ERROR_DE_NUMERO, puedeRecibirAvisos, validarNumeroDeAvisos } from "./consentimiento";

describe("número para recibir avisos", () => {
  it("acepta un celular argentino escrito de cualquier forma y lo deja en formato internacional", () => {
    for (const escrito of ["11 5473-5876", "011 15 5473-5876", "+54 9 11 5473-5876"]) {
      assert.deepEqual(validarNumeroDeAvisos(escrito), { ok: true, numero: "5491154735876", clave: "1154735876" }, escrito);
    }
  });

  it("rechaza lo que no es un celular argentino con un mensaje que dice cómo escribirlo", () => {
    for (const escrito of ["", "hola", "123", "+1 555 147 2782", null, undefined]) {
      assert.deepEqual(validarNumeroDeAvisos(escrito), { ok: false, error: ERROR_DE_NUMERO }, String(escrito));
    }
    assert.match(ERROR_DE_NUMERO, /característica/);
  });
});

describe("quién puede recibir avisos", () => {
  const activo = { bajaEn: null, clave: "1154735876" };

  it("con consentimiento activo y para el mismo número, sí", () => {
    assert.equal(puedeRecibirAvisos(activo, "5491154735876"), true);
    assert.equal(puedeRecibirAvisos(activo, "541154735876"), true, "el mismo número sin el 9 es el mismo número");
  });

  it("sin consentimiento, con la baja dada o sin nada, no", () => {
    assert.equal(puedeRecibirAvisos(null, "5491154735876"), false);
    assert.equal(puedeRecibirAvisos(undefined, "5491154735876"), false);
    assert.equal(puedeRecibirAvisos({ ...activo, bajaEn: new Date() }, "5491154735876"), false);
  });

  it("si la persona cambió de número, un aviso anotado para el viejo no sale", () => {
    assert.equal(puedeRecibirAvisos({ bajaEn: null, clave: "1166667777" }, "5491154735876"), false);
  });

  it("un destino que no es un número argentino no sale", () => {
    assert.equal(puedeRecibirAvisos(activo, "15551472782"), false);
    assert.equal(puedeRecibirAvisos(activo, ""), false);
  });
});
