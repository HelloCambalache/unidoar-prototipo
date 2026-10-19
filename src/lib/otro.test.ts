import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { esDelTipo, MAX_OTRO, opcionYTexto, tiposFijos, valorAlEscribirOtro, valorElegido } from "./otro";

const TIPOS = ["Colegio privado", "Club o gimnasio", "Otro"] as const;

describe("opcionYTexto", () => {
  it("un valor de la lista es esa opción y no lleva texto", () => {
    assert.deepEqual(opcionYTexto("Club o gimnasio", TIPOS), { opcion: "Club o gimnasio", texto: "" });
  });

  it("un valor escrito a mano es la opción Otro con ese texto", () => {
    assert.deepEqual(opcionYTexto("Academia de danza", TIPOS), { opcion: "Otro", texto: "Academia de danza" });
  });

  it("el Otro de siempre (sin texto) queda en Otro para poder completarlo", () => {
    assert.deepEqual(opcionYTexto("Otro", TIPOS), { opcion: "Otro", texto: "" });
  });

  it("sin valor no hay opción elegida", () => {
    assert.deepEqual(opcionYTexto(null, TIPOS), { opcion: "", texto: "" });
    assert.deepEqual(opcionYTexto("   ", TIPOS), { opcion: "", texto: "" });
  });
});

describe("valorElegido", () => {
  it("una opción de la lista se guarda tal cual, aunque venga texto", () => {
    assert.equal(valorElegido("Colegio privado", "lo que sea"), "Colegio privado");
  });

  it("con Otro se guarda lo que escribió, limpio", () => {
    assert.equal(valorElegido("Otro", "  Academia   de danza "), "Academia de danza");
  });

  it("con Otro y sin texto no hay valor: hay que pedirlo", () => {
    assert.equal(valorElegido("Otro", ""), null);
    assert.equal(valorElegido("Otro", "   "), null);
    assert.equal(valorElegido("Otro", undefined), null);
  });

  it("corta lo demasiado largo", () => {
    assert.equal(valorElegido("Otro", "x".repeat(200))?.length, MAX_OTRO);
  });
});

describe("valorAlEscribirOtro", () => {
  it("al borrar todo vuelve a Otro, así el campo no desaparece", () => {
    assert.equal(valorAlEscribirOtro(""), "Otro");
    assert.equal(valorAlEscribirOtro("  "), "Otro");
    assert.equal(valorAlEscribirOtro("Peluquería"), "Peluquería");
  });
});

describe("filtro por tipo de institución", () => {
  it("un tipo de la lista filtra por ese tipo", () => {
    assert.equal(esDelTipo("Club o gimnasio", "Club o gimnasio", TIPOS), true);
    assert.equal(esDelTipo("Colegio privado", "Club o gimnasio", TIPOS), false);
  });

  it("Otro junta a los Otro de siempre y a los escritos a mano", () => {
    assert.equal(esDelTipo("Otro", "Otro", TIPOS), true);
    assert.equal(esDelTipo("Academia de danza", "Otro", TIPOS), true);
    assert.equal(esDelTipo("Colegio privado", "Otro", TIPOS), false);
  });

  it("sin filtro entra todo", () => {
    assert.equal(esDelTipo("Academia de danza", "", TIPOS), true);
  });

  it("tiposFijos saca Otro", () => {
    assert.deepEqual(tiposFijos(TIPOS), ["Colegio privado", "Club o gimnasio"]);
  });
});
