import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { filtrarPorNombre } from "@/lib/buscar-por-nombre";

const FILAS = [
  { nombre: "Colegio San Andrés del Norte" },
  { nombre: "Club Atlético Ribera" },
  { nombre: "Instituto Vicente López" },
  { nombre: "Jardín Los Aromos" },
];
const nombres = (xs: { nombre: string }[]) => xs.map((x) => x.nombre);

describe("filtrarPorNombre (la lupa de Cobros)", () => {
  it("sin texto devuelve todas, también con solo espacios", () => {
    assert.equal(filtrarPorNombre(FILAS, "").length, 4);
    assert.equal(filtrarPorNombre(FILAS, "   ").length, 4);
  });

  it("no distingue mayúsculas ni tildes", () => {
    assert.deepEqual(nombres(filtrarPorNombre(FILAS, "SAN ANDRES")), ["Colegio San Andrés del Norte"]);
    assert.deepEqual(nombres(filtrarPorNombre(FILAS, "atletico")), ["Club Atlético Ribera"]);
    assert.deepEqual(nombres(filtrarPorNombre(FILAS, "lopez")), ["Instituto Vicente López"]);
  });

  it("cada palabra tiene que estar, en cualquier orden", () => {
    assert.deepEqual(nombres(filtrarPorNombre(FILAS, "norte andres")), ["Colegio San Andrés del Norte"]);
    assert.deepEqual(filtrarPorNombre(FILAS, "san ribera"), []);
  });

  it("una parte de una palabra alcanza", () => {
    assert.deepEqual(nombres(filtrarPorNombre(FILAS, "arom")), ["Jardín Los Aromos"]);
  });

  it("un texto que no está no trae nada", () => {
    assert.deepEqual(filtrarPorNombre(FILAS, "zzz"), []);
  });

  it("conserva el resto de los datos de cada fila", () => {
    const [f] = filtrarPorNombre([{ nombre: "Club Ribera", id: "x1" }], "ribera");
    assert.equal(f?.id, "x1");
  });
});
