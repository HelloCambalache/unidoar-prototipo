import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { avisoAlEquipoDeSemestre, esFormaDePago, FORMAS_DE_PAGO, puedePagarSemestre, resumenDeSemestre, textoDeSemestre } from "@/lib/forma-de-pago";
import { planesPorDefecto as P } from "@/lib/planes";

describe("forma de pago del abono", () => {
  it("hay dos: mes a mes y el semestre por adelantado", () => {
    assert.deepEqual([...FORMAS_DE_PAGO], ["mensual", "semestral"]);
  });

  it("solo se acepta una forma conocida (lo que llega del navegador no se cree)", () => {
    assert.equal(esFormaDePago("semestral"), true);
    assert.equal(esFormaDePago("mensual"), true);
    for (const raro of ["anual", "", "constructor", "__proto__", null, undefined, 6, {}]) assert.equal(esFormaDePago(raro), false, String(raro));
  });

  it("el semestre es para los abonos mensuales: no para una sola búsqueda ni para las redes de sedes", () => {
    assert.equal(puedePagarSemestre(P, "colegio"), true);
    assert.equal(puedePagarSemestre(P, "deportiva"), true);
    assert.equal(puedePagarSemestre(P, "puntual"), false);
    assert.equal(puedePagarSemestre(P, "multisede"), false);
  });

  it("calcula el semestre con el pack de Planes: pagás 5 meses de 6", () => {
    const colegio = resumenDeSemestre(P, "colegio", 1);
    assert.deepEqual([colegio.meses, colegio.mesesQueSePagan], [6, 5]);
    assert.equal(colegio.mensual, P.montoDePlan("colegio", 1));
    assert.equal(colegio.total, colegio.mensual * 5);
    assert.equal(colegio.ahorro, colegio.mensual);
  });

  it("suma las sedes adicionales y respeta un precio acordado", () => {
    const dosSedes = resumenDeSemestre(P, "colegio", 2);
    assert.equal(dosSedes.mensual, P.montoDePlan("colegio", 2));
    assert.ok(dosSedes.total > resumenDeSemestre(P, "colegio", 1).total);
    const acordado = resumenDeSemestre(P, "colegio", 1, { modalidad: "total", monto: 100000, plan: "colegio" });
    assert.equal(acordado.mensual, 100000);
    assert.equal(acordado.total, 500000);
  });

  it("el texto dice cuánto se paga y cuánto sería sin el semestre", () => {
    const r = resumenDeSemestre(P, "colegio", 1);
    const texto = textoDeSemestre(r);
    assert.match(texto, /Pagás 5 meses y usás 6/);
    assert.ok(texto.includes(`$`), texto);
  });

  it("el aviso al equipo distingue elegirlo al crear la cuenta de pedirlo después", () => {
    const alCrear = avisoAlEquipoDeSemestre({ alCrearLaCuenta: true, total: 250000, meses: 6 });
    const despues = avisoAlEquipoDeSemestre({ alCrearLaCuenta: false, total: 250000, meses: 6 });
    assert.match(alCrear, /al crear su cuenta/);
    assert.match(alCrear, /verifiques la cuenta/);
    assert.match(despues, /pidió pagar el abono por semestre/);
    assert.doesNotMatch(despues, /al crear su cuenta/);
  });
});
