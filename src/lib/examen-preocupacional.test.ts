import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MAX_ARCHIVOS_EXAMEN,
  archivosDeExamen,
  nombreVisibleDeArchivo,
  puedeAdjuntarAlExamen,
  sumarArchivoDeExamen,
} from "./examen-preocupacional";
import { esPathPrivadoPropio } from "./subidas";
import { objetoDeArchivo, patronDePaths } from "./archivos";

const USUARIO = "3f2a9c1e-5b7d-4e8a-9c01-2d3e4f5a6b7c";
const path = (n: number) => `${USUARIO}/examenes/00000000-0000-4000-8000-00000000000${n}.pdf`;

describe("archivos del examen preocupacional", () => {
  it("se pueden adjuntar mientras la persona está en el examen o ya contratada, y no en otras etapas", () => {
    assert.equal(puedeAdjuntarAlExamen("examen_preocupacional"), true);
    assert.equal(puedeAdjuntarAlExamen("contratado"), true);
    for (const etapa of ["nuevos", "preseleccionados", "entrevista", "oferta", "descartado"] as const) {
      assert.equal(puedeAdjuntarAlExamen(etapa), false, etapa);
    }
  });

  it("el nombre se muestra sin rutas ni caracteres raros, y si no hay nombre se usa el del archivo", () => {
    assert.equal(nombreVisibleDeArchivo("  Estudio  médico.pdf ", path(1)), "Estudio médico.pdf");
    assert.equal(nombreVisibleDeArchivo("..\\..\\secreto/examen.pdf", path(1)), ".. .. secreto examen.pdf");
    assert.equal(nombreVisibleDeArchivo("a\u0000b\nc.pdf", path(1)), "abc.pdf");
    assert.equal(nombreVisibleDeArchivo("x".repeat(300), path(1)).length, 120);
    assert.equal(nombreVisibleDeArchivo("", path(1)), "00000000-0000-4000-8000-000000000001.pdf");
    assert.equal(nombreVisibleDeArchivo(undefined, path(2)), "00000000-0000-4000-8000-000000000002.pdf");
  });

  it("lo guardado en la base se lee sin romperse con datos raros", () => {
    assert.deepEqual(archivosDeExamen([{ path: path(1), nombre: "a.pdf" }]), [{ path: path(1), nombre: "a.pdf" }]);
    assert.deepEqual(archivosDeExamen(null), []);
    assert.deepEqual(archivosDeExamen("[]"), []);
    assert.deepEqual(archivosDeExamen([{ path: 1, nombre: "a" }, null, { nombre: "x" }, { path: "", nombre: "b" }]), []);
  });

  it("suma un archivo sin repetirlo y con tope", () => {
    const uno = sumarArchivoDeExamen([], { path: path(1), nombre: "a.pdf" });
    assert.deepEqual(uno, { ok: true, lista: [{ path: path(1), nombre: "a.pdf" }] });
    // El mismo path dos veces no duplica.
    assert.deepEqual(sumarArchivoDeExamen(uno.ok ? uno.lista : [], { path: path(1), nombre: "otro nombre.pdf" }), uno);

    let lista = Array.from({ length: MAX_ARCHIVOS_EXAMEN }, (_, i) => ({ path: path(i), nombre: `${i}.pdf` }));
    const lleno = sumarArchivoDeExamen(lista, { path: path(9), nombre: "9.pdf" });
    assert.equal(lleno.ok, false);
    lista = lista.slice(1);
    assert.equal(sumarArchivoDeExamen(lista, { path: path(9), nombre: "9.pdf" }).ok, true);
  });

  it("la acción solo acepta archivos de la propia cuenta, de la carpeta de exámenes", () => {
    assert.equal(esPathPrivadoPropio(path(1), USUARIO, "examenes"), true);
    assert.equal(esPathPrivadoPropio(path(1), "otra-cuenta", "examenes"), false);
    assert.equal(esPathPrivadoPropio(`${USUARIO}/documentos/x.pdf`, USUARIO, "examenes"), false);
    assert.equal(esPathPrivadoPropio(`${USUARIO}/examenes/../cv/x.pdf`, USUARIO, "examenes"), false);
    assert.equal(esPathPrivadoPropio(`${USUARIO}/subidas/x.pdf`, USUARIO, "examenes"), false);
  });

  it("la limpieza de Storage reconoce la carpeta de exámenes (si no, la tomaría por huérfana o la ignoraría)", () => {
    assert.deepEqual(objetoDeArchivo(path(1)), { bucket: "privado", path: path(1) });
    assert.match(path(1), new RegExp(patronDePaths()));
  });
});
