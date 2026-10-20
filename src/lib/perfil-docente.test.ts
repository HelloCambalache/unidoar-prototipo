import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cambiaElNombre, identidadFija, puedePostularse, sinArchivosDeDni } from "./perfil-docente";

describe("fotos del DNI al verificar", () => {
  it("separa las dos fotos del DNI y deja el resto de la documentación", () => {
    const r = sinArchivosDeDni({ dniFrente: "u/documentos/a.jpg", dniDorso: "u/documentos/b.jpg", credencial: "u/documentos/c.pdf", conducta: "u/documentos/d.pdf" });
    assert.deepEqual(r.archivos, ["u/documentos/a.jpg", "u/documentos/b.jpg"]);
    assert.deepEqual(r.restantes, { credencial: "u/documentos/c.pdf", conducta: "u/documentos/d.pdf" });
  });

  it("si solo hay una foto (o ninguna) no inventa nada", () => {
    assert.deepEqual(sinArchivosDeDni({ dniFrente: "u/documentos/a.jpg" }), { restantes: {}, archivos: ["u/documentos/a.jpg"] });
    assert.deepEqual(sinArchivosDeDni({ credencial: "u/documentos/c.pdf" }), { restantes: { credencial: "u/documentos/c.pdf" }, archivos: [] });
    assert.deepEqual(sinArchivosDeDni({}), { restantes: {}, archivos: [] });
  });

  it("un valor vacío no cuenta como archivo", () => {
    assert.deepEqual(sinArchivosDeDni({ dniFrente: "", dniDorso: "u/documentos/b.jpg" }).archivos, ["u/documentos/b.jpg"]);
  });

  it("no modifica el objeto original", () => {
    const original = { dniFrente: "u/documentos/a.jpg", credencial: "u/documentos/c.pdf" };
    sinArchivosDeDni(original);
    assert.deepEqual(original, { dniFrente: "u/documentos/a.jpg", credencial: "u/documentos/c.pdf" });
  });
});

describe("identidad fija (nombre y apellido)", () => {
  it("solo queda fija cuando la verificación está hecha", () => {
    assert.equal(identidadFija({ verificacion: "verificado" }), true);
    assert.equal(identidadFija({ verificacion: "pendiente" }), false);
    assert.equal(identidadFija({ verificacion: "correccion" }), false);
    assert.equal(identidadFija({ verificacion: "rechazado" }), false);
  });
});

describe("cambio de nombre y apellido", () => {
  const guardado = { nombre: "Luciana", apellido: "Prieto" };

  it("lo igual no cambia, aunque sobren espacios", () => {
    assert.equal(cambiaElNombre(guardado, { nombre: "Luciana", apellido: "Prieto" }), false);
    assert.equal(cambiaElNombre({ nombre: "Luciana ", apellido: " Prieto" }, { nombre: "Luciana", apellido: "Prieto" }), false);
  });

  it("detecta un cambio en el nombre o en el apellido", () => {
    assert.equal(cambiaElNombre(guardado, { nombre: "Lucía", apellido: "Prieto" }), true);
    assert.equal(cambiaElNombre(guardado, { nombre: "Luciana", apellido: "Prieto Gómez" }), true);
  });

  it("distingue mayúsculas: es el nombre del documento", () => {
    assert.equal(cambiaElNombre(guardado, { nombre: "luciana", apellido: "Prieto" }), true);
  });
});

describe("postularse con la verificación rechazada", () => {
  it("solo el rechazado queda afuera", () => {
    assert.equal(puedePostularse("rechazado"), false);
    for (const v of ["pendiente", "verificado", "correccion", "revision"]) assert.equal(puedePostularse(v), true, v);
  });
});
