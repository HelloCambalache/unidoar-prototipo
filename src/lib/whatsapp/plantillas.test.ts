import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  IDIOMA_DE_PLANTILLAS,
  MAX_CARACTERES_POR_VALOR,
  PLANTILLAS_WA,
  cargaDeLaPlantilla,
  datosDeAviso,
  esPlantillaDeWhatsapp,
  limpiarValor,
  rutaDeBoton,
  textoDeAviso,
  variablesDelCuerpo,
  type NombreDePlantilla,
} from "./plantillas";

const nombres = Object.keys(PLANTILLAS_WA) as NombreDePlantilla[];

describe("las plantillas cumplen las reglas de Meta", () => {
  for (const nombre of nombres) {
    const p = PLANTILLAS_WA[nombre];

    it(`${nombre}: el nombre usa solo minúsculas, números y guion bajo, y coincide con su clave`, () => {
      assert.match(p.nombre, /^[a-z0-9_]{1,512}$/);
      assert.equal(p.nombre, nombre);
    });

    it(`${nombre}: las variables van en orden 1, 2, 3… y hay un nombre y un ejemplo para cada una`, () => {
      const usadas = variablesDelCuerpo(p.cuerpo);
      assert.deepEqual(usadas, usadas.map((_, i) => i + 1), "sin saltos ni repetidas");
      assert.equal(usadas.length, p.variables.length);
      assert.equal(p.ejemplos.length, p.variables.length);
      assert.ok(p.ejemplos.every((e) => e.trim() !== ""));
    });

    it(`${nombre}: el cuerpo no empieza ni termina con una variable y entra en el máximo`, () => {
      assert.doesNotMatch(p.cuerpo.trim(), /^\{\{/, "empieza con una variable");
      assert.doesNotMatch(p.cuerpo.trim(), /\}\}[.!?]?$/, "termina con una variable");
      // Con cada valor en su largo máximo, el mensaje tiene que seguir entrando en los 1024 caracteres del cuerpo.
      const lleno = textoDeAviso(nombre, p.variables.map(() => "x".repeat(MAX_CARACTERES_POR_VALOR)));
      assert.ok(lleno.length <= 1024, `${lleno.length} caracteres`);
    });

    it(`${nombre}: el cuerpo no tiene saltos de línea ni espacios de más y el botón tiene un texto corto`, () => {
      assert.doesNotMatch(p.cuerpo, /\n|\t| {2,}/);
      assert.ok(p.boton.texto.length > 0 && p.boton.texto.length <= 25);
      assert.doesNotThrow(() => rutaDeBoton(p.boton.ejemploDeRuta));
    });

    it(`${nombre}: suena a aviso de algo que la persona ya hizo y no a publicidad`, () => {
      assert.doesNotMatch(p.cuerpo, /oferta especial|descuento|promoci|gratis|aprovech/i);
    });
  }

  it("hay plantillas para los dos tipos de destinatario", () => {
    assert.ok(nombres.some((n) => PLANTILLAS_WA[n].destinatario === "docente"));
    assert.ok(nombres.some((n) => PLANTILLAS_WA[n].destinatario === "institucion"));
  });

  it("el idioma es español de Argentina", () => {
    assert.equal(IDIOMA_DE_PLANTILLAS, "es_AR");
  });

  it("solo existen los nombres de la lista (los heredados de Object no)", () => {
    for (const n of ["constructor", "toString", "__proto__", "hasOwnProperty"]) assert.equal(esPlantillaDeWhatsapp(n), false, n);
    assert.equal(esPlantillaDeWhatsapp("unidoar_oferta"), true);
  });
});

describe("limpiar un valor", () => {
  it("junta los espacios y saca saltos de línea y tabulaciones (Meta los rechaza)", () => {
    assert.equal(limpiarValor("  Profe de\n\nInglés \t Nivel   Inicial  "), "Profe de Inglés Nivel Inicial");
  });

  it("recorta lo muy largo con puntos suspensivos y no pasa del máximo", () => {
    const largo = limpiarValor("Profesor de Educación Física y Deportes para el Nivel Secundario Superior con orientación en natación");
    assert.ok(largo.length <= MAX_CARACTERES_POR_VALOR);
    assert.ok(largo.endsWith("…"));
  });

  it("un valor vacío no viaja vacío (Meta lo rechaza)", () => {
    assert.equal(limpiarValor(""), "—");
    assert.equal(limpiarValor("   "), "—");
    assert.equal(limpiarValor(null, "Sin dato"), "Sin dato");
  });
});

describe("ruta del botón", () => {
  it("queda relativa y sin barra al principio", () => {
    assert.equal(rutaDeBoton("/docente/postulaciones?abrir=abc"), "docente/postulaciones?abrir=abc");
    assert.equal(rutaDeBoton("institucion/postulantes?busqueda=1"), "institucion/postulantes?busqueda=1");
  });

  it("rechaza lo que no es una ruta del sitio", () => {
    for (const mala of ["", "/", "https://otro.com/x", "javascript:alert(1)", "../secreto", "a b", "a#b", "x\ny", "a".repeat(201)]) {
      assert.throws(() => rutaDeBoton(mala), /no es válida/, mala);
    }
  });
});

describe("armar un aviso", () => {
  it("valida cuántos valores lleva la plantilla y los limpia", () => {
    const d = datosDeAviso("unidoar_oferta", ["Colegio  San Andrés", "Profe\nde Inglés"], "/docente/postulaciones?abrir=1");
    assert.deepEqual(d, { variables: ["Colegio San Andrés", "Profe de Inglés"], ruta: "docente/postulaciones?abrir=1" });
    assert.throws(() => datosDeAviso("unidoar_oferta", ["uno solo"], "/x"));
    assert.throws(() => datosDeAviso("unidoar_oferta", ["a", "b", "c"], "/x"));
  });

  it("el texto sale con las variables puestas", () => {
    const d = datosDeAviso("unidoar_entrevista", ["Colegio San Andrés", "Ed. Física", "martes 12, 15:30"], "/docente/postulaciones?abrir=1");
    assert.equal(
      textoDeAviso("unidoar_entrevista", d.variables),
      "Tenés una entrevista con Colegio San Andrés para el puesto «Ed. Física»: martes 12, 15:30. Entrá a UNIDOAR para confirmar si podés ir.",
    );
  });

  it("el pedido a Meta lleva el nombre, el idioma, los valores del cuerpo y la ruta del botón", () => {
    const d = datosDeAviso("unidoar_postulantes", ["Ed. Física"], "/institucion/postulantes?busqueda=9");
    assert.deepEqual(cargaDeLaPlantilla("unidoar_postulantes", d), {
      name: "unidoar_postulantes",
      language: { code: "es_AR" },
      components: [
        { type: "body", parameters: [{ type: "text", text: "Ed. Física" }] },
        { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: "institucion/postulantes?busqueda=9" }] },
      ],
    });
  });
});
