import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { crearTope } from "./tope";

describe("crearTope", () => {
  it("deja pasar hasta el máximo y corta el siguiente", () => {
    const permitir = crearTope(3, 1000);
    assert.equal(permitir("a", 0), true);
    assert.equal(permitir("a", 10), true);
    assert.equal(permitir("a", 20), true);
    assert.equal(permitir("a", 30), false);
  });

  it("cuenta cada clave por separado", () => {
    const permitir = crearTope(1, 1000);
    assert.equal(permitir("a", 0), true);
    assert.equal(permitir("b", 0), true);
    assert.equal(permitir("a", 1), false);
  });

  it("vuelve a dejar pasar cuando los pedidos viejos salen de la ventana", () => {
    const permitir = crearTope(2, 1000);
    assert.equal(permitir("a", 0), true);
    assert.equal(permitir("a", 500), true);
    assert.equal(permitir("a", 900), false);
    // A los 1001 ms ya salió el primero (t = 0) pero no el segundo (t = 500).
    assert.equal(permitir("a", 1001), true);
    assert.equal(permitir("a", 1002), false);
    assert.equal(permitir("a", 1600), true);
  });

  it("un pedido rechazado no se anota: no alarga el castigo", () => {
    const permitir = crearTope(1, 1000);
    assert.equal(permitir("a", 0), true);
    for (let t = 1; t < 900; t += 100) assert.equal(permitir("a", t), false);
    assert.equal(permitir("a", 1001), true);
  });

  it("limpia las claves vencidas cuando el mapa se llena", () => {
    const permitir = crearTope(1, 1000, 3);
    for (const k of ["a", "b", "c", "d"]) assert.equal(permitir(k, 0), true);
    // Con el mapa lleno y todas vencidas, una clave nueva pasa y las viejas también pueden volver.
    assert.equal(permitir("e", 5000), true);
    assert.equal(permitir("a", 5001), true);
  });
});
