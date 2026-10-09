import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  decidirEstudios,
  documentoDeEstudios,
  esEstudiante,
  etiquetaDeEstudiante,
  leerPorcentaje,
  situacionDeEstudio,
} from "@/lib/estudiantes";

describe("porcentaje de materias aprobadas", () => {
  it("lee un número entero, con o sin el signo %", () => {
    for (const [texto, esperado] of [["80", 80], ["80%", 80], [" 80 % ", 80], ["0", 0], ["100", 100], ["07", 7], [65, 65]] as const) {
      assert.deepEqual(leerPorcentaje(texto), { ok: true, valor: esperado }, String(texto));
    }
  });

  it("pide el dato si está vacío", () => {
    for (const vacio of ["", "   ", undefined, null]) {
      const r = leerPorcentaje(vacio);
      assert.equal(r.ok, false);
      assert.ok(!r.ok && r.error.includes("porcentaje"));
    }
  });

  it("rechaza lo que no es un entero entre 0 y 100", () => {
    for (const malo of ["101", "-5", "80,5", "80.5", "ochenta", "8 0", "1000", "%", "50%%", "NaN", "1e2"]) {
      assert.equal(leerPorcentaje(malo).ok, false, malo);
    }
    assert.equal(leerPorcentaje(100.5).ok, false);
  });
});

describe("cómo se presenta quien todavía estudia", () => {
  it("la etiqueta lleva el porcentaje si lo hay", () => {
    assert.equal(etiquetaDeEstudiante(80), "Estudiante · 80 % de la carrera");
    assert.equal(etiquetaDeEstudiante(0), "Estudiante · 0 % de la carrera");
    assert.equal(etiquetaDeEstudiante(null), "Estudiante");
    assert.equal(etiquetaDeEstudiante(undefined), "Estudiante");
  });

  it("solo «estudiante» es estudiante: lo demás (incluido null de cuentas viejas) cuenta como recibido", () => {
    assert.equal(esEstudiante("estudiante"), true);
    for (const v of ["recibido", "", null, undefined, "Estudiante"]) assert.equal(esEstudiante(v), false, String(v));
  });

  it("el estudiante presenta la constancia y quien se recibió, el título", () => {
    assert.equal(documentoDeEstudios("estudiante"), "constancia");
    assert.equal(documentoDeEstudios("recibido"), "credencial");
    assert.equal(documentoDeEstudios(null), "credencial");
  });
});

describe("cambiar los estudios desde Mi perfil", () => {
  const base = { actual: "estudiante", pedida: undefined, porcentaje: "60", verificacion: "pendiente" } as const;

  it("lo guardado se lee siempre como una de las dos opciones", () => {
    assert.equal(situacionDeEstudio("estudiante"), "estudiante");
    for (const v of ["recibido", null, undefined, "otra"]) assert.equal(situacionDeEstudio(v), "recibido", String(v));
  });

  it("quien sigue estudiando declara y actualiza el porcentaje, también con el perfil verificado", () => {
    assert.deepEqual(decidirEstudios(base), { ok: true, situacion: "estudiante", porcentaje: 60 });
    assert.deepEqual(decidirEstudios({ ...base, verificacion: "verificado", porcentaje: "75 %" }), { ok: true, situacion: "estudiante", porcentaje: 75 });
  });

  it("sin porcentaje válido no se guarda a un estudiante", () => {
    for (const porcentaje of ["", undefined, "150", "mucho"]) {
      const r = decidirEstudios({ ...base, porcentaje });
      assert.equal(r.ok, false, String(porcentaje));
      assert.ok(!r.ok && r.campo === "porcentajeMaterias");
    }
  });

  it("quien se recibe deja de tener porcentaje, esté o no verificado", () => {
    for (const verificacion of ["pendiente", "correccion", "verificado"] as const) {
      assert.deepEqual(decidirEstudios({ ...base, pedida: "recibido", porcentaje: "90", verificacion }), { ok: true, situacion: "recibido", porcentaje: null });
    }
  });

  it("quien ya estaba recibido no necesita porcentaje", () => {
    assert.deepEqual(decidirEstudios({ ...base, actual: null, pedida: undefined, porcentaje: undefined }), { ok: true, situacion: "recibido", porcentaje: null });
  });

  it("pasar de recibido a estudiante solo vale si el perfil todavía no está verificado", () => {
    const vuelve = { ...base, actual: "recibido", pedida: "estudiante" } as const;
    assert.deepEqual(decidirEstudios({ ...vuelve, verificacion: "pendiente" }), { ok: true, situacion: "estudiante", porcentaje: 60 });
    const r = decidirEstudios({ ...vuelve, verificacion: "verificado" });
    assert.equal(r.ok, false);
    assert.ok(!r.ok && r.campo === "situacionEstudio");
  });

  it("con la verificación rechazada no se cambia la situación desde el perfil", () => {
    assert.equal(decidirEstudios({ ...base, pedida: "recibido", verificacion: "rechazado" }).ok, false);
    assert.equal(decidirEstudios({ ...base, actual: "recibido", pedida: "estudiante", verificacion: "rechazado" }).ok, false);
    // Confirmar lo que ya figura no es un cambio.
    assert.equal(decidirEstudios({ ...base, pedida: "estudiante", verificacion: "rechazado" }).ok, true);
  });
});
