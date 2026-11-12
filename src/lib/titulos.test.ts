import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  cantidadDeTitulos,
  casillasAbiertas,
  compactarTitulos,
  esClaveDeTitulo,
  etiquetaDeCasilla,
  MAX_TITULOS,
  mismosDocumentos,
  sumaUnTitulo,
  titulosDe,
} from "./titulos";

describe("titulosDe", () => {
  it("lista los títulos cargados, en orden de casilla", () => {
    const docs = { dniFrente: "a/dni.jpg", credencial: "a/t1.pdf", credencial3: "a/t3.pdf" };
    assert.deepEqual(titulosDe(docs), [
      { clave: "credencial", path: "a/t1.pdf" },
      { clave: "credencial3", path: "a/t3.pdf" },
    ]);
    assert.equal(cantidadDeTitulos(docs), 2);
  });

  it("ignora casillas vacías o en blanco y lo que no es un título", () => {
    assert.deepEqual(titulosDe({ credencial: "", credencial2: "  ", conducta: "a/c.pdf" }), []);
  });
});

describe("esClaveDeTitulo", () => {
  it("reconoce las cinco casillas y nada más", () => {
    for (const k of ["credencial", "credencial2", "credencial3", "credencial4", "credencial5"]) assert.equal(esClaveDeTitulo(k), true, k);
    for (const k of ["credencial6", "constancia", "dniFrente", "", "toString"]) assert.equal(esClaveDeTitulo(k), false, k);
    assert.equal(MAX_TITULOS, 5);
  });
});

describe("compactarTitulos", () => {
  it("sin huecos: si se quitó el primero, el segundo pasa a ser el primero", () => {
    const r = compactarTitulos({ credencial2: "a/t2.pdf", credencial4: "a/t4.pdf", conducta: "a/c.pdf" });
    assert.deepEqual(r, { credencial: "a/t2.pdf", credencial2: "a/t4.pdf", conducta: "a/c.pdf" });
  });

  it("no toca lo que ya está acomodado ni las otras claves, y no modifica el original", () => {
    const original = { credencial: "a/t1.pdf", credencial2: "a/t2.pdf", dniFrente: "a/d.jpg" };
    const r = compactarTitulos(original);
    assert.deepEqual(r, original);
    assert.notEqual(r, original);
    const conHueco = { credencial: "a/t1.pdf", credencial3: "a/t3.pdf" };
    compactarTitulos(conHueco);
    assert.deepEqual(conHueco, { credencial: "a/t1.pdf", credencial3: "a/t3.pdf" });
  });

  it("sin títulos no deja ninguna casilla", () => {
    assert.deepEqual(compactarTitulos({ credencial: "", conducta: "a/c.pdf" }), { conducta: "a/c.pdf" });
  });
});

describe("casillasAbiertas", () => {
  it("al menos una, y hasta la última con archivo", () => {
    assert.equal(casillasAbiertas({}), 1);
    assert.equal(casillasAbiertas({ credencial: "a" }), 1);
    assert.equal(casillasAbiertas({ credencial: "a", credencial2: "b" }), 2);
    assert.equal(casillasAbiertas({ credencial: "a", credencial4: "d" }), 4);
  });
});

describe("etiquetaDeCasilla", () => {
  it("con un solo título usa el nombre de la categoría; con varios, los numera", () => {
    assert.equal(etiquetaDeCasilla(0, 1, "Título profesional"), "Título profesional");
    assert.equal(etiquetaDeCasilla(0, 2, "Título profesional"), "Título o credencial 1");
    assert.equal(etiquetaDeCasilla(1, 2, "Título profesional"), "Título o credencial 2");
  });
});

describe("sumaUnTitulo", () => {
  it("solo es sumar si la casilla estaba vacía y viene un archivo", () => {
    assert.equal(sumaUnTitulo("credencial2", false, "a/t.pdf"), true);
    assert.equal(sumaUnTitulo("credencial2", true, "a/otro.pdf"), false);
    assert.equal(sumaUnTitulo("credencial2", true, ""), false);
    assert.equal(sumaUnTitulo("credencial2", false, ""), false);
    assert.equal(sumaUnTitulo("conducta", false, "a/c.pdf"), false);
  });
});

describe("mismosDocumentos", () => {
  it("compara claves y archivos, y una clave vacía es como una ausente", () => {
    assert.equal(mismosDocumentos({ credencial: "a" }, { credencial: "a" }), true);
    assert.equal(mismosDocumentos({ credencial: "a" }, { credencial: "b" }), false);
    assert.equal(mismosDocumentos({ credencial: "a" }, { credencial: "a", conducta: "c" }), false);
    assert.equal(mismosDocumentos({ credencial: "a", conducta: "" }, { credencial: "a" }), true);
    // Quitar el primer título y acomodar el segundo en su lugar sí es un cambio.
    assert.equal(mismosDocumentos({ credencial: "a", credencial2: "b" }, { credencial: "b" }), false);
  });
});
