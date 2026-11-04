import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SECCIONES_PRIVACIDAD, TITULO_PRIVACIDAD } from "@/lib/privacidad-texto";
import { CONTACTO_SITIO } from "@/lib/publico";
import { partesDeTexto, SECCIONES_TERMINOS, TITULO_TERMINOS, type BloqueTexto, type SeccionLegal } from "@/lib/terminos-texto";

const textosDe = (secciones: SeccionLegal[]): string[] =>
  secciones.flatMap((s) => s.bloques.flatMap((b) => ("p" in b ? [b.p] : b.lista)));
const bloquesDe = (secciones: SeccionLegal[]): BloqueTexto[] => secciones.flatMap((s) => s.bloques);

const DOCUMENTOS = [
  { nombre: "términos y condiciones", secciones: SECCIONES_TERMINOS, numeradas: 25, titulo: TITULO_TERMINOS },
  { nombre: "política de privacidad", secciones: SECCIONES_PRIVACIDAD, numeradas: 19, titulo: TITULO_PRIVACIDAD },
] as const;

for (const d of DOCUMENTOS) {
  describe(`texto de los ${d.nombre}`, () => {
    it(`las ${d.numeradas} secciones están, numeradas en orden, más el cierre de aceptación, y con id único`, () => {
      assert.equal(d.secciones.length, d.numeradas + 1);
      d.secciones.slice(0, d.numeradas).forEach((s, i) => assert.ok(s.titulo.startsWith(`${i + 1}. `), s.titulo));
      assert.ok(!/^\d/.test(d.secciones[d.numeradas]!.titulo), "el cierre no lleva número");
      const ids = d.secciones.map((s) => s.id);
      assert.equal(new Set(ids).size, ids.length);
      assert.ok(ids.every((id) => /^[a-z0-9-]+$/.test(id)));
    });

    it("el título es el del documento, en mayúsculas", () => {
      assert.equal(d.titulo, d.titulo.toUpperCase());
      assert.ok(d.titulo.endsWith("DE UNIDOAR"));
    });

    it("no hay párrafos ni viñetas vacías, ni listas sin elementos", () => {
      for (const b of bloquesDe(d.secciones)) {
        if ("p" in b) assert.ok(b.p.trim().length > 0);
        else {
          assert.ok(b.lista.length > 0);
          assert.ok(b.lista.every((x) => x.trim().length > 0));
        }
      }
    });

    it("las marcas de negrita están balanceadas y nunca quedó un ** suelto", () => {
      for (const t of textosDe(d.secciones)) {
        const sinMarcas = partesDeTexto(t)
          .filter((p) => p.tipo === "texto")
          .map((p) => p.texto)
          .join("");
        assert.ok(!sinMarcas.includes("**"), t.slice(0, 60));
      }
    });

    it("no quedó ningún marcador de borrador del documento en blanco: fecha, versión, renglón del enlace ni cuadro de tildar", () => {
      for (const t of textosDe(d.secciones)) {
        assert.ok(!/\[FECHA\]|\[NÚMERO\]|_{4,}|☐/.test(t), t.slice(0, 60));
      }
    });

    it("los datos de la titular son los del documento y el mail es el de contacto del sitio", () => {
      const todo = textosDe(d.secciones).join("\n");
      assert.ok(todo.includes("Castagnone, Esteban Alejandro"));
      assert.ok(todo.includes("20-18428153-9"));
      assert.ok(todo.includes("Triunvirato 4023, Villa Adelina, Vicente López, Provincia de Buenos Aires"));
      assert.ok(todo.includes(CONTACTO_SITIO.email));
    });

    it("los datos de contacto del cierre van como lista sin viñetas, una línea por dato", () => {
      const contacto = d.secciones[d.numeradas - 1]!;
      const lista = contacto.bloques.find((b): b is Extract<BloqueTexto, { lista: string[] }> => "lista" in b);
      assert.equal(lista?.marcador, "ninguno");
      assert.ok(lista!.lista.some((l) => l.startsWith("CUIT:")));
      assert.ok(lista!.lista.some((l) => l.startsWith("Sitio Web:")));
    });

    it("las listas con letras empiezan en «a» y tienen al menos dos elementos", () => {
      for (const b of bloquesDe(d.secciones)) {
        if ("lista" in b && b.marcador === "letras") assert.ok(b.lista.length >= 2);
      }
    });
  });
}

describe("términos y condiciones: lo puntual", () => {
  it("el documento tiene su cláusula 4 y deja claro que UNIDOAR no es parte de las relaciones entre usuarios, en negrita", () => {
    const destacada = textosDe(SECCIONES_TERMINOS)
      .flatMap((t) => partesDeTexto(t))
      .find((p) => p.tipo === "negrita" && p.texto.startsWith("UNIDOAR NO es parte de las relaciones"));
    assert.ok(destacada);
  });

  it("el cierre de aceptación manda a la política de privacidad con un enlace interno", () => {
    const cierre = SECCIONES_TERMINOS[SECCIONES_TERMINOS.length - 1]!;
    const enlaces = cierre.bloques.flatMap((b) => ("p" in b ? partesDeTexto(b.p) : [])).filter((p) => p.tipo === "enlace");
    assert.deepEqual(enlaces, [{ tipo: "enlace", texto: "aquí", href: "/privacidad" }]);
  });

  it("las obligaciones de docentes e instituciones están como listas con letras", () => {
    for (const n of [7, 8]) {
      const s = SECCIONES_TERMINOS[n - 1]!;
      assert.ok(s.bloques.some((b) => "lista" in b && b.marcador === "letras"), s.titulo);
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
