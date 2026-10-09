import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { datosDeCuentaSchema, describirAccion } from "./backoffice-instituciones";

describe("datos de la cuenta que edita el equipo", () => {
  it("acepta teléfono, CUIT y CUE, y recorta los espacios", () => {
    const r = datosDeCuentaSchema.parse({ telefono: " +54 11 5555-1234 ", cuit: " 30-12345678-9 ", cue: " 600123 " });
    assert.deepEqual(r, { telefono: "+54 11 5555-1234", cuit: "30-12345678-9", cue: "600123" });
  });

  it("vacío deja el dato sin cargar (null)", () => {
    const r = datosDeCuentaSchema.parse({ telefono: "", cuit: "  ", cue: "" });
    assert.deepEqual(r, { telefono: null, cuit: null, cue: null });
  });

  it("rechaza un teléfono demasiado corto o demasiado largo", () => {
    assert.equal(datosDeCuentaSchema.safeParse({ telefono: "123", cuit: "", cue: "" }).success, false);
    assert.equal(datosDeCuentaSchema.safeParse({ telefono: "1".repeat(41), cuit: "", cue: "" }).success, false);
  });

  it("rechaza un CUIT o CUE que no entra", () => {
    assert.equal(datosDeCuentaSchema.safeParse({ telefono: "", cuit: "1".repeat(21), cue: "" }).success, false);
    assert.equal(datosDeCuentaSchema.safeParse({ telefono: "", cuit: "", cue: "1".repeat(21) }).success, false);
  });
});

describe("actividad del equipo al editar una institución", () => {
  it("el perfil público lista los campos tocados", () => {
    assert.equal(
      describirAccion("institucion.editar_perfil", { campos: ["nombre", "logo"] }),
      "Editó el perfil público · nombre, logo",
    );
  });

  it("los datos de la cuenta también", () => {
    assert.equal(describirAccion("institucion.editar_datos", { campos: ["teléfono"] }), "Editó los datos de la cuenta · teléfono");
  });

  it("un pago registrado muestra el mes, el medio y la nota si la hay", () => {
    assert.equal(describirAccion("factura.pagar", { periodo: "2026-10", medio: "Efectivo", nota: "Recibo 0001" }), "Registró el pago de Octubre 2026 · Efectivo · Recibo 0001");
    assert.equal(describirAccion("factura.pagar", { periodo: "2026-10", medio: "Efectivo" }), "Registró el pago de Octubre 2026 · Efectivo");
    assert.equal(describirAccion("factura.pagar", { periodo: "2026-10" }), "Registró el pago de Octubre 2026");
  });

  it("sin lista de campos no deja un separador colgando", () => {
    assert.equal(describirAccion("institucion.editar_perfil", {}), "Editó el perfil público");
    assert.equal(describirAccion("institucion.editar_perfil", null), "Editó el perfil público");
  });
});
