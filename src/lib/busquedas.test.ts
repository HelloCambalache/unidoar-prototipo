import assert from "node:assert/strict";
import { describe, it } from "node:test";
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
