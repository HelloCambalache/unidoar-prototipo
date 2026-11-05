import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ID_DE_RESULTADOS, filtrosDelPanel, resumenDeResultados } from "./filtros-celular";

const sinFiltros = { categoria: null, disciplinas: [], zonas: [], disponibilidad: [] };

describe("filtros del panel en el celular", () => {
  it("sin nada elegido no hay filtros puestos", () => {
    assert.equal(filtrosDelPanel(sinFiltros), 0);
  });

  it("cuenta la categoría, cada subcategoría, cada zona y cada disponibilidad", () => {
    assert.equal(filtrosDelPanel({ ...sinFiltros, categoria: "educador" }), 1);
    assert.equal(filtrosDelPanel({ ...sinFiltros, disciplinas: ["Inglés", "Natación"] }), 2);
    assert.equal(filtrosDelPanel({ ...sinFiltros, zonas: ["Tigre"], disponibilidad: ["Mañana", "Tarde"] }), 3);
    assert.equal(
      filtrosDelPanel({ categoria: "entrenador", disciplinas: ["Hockey"], zonas: ["Pilar", "Tigre"], disponibilidad: ["Noche"] }),
      5,
    );
  });

  it("el pie dice cuántos profesionales hay, en singular y plural, o que no hay ninguno", () => {
    assert.equal(resumenDeResultados(0), "Sin resultados con estos filtros");
    assert.equal(resumenDeResultados(-1), "Sin resultados con estos filtros");
    assert.equal(resumenDeResultados(1), "1 profesional");
    assert.equal(resumenDeResultados(2), "2 profesionales");
    assert.equal(resumenDeResultados(29), "29 profesionales");
  });

  it("el destino de «Continuar» es un id válido de HTML (sin espacios)", () => {
    assert.match(ID_DE_RESULTADOS, /^[A-Za-z][\w-]*$/);
  });
});
