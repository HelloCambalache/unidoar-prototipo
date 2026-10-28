import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { interpretarBusqueda, type VocabularioBusqueda } from "@/lib/busqueda-ia";
import { hrefBuscador, hrefFrase, leerFiltros } from "@/lib/filtros-docentes";

const VOCABULARIO: VocabularioBusqueda = {
  disciplinas: ["Inglés", "Música", "Natación", "Matemática"],
  zonas: ["Olivos", "Tigre", "Palermo"],
};

/** Lo que hace la pantalla: interpreta lo escrito en `q` y se lo pasa a `leerFiltros` junto con la URL. */
const leer = (sp: Record<string, string>) => leerFiltros(sp, sp.q ? interpretarBusqueda(sp.q, VOCABULARIO) : null);

describe("el buscador único de profesionales (lo escrito en ?q=)", () => {
  it("un nombre no pide filtros: se busca como texto por nombre o disciplina", () => {
    const f = leer({ q: "Ana Pérez" });
    assert.equal(f.texto, "Ana Pérez");
    assert.equal(f.frase, "Ana Pérez");
    assert.deepEqual(f.disciplinas, []);
  });

  it("una disciplina del catálogo es un filtro, no texto", () => {
    const f = leer({ q: "natación" });
    assert.deepEqual(f.disciplinas, ["Natación"]);
    assert.equal(f.texto, "");
  });

  it("una frase con varias condiciones es un pedido: filtros y nada de texto", () => {
    const f = leer({ q: "profe de inglés para secundario en olivos" });
    assert.deepEqual(f.disciplinas, ["Inglés"]);
    assert.deepEqual(f.zonas, ["Olivos"]);
    assert.equal(f.nivel, "Secundario");
    assert.equal(f.texto, "");
  });

  it("un filtro y un nombre juntos: 'inglés Pérez' filtra por inglés y busca a Pérez", () => {
    const f = leer({ q: "inglés Pérez" });
    assert.deepEqual(f.disciplinas, ["Inglés"]);
    assert.equal(f.texto, "Pérez");
    assert.equal(leer({ q: "ingles perez" }).texto, "perez");
  });

  it("al tocar un filtro después, el nombre de la frase no se pierde: pasa a la URL", () => {
    const f = leer({ q: "inglés Pérez" });
    const volver = new URL(hrefBuscador("/institucion/buscar-docentes", f, { soloVerificados: true }), "https://x.test").searchParams;
    assert.equal(volver.get("texto"), "Pérez");
    assert.deepEqual(volver.getAll("disc"), ["Inglés"]);
  });

  it("puro relleno no busca nada", () => {
    assert.equal(leer({ q: "hola, necesito un profe" }).texto, "");
  });

  it("después de tocar un filtro (f=1) manda la URL: el texto sale de ?texto=, no de volver a leer la frase", () => {
    assert.equal(leer({ q: "Ana Pérez", f: "1" }).texto, "");
    assert.equal(leer({ q: "Ana Pérez", f: "1", texto: "Ana Pérez" }).texto, "Ana Pérez");
  });

  it("un texto de un enlace de antes (sin frase) se sigue leyendo", () => {
    const f = leer({ texto: "natación", f: "1" });
    assert.equal(f.texto, "natación");
    assert.equal(f.frase, "");
  });

  it("al tocar un filtro el texto de la frase pasa a la URL y no se pierde", () => {
    const f = leer({ q: "Ana Pérez" });
    const href = hrefBuscador("/institucion/buscar-docentes", f, { soloVerificados: true });
    const volver = new URL(href, "https://ejemplo.test").searchParams;
    assert.equal(volver.get("texto"), "Ana Pérez");
    assert.equal(volver.get("verif"), "1");
    assert.equal(volver.get("f"), "1");
    // Y al leer esa URL, lo que se ve es lo mismo.
    const otra = leer(Object.fromEntries(volver));
    assert.equal(otra.texto, "Ana Pérez");
    assert.equal(otra.soloVerificados, true);
  });

  it("una frase nueva arranca de cero: solo viaja la frase", () => {
    assert.equal(hrefFrase("/institucion/buscar-docentes", "Ana Pérez", null), "/institucion/buscar-docentes?q=Ana+P%C3%A9rez");
  });
});
