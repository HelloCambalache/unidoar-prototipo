import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mover, teclaDelMenu } from "./combo";

describe("mover en el menú de opciones", () => {
  it("flecha abajo avanza de a una y se frena en la última", () => {
    assert.equal(mover(-1, 3, "abajo"), 0);
    assert.equal(mover(0, 3, "abajo"), 1);
    assert.equal(mover(2, 3, "abajo"), 2);
  });

  it("flecha arriba retrocede y desde la primera vuelve al campo", () => {
    assert.equal(mover(2, 3, "arriba"), 1);
    assert.equal(mover(0, 3, "arriba"), -1);
    assert.equal(mover(-1, 3, "arriba"), -1);
  });

  it("sin opciones no hay nada que resaltar", () => {
    assert.equal(mover(-1, 0, "abajo"), -1);
    assert.equal(mover(0, 0, "arriba"), -1);
  });
});

describe("qué hace cada tecla con el menú abierto", () => {
  it("las flechas mueven y frenan el desplazamiento de la página", () => {
    assert.deepEqual(teclaDelMenu("ArrowDown", -1, 3), { accion: "mover-abajo", frenar: true });
    assert.deepEqual(teclaDelMenu("ArrowUp", 1, 3), { accion: "mover-arriba", frenar: true });
  });

  it("Enter elige la opción resaltada y no envía el formulario", () => {
    assert.deepEqual(teclaDelMenu("Enter", 1, 3), { accion: "elegir", frenar: true });
  });

  it("Enter sin ninguna resaltada deja que el formulario se envíe", () => {
    assert.deepEqual(teclaDelMenu("Enter", -1, 3), { accion: "nada", frenar: false });
    assert.deepEqual(teclaDelMenu("Enter", 3, 3), { accion: "nada", frenar: false });
  });

  it("Escape cierra el menú y frena que se cierre lo de afuera", () => {
    assert.deepEqual(teclaDelMenu("Escape", -1, 3), { accion: "cerrar", frenar: true });
  });

  it("cualquier otra tecla sigue escribiendo", () => {
    assert.deepEqual(teclaDelMenu("a", -1, 3), { accion: "nada", frenar: false });
  });
});
