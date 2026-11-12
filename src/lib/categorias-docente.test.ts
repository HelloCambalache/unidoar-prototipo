import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  categoriasDe,
  credencialesQueSePiden,
  decidirCategorias,
  etiquetaDeCategorias,
  tieneCategoria,
} from "./categorias-docente";

describe("categoriasDe", () => {
  it("con una sola categoría es esa", () => {
    assert.deepEqual(categoriasDe({ categoria: "educador" }), ["educador"]);
    assert.deepEqual(categoriasDe({ categoria: "educador", categoriasExtra: [] }), ["educador"]);
    assert.deepEqual(categoriasDe({ categoria: "educador", categoriasExtra: null }), ["educador"]);
  });

  it("la principal va primero y las otras en el orden del catálogo, sin repetir", () => {
    assert.deepEqual(categoriasDe({ categoria: "guardavidas", categoriasExtra: ["entrenador", "educador"] }), [
      "guardavidas",
      "educador",
      "entrenador",
    ]);
    assert.deepEqual(categoriasDe({ categoria: "educador", categoriasExtra: ["educador", "guardavidas"] }), ["educador", "guardavidas"]);
  });
});

describe("tieneCategoria", () => {
  it("mira la principal y las otras", () => {
    const perfil = { categoria: "educador", categoriasExtra: ["guardavidas"] } as const;
    assert.equal(tieneCategoria(perfil, "educador"), true);
    assert.equal(tieneCategoria(perfil, "guardavidas"), true);
    assert.equal(tieneCategoria(perfil, "entrenador"), false);
  });
});

describe("decidirCategorias", () => {
  it("una categoría: es la principal y no hay otras", () => {
    assert.deepEqual(decidirCategorias(["entrenador"]), { ok: true, datos: { categoria: "entrenador", categoriasExtra: [] } });
  });

  it("varias: la principal es la primera del catálogo si no había una", () => {
    const r = decidirCategorias(["guardavidas", "educador"]);
    assert.deepEqual(r, { ok: true, datos: { categoria: "educador", categoriasExtra: ["guardavidas"] } });
  });

  it("conserva la principal que ya tenía si la sigue teniendo", () => {
    const r = decidirCategorias(["educador", "guardavidas"], "guardavidas");
    assert.deepEqual(r, { ok: true, datos: { categoria: "guardavidas", categoriasExtra: ["educador"] } });
  });

  it("si quitó la principal, queda la primera de las que siguen", () => {
    const r = decidirCategorias(["entrenador", "guardavidas"], "educador");
    assert.deepEqual(r, { ok: true, datos: { categoria: "entrenador", categoriasExtra: ["guardavidas"] } });
  });

  it("ignora las repetidas", () => {
    assert.deepEqual(decidirCategorias(["educador", "educador"]), { ok: true, datos: { categoria: "educador", categoriasExtra: [] } });
  });

  it("pide al menos una y rechaza valores que no existen", () => {
    assert.equal(decidirCategorias([]).ok, false);
    assert.equal(decidirCategorias(["educador", "hacker"]).ok, false);
    assert.equal(decidirCategorias([42]).ok, false);
  });
});

describe("etiquetaDeCategorias", () => {
  it("junta los nombres de las categorías", () => {
    assert.equal(etiquetaDeCategorias({ categoria: "educador" }), "Docente");
    assert.equal(etiquetaDeCategorias({ categoria: "educador", categoriasExtra: ["guardavidas"] }), "Docente · Guardavidas");
    assert.equal(etiquetaDeCategorias({ categoria: "educador", categoriasExtra: ["entrenador"] }, "plural"), "Docentes · Entrenadores");
  });
});

describe("credencialesQueSePiden", () => {
  it("con una categoría pide el título de esa categoría", () => {
    assert.equal(credencialesQueSePiden({ categoria: "guardavidas" }).nombre, "Libreta de guardavidas con reválida");
  });

  it("con varias pide uno por categoría y los nombra", () => {
    const c = credencialesQueSePiden({ categoria: "educador", categoriasExtra: ["entrenador", "guardavidas"] });
    assert.equal(c.nombre, "Títulos y credenciales");
    assert.match(c.vacio, /Título profesional, Certificación deportiva y Libreta de guardavidas con reválida/);
  });
});
