import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  estadoDeMes,
  ETIQUETA_DE_MES,
  gastoDelCobro,
  mesesBonificadosTexto,
  mesesTexto,
  motivoParaNoDeshacer,
  puedeBonificarMeses,
  resumenDeMeses,
  TIPOS_DE_BENEFICIO,
  textoDeBeneficioAplicado,
  textoDeMesBonificado,
} from "@/lib/bonificacion";

describe("a quién se le pueden bonificar meses", () => {
  it("a quien paga mes a mes, sea cual sea su plan mensual", () => {
    for (const plan of ["colegio", "deportiva", "multisede", "fundador", "estandar"]) assert.equal(puedeBonificarMeses(plan, false), true, plan);
  });

  it("no a quien no tiene una mensualidad de la que descontar: plan anual o búsqueda puntual", () => {
    assert.equal(puedeBonificarMeses("anual", false), false);
    assert.equal(puedeBonificarMeses("puntual", true), false);
  });
});

describe("en qué está un mes bonificado", () => {
  const ayer = new Date("2026-10-22T12:00:00Z");

  it("sin mes asignado está disponible, tenga lo que tenga alrededor", () => {
    assert.equal(estadoDeMes({ periodo: null, cobroId: null, devueltoEn: null }), "disponible");
  });

  it("con mes y sin cobro quedó bonificado: simplemente no se facturó", () => {
    assert.equal(estadoDeMes({ periodo: "2026-11", cobroId: null, devueltoEn: null }), "usado");
  });

  it("con mes y un cobro del débito hay que devolverlo, hasta que el equipo lo marca", () => {
    assert.equal(estadoDeMes({ periodo: "2026-11", cobroId: "123", devueltoEn: null }), "a-devolver");
    assert.equal(estadoDeMes({ periodo: "2026-11", cobroId: "123", devueltoEn: ayer }), "devuelto");
    assert.equal(estadoDeMes({ periodo: "2026-11", cobroId: "123", devueltoEn: ayer.toISOString() }), "devuelto");
  });

  it("cada estado tiene su etiqueta", () => {
    assert.deepEqual(Object.keys(ETIQUETA_DE_MES).sort(), ["a-devolver", "devuelto", "disponible", "usado"]);
  });
});

describe("cuántos meses hay en cada estado", () => {
  it("cuenta disponibles, usados (incluidos los que hay que devolver o ya se devolvieron) y las devoluciones", () => {
    const r = resumenDeMeses([
      { estado: "disponible" },
      { estado: "disponible" },
      { estado: "usado" },
      { estado: "a-devolver" },
      { estado: "devuelto" },
    ]);
    assert.deepEqual(r, { total: 5, disponibles: 2, usados: 3, aDevolver: 1, devueltos: 1 });
  });

  it("sin meses todo es cero", () => {
    assert.deepEqual(resumenDeMeses([]), { total: 0, disponibles: 0, usados: 0, aDevolver: 0, devueltos: 0 });
  });
});

describe("qué se hace con el cobro del débito de un mes", () => {
  it("si el mes ya estaba bonificado sin cobro (el cron lo bonificó antes de activar el débito), se le agrega el cobro para devolverlo", () => {
    assert.equal(gastoDelCobro({ mesAnotado: { cobroId: null }, disponibles: 3 }), "agregar-cobro");
  });

  it("si el mes ya tenía su cobro anotado (un aviso repetido) no se hace nada: no se gasta otro mes", () => {
    assert.equal(gastoDelCobro({ mesAnotado: { cobroId: "123" }, disponibles: 3 }), "ya-estaba");
  });

  it("si el mes no estaba anotado y hay meses bonificados, se toma uno", () => {
    assert.equal(gastoDelCobro({ mesAnotado: null, disponibles: 1 }), "tomar-disponible");
  });

  it("sin meses bonificados el cobro es un cobro común", () => {
    assert.equal(gastoDelCobro({ mesAnotado: null, disponibles: 0 }), "ninguno");
  });
});

describe("textos", () => {
  it("cuenta los meses en singular y plural", () => {
    assert.equal(mesesTexto(1), "1 mes");
    assert.equal(mesesTexto(2), "2 meses");
    assert.equal(mesesTexto(12), "12 meses");
    assert.equal(mesesBonificadosTexto(1), "1 mes bonificado");
    assert.equal(mesesBonificadosTexto(2), "2 meses bonificados");
  });

  it("dice cómo se aplicó un beneficio", () => {
    assert.equal(textoDeBeneficioAplicado({ tipo: "meses", meses: 2 }), "2 meses bonificados");
    assert.equal(textoDeBeneficioAplicado({ tipo: "meses", meses: 1 }), "1 mes bonificado");
    assert.equal(textoDeBeneficioAplicado({ tipo: "pack", meses: 0 }), "Pack por adelantado");
    assert.equal(textoDeBeneficioAplicado({ tipo: null, meses: 0 }), "Pack por adelantado", "lo anterior a la opción de meses era pack");
  });

  it("los dos tipos de beneficio son pack y meses", () => {
    assert.deepEqual([...TIPOS_DE_BENEFICIO], ["pack", "meses"]);
  });

  it("no deja deshacer un beneficio de meses del que ya se gastó alguno", () => {
    assert.equal(motivoParaNoDeshacer(0), null);
    assert.match(motivoParaNoDeshacer(1) ?? "", /usó 1 de los meses/);
    assert.match(motivoParaNoDeshacer(2) ?? "", /usaron 2 de los meses/);
  });

  it("avisa a la institución sin facturar el mes cuando no hay débito", () => {
    assert.equal(
      textoDeMesBonificado({ periodo: "Noviembre 2026", recomendada: "Colegio Norte", conDebito: false }),
      "Noviembre 2026 está bonificado por recomendar a Colegio Norte: no se te factura ese mes.",
    );
    assert.equal(
      textoDeMesBonificado({ periodo: "Noviembre 2026", recomendada: null, conDebito: false }),
      "Noviembre 2026 está bonificado: no se te factura ese mes.",
    );
  });

  it("avisa que le devolvemos lo cobrado cuando el débito ya cobró", () => {
    const t = textoDeMesBonificado({ periodo: "Noviembre 2026", recomendada: "Colegio Norte", conDebito: true, montoTexto: "$ 50.000" });
    assert.match(t, /débito automático de Noviembre 2026 \(\$ 50\.000\) está bonificado por recomendar a Colegio Norte/);
    assert.match(t, /te devolvemos lo cobrado/);
  });
});
