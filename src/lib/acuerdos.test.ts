import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { acuerdoSchema, describirAcuerdo, describirCambioDeAcuerdo, paraCalcular } from "@/lib/acuerdos";

describe("lo que carga el equipo", () => {
  it("acepta un abono o un convenio con su monto, y la nota es optativa", () => {
    assert.equal(acuerdoSchema.safeParse({ modalidad: "abono", monto: 48_000 }).success, true);
    assert.equal(acuerdoSchema.safeParse({ modalidad: "total", monto: 180_000, nota: "  Red de 6 sedes, acordado con Dirección  " }).success, true);
  });

  it("deja la nota sin espacios y vacía como si no hubiera", () => {
    const con = acuerdoSchema.parse({ modalidad: "abono", monto: 48_000, nota: "  acordado por teléfono  " });
    assert.equal(con.nota, "acordado por teléfono");
    assert.equal(acuerdoSchema.parse({ modalidad: "abono", monto: 48_000, nota: "   " }).nota, undefined);
  });

  it("rechaza lo que no es un monto en pesos enteros o una modalidad inventada", () => {
    for (const malo of [
      { modalidad: "abono", monto: 0 },
      { modalidad: "abono", monto: -100 },
      { modalidad: "abono", monto: 48_000.5 },
      { modalidad: "abono", monto: 99_000_000 },
      { modalidad: "abono", monto: "48000" },
      { modalidad: "gratis", monto: 1 },
      { monto: 48_000 },
      { modalidad: "abono", monto: 48_000, nota: "x".repeat(201) },
    ]) {
      assert.equal(acuerdoSchema.safeParse(malo).success, false, JSON.stringify(malo));
    }
  });
});

describe("del dato guardado a lo que se calcula", () => {
  it("toma modalidad y monto, y deja afuera la nota", () => {
    assert.deepEqual(paraCalcular({ modalidad: "abono", monto: 48_000 }), { modalidad: "abono", monto: 48_000 });
    assert.deepEqual(paraCalcular({ modalidad: "total", monto: 1, nota: "interna" } as { modalidad: string; monto: number }), { modalidad: "total", monto: 1 });
  });

  it("lleva el plan para el que se acordó, si está anotado", () => {
    assert.deepEqual(paraCalcular({ modalidad: "abono", monto: 48_000, plan: "colegio" }), { modalidad: "abono", monto: 48_000, plan: "colegio" });
    assert.deepEqual(paraCalcular({ modalidad: "abono", monto: 48_000, plan: null }), { modalidad: "abono", monto: 48_000 });
  });

  it("una fila rota o ausente es 'sin acuerdo': nunca cobra algo raro", () => {
    assert.equal(paraCalcular(null), null);
    assert.equal(paraCalcular(undefined), null);
    assert.equal(paraCalcular({ modalidad: "otra-cosa", monto: 100 }), null);
  });
});

describe("cómo se cuenta un acuerdo", () => {
  it("lo describe con su monto", () => {
    assert.equal(describirAcuerdo({ modalidad: "abono", monto: 48_000 }), "Abono acordado: $ 48.000 por mes");
    assert.equal(describirAcuerdo({ modalidad: "total", monto: 180_000 }), "Convenio a medida: $ 180.000 por mes (total, sin importar las sedes)");
  });

  it("cuenta el cambio con los montos de antes y de después", () => {
    assert.equal(describirCambioDeAcuerdo(null, { modalidad: "abono", monto: 48_000 }), "precio de lista → abono acordado $ 48.000");
    assert.equal(describirCambioDeAcuerdo({ modalidad: "abono", monto: 48_000 }, { modalidad: "total", monto: 180_000 }), "abono acordado $ 48.000 → convenio $ 180.000");
    assert.equal(describirCambioDeAcuerdo({ modalidad: "total", monto: 180_000 }, null), "convenio $ 180.000 → precio de lista");
  });
});
