import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { busquedaSchema } from "./catalogo";
import { avisoDeBusquedasSinPostulaciones, plural } from "./busquedas";

describe("aviso de búsquedas que no reciben postulaciones", () => {
  it("sin vencidas ni pausadas no dice nada", () => {
    assert.equal(avisoDeBusquedasSinPostulaciones(0, 0), null);
  });

  it("cuenta las vencidas sin cerrar, en singular y en plural", () => {
    assert.equal(avisoDeBusquedasSinPostulaciones(1, 0), "1 vencida sin cerrar");
    assert.equal(avisoDeBusquedasSinPostulaciones(3, 0), "3 vencidas sin cerrar");
  });

  it("cuenta las pausadas", () => {
    assert.equal(avisoDeBusquedasSinPostulaciones(0, 1), "1 pausada");
    assert.equal(avisoDeBusquedasSinPostulaciones(0, 2), "2 pausadas");
  });

  it("junta las dos", () => {
    assert.equal(avisoDeBusquedasSinPostulaciones(1, 2), "1 vencida sin cerrar · 2 pausadas");
  });
});

describe("plural", () => {
  it("usa el singular solo con uno", () => {
    assert.equal(plural(1, "postulante", "postulantes"), "1 postulante");
    assert.equal(plural(0, "postulante", "postulantes"), "0 postulantes");
    assert.equal(plural(5, "postulante", "postulantes"), "5 postulantes");
  });
});

describe("la descripción de una búsqueda es obligatoria", () => {
  const base = { puesto: "Profe de Matemática", categoria: "educador", disciplina: "Matemática", tipo: "Titular" };

  it("sin descripción, o con solo espacios, no pasa", () => {
    assert.equal(busquedaSchema.safeParse({ ...base }).success, false);
    assert.equal(busquedaSchema.safeParse({ ...base, descripcion: "" }).success, false);
    assert.equal(busquedaSchema.safeParse({ ...base, descripcion: "         " }).success, false);
  });

  it("una sola palabra suelta tampoco: pide contar en qué consiste el cargo", () => {
    const r = busquedaSchema.safeParse({ ...base, descripcion: "Mate" });
    assert.equal(r.success, false);
    assert.match(r.error?.issues[0]?.message ?? "", /Contá en qué consiste/);
  });

  it("con una descripción real pasa y se recorta", () => {
    const r = busquedaSchema.safeParse({ ...base, descripcion: "  Dos cursos de 4° año, turno mañana.  " });
    assert.equal(r.success, true);
    assert.equal(r.data?.descripcion, "Dos cursos de 4° año, turno mañana.");
  });
});
