import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { acuerdoRigeEn, acuerdoSchema, describirAcuerdo, describirCambioDeAcuerdo, errorDeHasta, paraCalcular, textoDeFin } from "@/lib/acuerdos";

describe("lo que carga el equipo", () => {
  it("acepta un abono o un convenio con su monto, y la nota es optativa", () => {
    assert.equal(acuerdoSchema.safeParse({ modalidad: "abono", monto: 48_000 }).success, true);
    assert.equal(acuerdoSchema.safeParse({ modalidad: "total", monto: 180_000, nota: "  Red de 6 sedes, acordado con Dirección  " }).success, true);
  });

  it("acepta un monto de cero: la institución no paga nada (sin cargo)", () => {
    assert.equal(acuerdoSchema.safeParse({ modalidad: "total", monto: 0 }).success, true);
    assert.equal(acuerdoSchema.safeParse({ modalidad: "abono", monto: 0 }).success, true);
  });

  it("deja la nota sin espacios y vacía como si no hubiera", () => {
    const con = acuerdoSchema.parse({ modalidad: "abono", monto: 48_000, nota: "  acordado por teléfono  " });
    assert.equal(con.nota, "acordado por teléfono");
    assert.equal(acuerdoSchema.parse({ modalidad: "abono", monto: 48_000, nota: "   " }).nota, undefined);
  });

  it("rechaza lo que no es un monto en pesos enteros o una modalidad inventada", () => {
    for (const malo of [
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

  it("el fin del acuerdo es un mes («2026-12») o nada: vacío significa sin fecha de fin", () => {
    assert.equal(acuerdoSchema.parse({ modalidad: "total", monto: 0, hasta: "2026-12" }).hasta, "2026-12");
    assert.equal(acuerdoSchema.parse({ modalidad: "total", monto: 0, hasta: "  2027-01 " }).hasta, "2027-01");
    assert.equal(acuerdoSchema.parse({ modalidad: "total", monto: 0, hasta: "" }).hasta, undefined);
    assert.equal(acuerdoSchema.parse({ modalidad: "total", monto: 0 }).hasta, undefined);
    for (const malo of ["2026-13", "2026-00", "diciembre", "2026-1", "2026-12-31", "26-12"]) {
      assert.equal(acuerdoSchema.safeParse({ modalidad: "total", monto: 0, hasta: malo }).success, false, malo);
    }
  });
});

describe("cuándo rige un acuerdo", () => {
  it("sin fecha de fin rige siempre; con una, hasta ese mes inclusive", () => {
    assert.equal(acuerdoRigeEn(null, "2030-01"), true);
    assert.equal(acuerdoRigeEn(undefined, "2030-01"), true);
    assert.equal(acuerdoRigeEn("2026-12", "2026-11"), true);
    assert.equal(acuerdoRigeEn("2026-12", "2026-12"), true, "el último mes todavía rige");
    assert.equal(acuerdoRigeEn("2026-12", "2027-01"), false);
  });

  it("el fin no puede ser un mes que ya pasó", () => {
    assert.equal(errorDeHasta(undefined, "2026-11"), null);
    assert.equal(errorDeHasta("2026-11", "2026-11"), null, "este mes sirve");
    assert.equal(errorDeHasta("2027-03", "2026-11"), null);
    assert.match(errorDeHasta("2026-10", "2026-11")!, /ya pasó/);
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

  it("un monto de cero es un acuerdo válido (sin cargo), no una fila rota", () => {
    assert.deepEqual(paraCalcular({ modalidad: "total", monto: 0 }), { modalidad: "total", monto: 0 });
  });

  it("lleva el fin si lo tiene, y con un período un acuerdo que ya terminó deja de contar", () => {
    const fila = { modalidad: "total", monto: 0, plan: "colegio", hasta: "2026-12" };
    assert.deepEqual(paraCalcular(fila), { modalidad: "total", monto: 0, plan: "colegio", hasta: "2026-12" }, "sin período no se mira la fecha");
    assert.deepEqual(paraCalcular(fila, "2026-11"), { modalidad: "total", monto: 0, plan: "colegio", hasta: "2026-12" });
    assert.deepEqual(paraCalcular(fila, "2026-12"), { modalidad: "total", monto: 0, plan: "colegio", hasta: "2026-12" }, "el último mes todavía rige");
    assert.equal(paraCalcular(fila, "2027-01"), null, "terminó: vuelve el precio de lista");
    // Sin fecha de fin rige con cualquier período.
    assert.deepEqual(paraCalcular({ modalidad: "total", monto: 0 }, "2040-01"), { modalidad: "total", monto: 0 });
  });
});

describe("cómo se cuenta un acuerdo", () => {
  it("lo describe con su monto", () => {
    assert.equal(describirAcuerdo({ modalidad: "abono", monto: 48_000 }), "Abono acordado: $ 48.000 por mes");
    assert.equal(describirAcuerdo({ modalidad: "total", monto: 180_000 }), "Convenio a medida: $ 180.000 por mes (total, sin importar las sedes)");
  });

  it("dice «sin cargo» con monto cero, y hasta cuándo cuando tiene un fin", () => {
    assert.equal(describirAcuerdo({ modalidad: "total", monto: 0 }), "Sin cargo");
    assert.equal(describirAcuerdo({ modalidad: "total", monto: 0, hasta: "2026-12" }), "Sin cargo hasta diciembre 2026");
    assert.equal(describirAcuerdo({ modalidad: "abono", monto: 20_000, hasta: "2027-03" }), "Abono acordado: $ 20.000 por mes, hasta marzo 2027");
    assert.equal(textoDeFin(null), "");
    assert.equal(textoDeFin("2026-12"), "hasta diciembre 2026");
  });

  it("cuenta el cambio con los montos de antes y de después", () => {
    assert.equal(describirCambioDeAcuerdo(null, { modalidad: "abono", monto: 48_000 }), "precio de lista → abono acordado $ 48.000");
    assert.equal(describirCambioDeAcuerdo({ modalidad: "abono", monto: 48_000 }, { modalidad: "total", monto: 180_000 }), "abono acordado $ 48.000 → convenio $ 180.000");
    assert.equal(describirCambioDeAcuerdo({ modalidad: "total", monto: 180_000 }, null), "convenio $ 180.000 → precio de lista");
  });

  it("cuenta un período sin cargo en el cambio", () => {
    assert.equal(describirCambioDeAcuerdo(null, { modalidad: "total", monto: 0, hasta: "2026-12" }), "precio de lista → sin cargo hasta diciembre 2026");
    assert.equal(describirCambioDeAcuerdo({ modalidad: "total", monto: 0 }, null), "sin cargo → precio de lista");
  });
});
