import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { datosDeCuentaSchema, describirAccion } from "./backoffice-instituciones";

describe("datos de la cuenta que edita el equipo", () => {
  it("acepta teléfono y CUIT, y recorta los espacios", () => {
    const r = datosDeCuentaSchema.parse({ telefono: " +54 11 5555-1234 ", cuit: " 30-71234567-1 " });
    assert.deepEqual(r, { telefono: "+54 11 5555-1234", cuit: "30-71234567-1" });
  });

  it("guarda el CUIT con guiones aunque lo escriban pegado", () => {
    assert.equal(datosDeCuentaSchema.parse({ telefono: "", cuit: "30712345671" }).cuit, "30-71234567-1");
  });

  it("rechaza un CUIT con el dígito verificador equivocado o de otra longitud", () => {
    assert.equal(datosDeCuentaSchema.safeParse({ telefono: "", cuit: "30-71234567-9" }).success, false);
    assert.equal(datosDeCuentaSchema.safeParse({ telefono: "", cuit: "30-7123456-1" }).success, false);
  });

  it("vacío deja el dato sin cargar (null)", () => {
    const r = datosDeCuentaSchema.parse({ telefono: "", cuit: "  " });
    assert.deepEqual(r, { telefono: null, cuit: null });
  });

  it("rechaza un teléfono demasiado corto o demasiado largo", () => {
    assert.equal(datosDeCuentaSchema.safeParse({ telefono: "123", cuit: "" }).success, false);
    assert.equal(datosDeCuentaSchema.safeParse({ telefono: "1".repeat(41), cuit: "" }).success, false);
  });

  it("rechaza un CUIT que no entra", () => {
    assert.equal(datosDeCuentaSchema.safeParse({ telefono: "", cuit: "1".repeat(21) }).success, false);
  });

  it("el CUE ya no es de la cuenta: es de cada sede y no pasa por acá", () => {
    const r = datosDeCuentaSchema.parse({ telefono: "", cuit: "", cue: "600123" });
    assert.ok(!("cue" in r));
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

  it("las sedes también, con los nombres de lo que cambió", () => {
    assert.equal(describirAccion("institucion.editar_sedes", { campos: ["sedes agregadas", "CUE de sede"] }), "Editó las sedes · sedes agregadas, CUE de sede");
  });

  it("un pago registrado muestra el mes, el medio y la nota si la hay", () => {
    assert.equal(describirAccion("factura.pagar", { periodo: "2026-10", medio: "Efectivo", nota: "Recibo 0001" }), "Registró el pago de Octubre 2026 · Efectivo · Recibo 0001");
    assert.equal(describirAccion("factura.pagar", { periodo: "2026-10", medio: "Efectivo" }), "Registró el pago de Octubre 2026 · Efectivo");
    assert.equal(describirAccion("factura.pagar", { periodo: "2026-10" }), "Registró el pago de Octubre 2026");
    assert.equal(
      describirAccion("factura.pagar", { periodo: "2026-10", medio: "Transferencia", mesesCubiertos: 6 }),
      "Registró el pago de 6 meses (octubre 2026 a marzo 2027) · Transferencia",
    );
    assert.equal(describirAccion("factura.pagar", { periodo: "2026-10", mesesCubiertos: 1 }), "Registró el pago de Octubre 2026");
  });

  it("el beneficio de referidos dice cómo se aplicó: meses bonificados o pack (lo anterior no lo decía)", () => {
    assert.equal(
      describirAccion("referido.beneficio_aplicado", { nombre: "Colegio Norte", tipo: "meses", meses: 2 }),
      "Aplicó el beneficio de referidos por recomendar a Colegio Norte · 2 meses bonificados",
    );
    assert.equal(
      describirAccion("referido.beneficio_aplicado", { nombre: "Colegio Norte", tipo: "meses", meses: 1 }),
      "Aplicó el beneficio de referidos por recomendar a Colegio Norte · 1 mes bonificado",
    );
    assert.equal(
      describirAccion("referido.beneficio_aplicado", { nombre: "Colegio Norte", tipo: "pack" }),
      "Aplicó el beneficio de referidos por recomendar a Colegio Norte · pack por adelantado",
    );
    assert.equal(describirAccion("referido.beneficio_aplicado", { nombre: "Colegio Norte" }), "Aplicó el beneficio de referidos por recomendar a Colegio Norte");
    assert.equal(describirAccion("referido.beneficio_deshecho", { nombre: "Colegio Norte", tipo: "meses" }), "Deshizo el beneficio de referidos por recomendar a Colegio Norte");
  });

  it("un mes bonificado dice si se factura o si hay que devolver el cobro; y la devolución, el mes y el monto", () => {
    assert.equal(describirAccion("referido.mes_bonificado", { periodo: "2026-11", conDebito: false }), "Se bonificó Noviembre 2026 por recomendar (sin facturar)");
    assert.equal(
      describirAccion("referido.mes_bonificado", { periodo: "2026-11", conDebito: true }),
      "Se bonificó Noviembre 2026 por recomendar (a devolver desde Mercado Pago)",
    );
    assert.equal(describirAccion("referido.devolucion_hecha", { periodo: "2026-11", monto: 50_000 }), "Devolvió el cobro bonificado de Noviembre 2026 · $ 50.000");
    assert.equal(describirAccion("referido.devolucion_hecha", { periodo: "2026-11" }), "Devolvió el cobro bonificado de Noviembre 2026");
    assert.equal(describirAccion("referido.devolucion_deshecha", { periodo: "2026-11" }), "Desmarcó la devolución del cobro de Noviembre 2026");
  });

  it("el pago de una búsqueda puntual muestra el monto, el medio y la nota; y anularlo, el motivo", () => {
    assert.equal(
      describirAccion("busqueda_puntual.pago", { monto: 110_000, medio: "Transferencia", nota: "Comprobante 55" }),
      "Registró el pago de una búsqueda puntual · $ 110.000 · Transferencia · Comprobante 55",
    );
    assert.equal(describirAccion("busqueda_puntual.pago", {}), "Registró el pago de una búsqueda puntual");
    assert.equal(describirAccion("busqueda_puntual.anular_pago", { motivo: "Se pagó dos veces" }), "Anuló el pago de una búsqueda puntual · Se pagó dos veces");
    assert.equal(describirAccion("busqueda_puntual.anular_pago", {}), "Anuló el pago de una búsqueda puntual");
  });

  it("cuenta el precio acordado con los montos de antes y de después, sin la nota", () => {
    assert.equal(
      describirAccion("institucion.precio_acordado", { antes: null, despues: { modalidad: "abono", monto: 48_000 }, nota: "secreta" }),
      "Cambió el precio acordado: precio de lista → abono acordado $ 48.000",
    );
    assert.equal(
      describirAccion("institucion.precio_acordado", { antes: { modalidad: "total", monto: 180_000 }, despues: null }),
      "Cambió el precio acordado: convenio $ 180.000 → precio de lista",
    );
    assert.equal(describirAccion("institucion.precio_acordado", null), "Cambió el precio acordado: precio de lista → precio de lista", "un detalle roto no rompe la lectura");
  });

  it("sin lista de campos no deja un separador colgando", () => {
    assert.equal(describirAccion("institucion.editar_perfil", {}), "Editó el perfil público");
    assert.equal(describirAccion("institucion.editar_perfil", null), "Editó el perfil público");
  });
});
