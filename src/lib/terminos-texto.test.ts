import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { partesDeTexto, PREAMBULO_TERMINOS, SECCIONES_TERMINOS, type BloqueTexto } from "@/lib/terminos-texto";

const bloquesDe = (): BloqueTexto[] => SECCIONES_TERMINOS.flatMap((s) => [...s.bloques, ...(s.subsecciones ?? []).flatMap((x) => x.bloques)]);
const textosDe = (): string[] => [
  ...PREAMBULO_TERMINOS,
  ...bloquesDe().flatMap((b) => ("p" in b ? [b.p] : b.lista)),
];

describe("texto de los términos y condiciones", () => {
  it("las diez secciones están, numeradas en orden y con id único", () => {
    assert.equal(SECCIONES_TERMINOS.length, 10);
    SECCIONES_TERMINOS.forEach((s, i) => assert.ok(s.titulo.startsWith(`${i + 1}. `), s.titulo));
    const ids = SECCIONES_TERMINOS.flatMap((s) => [s.id, ...(s.subsecciones ?? []).map((x) => x.id)]);
    assert.equal(new Set(ids).size, ids.length);
    assert.ok(ids.every((id) => /^[a-z0-9-]+$/.test(id)));
  });

  it("la sección 4 tiene sus dos partes (postulantes e instituciones) numeradas 4.1 y 4.2", () => {
    const s4 = SECCIONES_TERMINOS.find((s) => s.id === "tipos-de-usuario");
    assert.deepEqual(s4?.subsecciones?.map((x) => x.titulo.slice(0, 4)), ["4.1.", "4.2."]);
  });

  it("no hay párrafos ni viñetas vacías, ni listas sin elementos", () => {
    for (const b of bloquesDe()) {
      if ("p" in b) assert.ok(b.p.trim().length > 0);
      else {
        assert.ok(b.lista.length > 0);
        assert.ok(b.lista.every((x) => x.trim().length > 0));
      }
    }
  });

  it("las marcas de negrita están balanceadas y nunca quedó un ** suelto", () => {
    for (const t of textosDe()) {
      const sinMarcas = partesDeTexto(t)
        .filter((p) => p.tipo === "texto")
        .map((p) => p.texto)
        .join("");
      assert.ok(!sinMarcas.includes("**"), t.slice(0, 60));
    }
  });

  it("la aclaración de que UNIDOAR no es una agencia de colocación va destacada", () => {
    const destacada = textosDe()
      .flatMap((t) => partesDeTexto(t))
      .find((p) => p.tipo === "negrita" && p.texto.startsWith("UNIDOAR NO ES UNA EMPRESA"));
    assert.ok(destacada);
  });

  it("el texto no quedó con la grafía vieja de la marca ni con el error de «Condiciones General»", () => {
    for (const t of textosDe()) {
      assert.ok(!/\bUnidoar\b/.test(t), t.slice(0, 60));
      assert.ok(!t.includes("Condiciones General de"), t.slice(0, 60));
    }
  });
});

describe("marcas dentro del texto", () => {
  it("separa negrita y enlaces internos del texto común", () => {
    assert.deepEqual(partesDeTexto("a **b** c [d](/privacidad) e"), [
      { tipo: "texto", texto: "a " },
      { tipo: "negrita", texto: "b" },
      { tipo: "texto", texto: " c " },
      { tipo: "enlace", texto: "d", href: "/privacidad" },
      { tipo: "texto", texto: " e" },
    ]);
  });

  it("un texto sin marcas queda entero", () => {
    assert.deepEqual(partesDeTexto("nada especial"), [{ tipo: "texto", texto: "nada especial" }]);
    assert.deepEqual(partesDeTexto(""), []);
  });

  it("solo se hace enlace a rutas internas: un enlace externo o con esquema queda como texto", () => {
    for (const malo of ["[x](https://sitio.com)", "[x](//sitio.com)", "[x](javascript:alert(1))", "[x](mailto:a@b.c)", "[x]( /privacidad)"]) {
      assert.ok(partesDeTexto(malo).every((p) => p.tipo !== "enlace"), malo);
    }
    assert.deepEqual(partesDeTexto("[ok](/privacidad)"), [{ tipo: "enlace", texto: "ok", href: "/privacidad" }]);
  });
});
