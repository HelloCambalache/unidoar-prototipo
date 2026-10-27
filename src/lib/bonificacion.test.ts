import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  bonificacionParaSemestre,
  estadoDeMes,
  ETIQUETA_DE_MES,
  gastoDelCobro,
  MESES_ENTRE_BONIFICACIONES,
  mesesBonificadosTexto,
  mesesEntre,
  mesesTexto,
  motivoParaNoDeshacer,
  puedeBonificarPeriodo,
  resumenDeMeses,
  TEXTO_DEL_TOPE,
  TIPOS_DE_BENEFICIO,
  textoDeBeneficioAplicado,
  avisoDeCobroEnMesBonificado,
  textoDeMesBonificado,
} from "@/lib/bonificacion";

describe("el tope de 1 mes bonificado por semestre", () => {
  it("dos meses bonificados tienen que estar al menos a 6 meses de distancia", () => {
    assert.equal(MESES_ENTRE_BONIFICACIONES, 6);
  });

  it("cuenta los meses entre dos períodos, cruzando de año y con signo", () => {
    assert.equal(mesesEntre("2026-10", "2026-10"), 0);
    assert.equal(mesesEntre("2026-10", "2027-04"), 6);
    assert.equal(mesesEntre("2027-04", "2026-10"), -6);
    assert.equal(mesesEntre("2026-12", "2027-01"), 1);
  });

  it("sin otro mes bonificado cerca, se puede", () => {
    assert.equal(puedeBonificarPeriodo("2026-10", []), true);
  });

  it("con otro mes bonificado a menos de 6 meses (antes o después) no se puede: sería el segundo del semestre", () => {
    assert.equal(puedeBonificarPeriodo("2026-10", ["2026-11"]), false, "el mes siguiente");
    assert.equal(puedeBonificarPeriodo("2026-10", ["2026-05"]), false, "5 meses antes");
    assert.equal(puedeBonificarPeriodo("2026-10", ["2027-03"]), false, "5 meses después");
  });

  it("a 6 meses de distancia ya es otro semestre: se puede", () => {
    assert.equal(puedeBonificarPeriodo("2026-10", ["2026-04"]), true);
    assert.equal(puedeBonificarPeriodo("2026-10", ["2027-04"]), true);
  });

  it("el mismo mes que se está resolviendo no cuenta contra sí mismo (el cron corre todos los días)", () => {
    assert.equal(puedeBonificarPeriodo("2026-10", ["2026-10"]), true);
  });

  it("alcanza con que uno solo esté cerca", () => {
    assert.equal(puedeBonificarPeriodo("2026-10", ["2025-01", "2026-09", "2028-01"]), false);
  });

  it("el recordatorio para la institución dice que son de a uno por semestre y que lo que sobra queda guardado", () => {
    assert.match(TEXTO_DEL_TOPE, /1 mes bonificado por semestre/);
    assert.match(TEXTO_DEL_TOPE, /quedan guardados/);
  });

  it("de los meses de una institución, saca los disponibles y los períodos ya gastados para el semestre al contado", () => {
    assert.deepEqual(
      bonificacionParaSemestre([
        { estado: "disponible", periodo: null },
        { estado: "disponible", periodo: null },
        { estado: "usado", periodo: "2026-10" },
        { estado: "a-devolver", periodo: "2027-04" },
      ]),
      { disponibles: 2, usados: ["2026-10", "2027-04"] },
    );
    assert.deepEqual(bonificacionParaSemestre([]), { disponibles: 0, usados: [] });
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

  it("si el tope de 1 por semestre no lo permite, el cobro es un cobro común y el mes que sobra espera", () => {
    assert.equal(gastoDelCobro({ mesAnotado: null, disponibles: 3, permitido: false }), "ninguno");
    assert.equal(gastoDelCobro({ mesAnotado: null, disponibles: 3, permitido: true }), "tomar-disponible");
  });

  it("el tope no toca un mes que ya estaba bonificado: ese sigue su camino", () => {
    assert.equal(gastoDelCobro({ mesAnotado: { cobroId: null }, disponibles: 0, permitido: false }), "agregar-cobro");
    assert.equal(gastoDelCobro({ mesAnotado: { cobroId: "123" }, disponibles: 0, permitido: false }), "ya-estaba");
  });
});

describe("cobrar un mes que está bonificado", () => {
  it("el aviso de un pago dice qué mes es, que no se paga y qué pasa si igual se cobra", () => {
    const t = avisoDeCobroEnMesBonificado(["noviembre 2026"], "pago");
    assert.match(t, /noviembre 2026 es un mes bonificado por recomendar/);
    assert.match(t, /no lo paga/);
    assert.match(t, /vuelve a quedar disponible/);
  });

  it("el aviso de un semestre, con uno o con varios meses, concuerda en singular y plural", () => {
    const uno = avisoDeCobroEnMesBonificado(["noviembre 2026"], "semestre");
    assert.match(uno, /es un mes bonificado/);
    assert.match(uno, /el semestre lo cubre/);
    const varios = avisoDeCobroEnMesBonificado(["noviembre 2026", "enero 2027"], "semestre");
    assert.match(varios, /noviembre 2026, enero 2027 son meses bonificados/);
    assert.match(varios, /los cubre/);
    assert.match(varios, /los meses bonificados vuelven a quedar disponibles/);
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
