import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sugerirDescripcion, sugerirPuesto, sugerirRequisitos, type DatosParaRedactar } from "@/lib/redaccion-busqueda";

const base: DatosParaRedactar = {
  categoria: "educador",
  disciplina: "Inglés",
  nivel: "Secundario",
  tipo: "Titular",
  cargaHoraria: "",
  turno: "",
  fechaInicio: "",
  zona: "",
};

describe("título del puesto", () => {
  it("arma el título según la categoría", () => {
    assert.equal(sugerirPuesto(base), "Profe de Inglés — Secundario");
    assert.equal(sugerirPuesto({ ...base, categoria: "entrenador", disciplina: "Natación", nivel: "" }), "Entrenador/a de Natación");
    assert.equal(sugerirPuesto({ ...base, categoria: "guardavidas", disciplina: "Pileta cubierta", nivel: "Secundario" }), "Guardavidas — Pileta cubierta");
  });

  it("indica el tipo cuando no es un cargo titular", () => {
    assert.equal(sugerirPuesto({ ...base, tipo: "Suplencia" }), "Profe de Inglés — Secundario (suplencia)");
    assert.equal(sugerirPuesto({ ...base, tipo: "Suplencia rápida", nivel: "" }), "Profe de Inglés (suplencia urgente)");
    assert.equal(sugerirPuesto({ ...base, tipo: "Temporada" }), "Profe de Inglés — Secundario (temporada)");
  });

  it("no dice 'Profe de' de un puesto que ya lo es", () => {
    assert.equal(sugerirPuesto({ ...base, disciplina: "Apoyo escolar", nivel: "Primario" }), "Apoyo escolar — Primario");
    assert.equal(sugerirPuesto({ ...base, disciplina: "Maestro/a de grado", nivel: "" }), "Maestro/a de grado");
  });

  it("sin disciplina no sugiere nada", () => {
    assert.equal(sugerirPuesto({ ...base, disciplina: "  " }), "");
    assert.equal(sugerirDescripcion({ ...base, disciplina: "" }), "");
    assert.equal(sugerirRequisitos({ ...base, disciplina: "" }), "");
  });
});

describe("descripción", () => {
  it("usa solo lo que se completó", () => {
    assert.equal(sugerirDescripcion(base), "Buscamos profesor/a de Inglés para nivel secundario. Es un cargo titular. Si te interesa, postulate desde UNIDOAR.");
  });

  it("suma carga, turno, inicio y zona cuando están", () => {
    const texto = sugerirDescripcion({
      ...base,
      tipo: "Suplencia",
      cargaHoraria: "18 hs semanales",
      turno: "Mañana",
      fechaInicio: "2027-03-10",
      zona: " Villa  Adelina, Vicente López ",
    });
    assert.equal(
      texto,
      "Buscamos profesor/a de Inglés para nivel secundario. Es una suplencia. La carga horaria es de 18 hs semanales. Se trabaja en turno mañana. La fecha de inicio es el 10 de marzo de 2027. Zona de trabajo: Villa Adelina, Vicente López. Si te interesa, postulate desde UNIDOAR.",
    );
  });

  it("una fecha mal formada no se inventa", () => {
    assert.ok(!sugerirDescripcion({ ...base, fechaInicio: "mañana" }).includes("fecha de inicio"));
  });

  it("no promete nada que no se cargó: ni beneficios ni sueldo", () => {
    const texto = sugerirDescripcion({ ...base, cargaHoraria: "18 hs" }).toLowerCase();
    for (const palabra of ["sueldo", "beneficio", "salario", "$"]) assert.ok(!texto.includes(palabra), palabra);
  });

  it("guardavidas y entrenadores tienen su propia redacción", () => {
    assert.ok(sugerirDescripcion({ ...base, categoria: "guardavidas", disciplina: "Pileta cubierta", turno: "Fin de semana" }).startsWith("Buscamos guardavidas para pileta cubierta."));
    assert.ok(sugerirDescripcion({ ...base, categoria: "entrenador", disciplina: "Fútbol", nivel: "" }).startsWith("Buscamos entrenador/a de Fútbol."));
  });
});

describe("requisitos", () => {
  it("son los habituales de cada categoría, uno por línea", () => {
    assert.equal(sugerirRequisitos(base), "Título docente o en trámite\nExperiencia en nivel secundario");
    assert.equal(sugerirRequisitos({ ...base, categoria: "guardavidas", disciplina: "Playa" }), "Título de guardavidas vigente\nCurso de RCP y primeros auxilios al día");
    assert.equal(sugerirRequisitos({ ...base, categoria: "entrenador", disciplina: "Tenis" }), "Título o certificación en Tenis\nExperiencia dictando clases o entrenando grupos");
  });
});
