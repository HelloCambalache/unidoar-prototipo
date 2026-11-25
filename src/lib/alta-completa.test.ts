import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pasoQueFaltaParaCerrarElAlta, puedeAbrirLaDocumentacionDelAlta, subtituloDeAlta } from "@/lib/alta-completa";

const completo = { telefono: "11 5555-1234", niveles: ["Primario"], disponibilidad: ["Mañana"] };

describe("cuándo se cierra el alta del profesional", () => {
  it("se cierra con teléfono, niveles, horarios y DNI", () => {
    assert.equal(pasoQueFaltaParaCerrarElAlta(completo, "30111222"), null);
  });

  it("sin DNI vuelve al paso 3, avisando que falta", () => {
    assert.equal(pasoQueFaltaParaCerrarElAlta(completo, null), "/onboarding/docente/3?falta=dni");
    assert.equal(pasoQueFaltaParaCerrarElAlta(completo, ""), "/onboarding/docente/3?falta=dni");
  });

  it("sin teléfono vuelve al perfil; sin niveles o sin horarios, al tramo CV → niveles", () => {
    assert.equal(pasoQueFaltaParaCerrarElAlta({ ...completo, telefono: null }, "30111222"), "/onboarding/docente/3");
    assert.equal(pasoQueFaltaParaCerrarElAlta({ ...completo, niveles: [] }, "30111222"), "/onboarding/docente/2");
    assert.equal(pasoQueFaltaParaCerrarElAlta({ ...completo, disponibilidad: [] }, "30111222"), "/onboarding/docente/2");
  });
});

describe("subtítulo del perfil", () => {
  const base = { categoria: "educador" as const, categoriasExtra: [], asignaturas: ["Lengua", "Historia", "Geografía"], subtitulo: null };

  it("junta la categoría y las dos primeras materias", () => {
    assert.equal(subtituloDeAlta(base), "Docente · Lengua, Historia");
  });

  it("sin materias es solo la categoría", () => {
    assert.equal(subtituloDeAlta({ ...base, asignaturas: [] }), "Docente");
  });

  it("respeta el que la persona ya escribió", () => {
    assert.equal(subtituloDeAlta({ ...base, subtitulo: "Profe de Lengua" }), "Profe de Lengua");
  });
});

describe("quién puede abrir la documentación del alta", () => {
  it("quien todavía no terminó el alta, siempre", () => {
    assert.equal(puedeAbrirLaDocumentacionDelAlta({ onboardingCompleto: false, verificacion: "pendiente", suspendido: false }), true);
  });

  it("quien ya la completó, solo mientras espera la revisión", () => {
    assert.equal(puedeAbrirLaDocumentacionDelAlta({ onboardingCompleto: true, verificacion: "pendiente", suspendido: false }), true);
    for (const verificacion of ["verificado", "correccion", "rechazado"]) {
      assert.equal(puedeAbrirLaDocumentacionDelAlta({ onboardingCompleto: true, verificacion, suspendido: false }), false, verificacion);
    }
  });

  it("una cuenta suspendida con el alta completa no", () => {
    assert.equal(puedeAbrirLaDocumentacionDelAlta({ onboardingCompleto: true, verificacion: "pendiente", suspendido: true }), false);
  });
});
