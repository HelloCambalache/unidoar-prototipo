import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { explicarVacio } from "@/lib/buscador-vacio";

describe("por qué no se encontró a nadie", () => {
  it("si no hay ningún profesional de esa disciplina en toda la plataforma, lo dice y no culpa a la búsqueda", () => {
    const e = explicarVacio({ disciplinas: ["Hockey"], zonas: ["Olivos"], deLaDisciplina: 0, sinLaZona: 0 });
    assert.equal(e?.tipo, "sin-profesionales-de-la-disciplina");
    assert.match(e!.titulo, /Todavía no hay profesionales de Hockey/);
    assert.match(e!.texto, /publicá una búsqueda/);
  });

  it("esa causa va primero aunque también se haya pedido una zona: sacar la zona no arreglaría nada", () => {
    const e = explicarVacio({ disciplinas: ["Hockey"], zonas: ["Villa Adelina"], deLaDisciplina: 0, sinLaZona: 0 });
    assert.equal(e?.tipo, "sin-profesionales-de-la-disciplina");
  });

  it("si hay de esa disciplina pero ninguno en la zona, dice cuántos hay sin la zona", () => {
    const e = explicarVacio({ disciplinas: ["Inglés"], zonas: ["Olivos"], deLaDisciplina: 5, sinLaZona: 2 });
    assert.equal(e?.tipo, "ninguno-en-la-zona");
    assert.equal(e && "cantidad" in e ? e.cantidad : null, 2);
    assert.match(e!.titulo, /Hay 2 profesionales de Inglés, pero ninguno en Olivos/);
  });

  it("con uno solo habla en singular", () => {
    const e = explicarVacio({ disciplinas: ["Inglés"], zonas: ["Tigre"], deLaDisciplina: 1, sinLaZona: 1 });
    assert.match(e!.titulo, /Hay 1 profesional de Inglés, pero ninguno en Tigre/);
    assert.match(e!.texto, /ver al profesional/);
  });

  it("nombra varias zonas y varias disciplinas con comas y «y»", () => {
    const e = explicarVacio({ disciplinas: ["Inglés", "Francés"], zonas: ["Olivos", "Munro", "Florida"], deLaDisciplina: 4, sinLaZona: 3 });
    assert.match(e!.titulo, /de Inglés y Francés, pero ninguno en Olivos, Munro y Florida/);
  });

  it("solo una zona, sin disciplina: dice cuántos hay en total sin esa zona", () => {
    const e = explicarVacio({ disciplinas: [], zonas: ["Tigre"], deLaDisciplina: null, sinLaZona: 7 });
    assert.equal(e?.tipo, "ninguno-en-la-zona");
    assert.match(e!.titulo, /Hay 7 profesionales, pero ninguno en Tigre/);
  });

  it("sin una causa que se pueda decir (el vacío es por otros filtros), no explica nada y vale el mensaje genérico", () => {
    assert.equal(explicarVacio({ disciplinas: ["Inglés"], zonas: ["Olivos"], deLaDisciplina: 5, sinLaZona: 0 }), null);
    assert.equal(explicarVacio({ disciplinas: [], zonas: [], deLaDisciplina: null, sinLaZona: null }), null);
    assert.equal(explicarVacio({ disciplinas: ["Inglés"], zonas: [], deLaDisciplina: 5, sinLaZona: null }), null);
  });
});
