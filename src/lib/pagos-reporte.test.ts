import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  atajosDeFechas,
  celdaCsv,
  csvDePagos,
  diasDelRango,
  fechaParaCsv,
  filtrarPagosPorInstitucion,
  leerFiltrosDePagos,
  medioDelPago,
  MEDIOS_DEL_REPORTE,
  nombreDelCsv,
  ordenarPagos,
  primerDiaDelMes,
  SIN_DATO,
  sumarDiasAFecha,
  totalesDePagos,
  ultimoDiaDelMes,
  type PagoDelReporte,
} from "./pagos-reporte";

const HOY = "2026-11-10";

const pago = (extra: Partial<PagoDelReporte> = {}): PagoDelReporte => ({
  clave: "f:1",
  fecha: "2026-11-05",
  institucionId: "i1",
  institucion: "Colegio San Andrés",
  cuit: "30-71234567-1",
  tipo: "factura",
  concepto: "Noviembre 2026",
  plan: "colegio",
  medio: "Transferencia",
  monto: 50_000,
  comprobante: "AB12CD34",
  ...extra,
});

describe("el reporte de pagos: filtros", () => {
  it("sin nada en la dirección muestra el mes en curso hasta hoy", () => {
    assert.deepEqual(leerFiltrosDePagos({}, HOY), { desde: "2026-11-01", hasta: HOY, medio: "", q: "", conEjemplo: false });
  });

  it("lee fechas, medio, nombre y ejemplos de la dirección", () => {
    const f = leerFiltrosDePagos({ desde: "2026-10-01", hasta: "2026-10-31", medio: "Efectivo", q: "  san andres ", ejemplo: "1" }, HOY);
    assert.deepEqual(f, { desde: "2026-10-01", hasta: "2026-10-31", medio: "Efectivo", q: "san andres", conEjemplo: true });
  });

  it("una fecha que no existe o mal escrita vuelve al mes en curso, y los extremos al revés se dan vuelta", () => {
    assert.equal(leerFiltrosDePagos({ desde: "2026-02-30" }, HOY).desde, "2026-11-01");
    assert.equal(leerFiltrosDePagos({ hasta: "ayer" }, HOY).hasta, HOY);
    const f = leerFiltrosDePagos({ desde: "2026-11-09", hasta: "2026-11-02" }, HOY);
    assert.deepEqual([f.desde, f.hasta], ["2026-11-02", "2026-11-09"]);
  });

  it("un medio que no es de la lista se ignora y «Sin dato» se puede elegir", () => {
    assert.equal(leerFiltrosDePagos({ medio: "Bitcoin" }, HOY).medio, "");
    assert.equal(leerFiltrosDePagos({ medio: SIN_DATO }, HOY).medio, SIN_DATO);
    for (const m of ["Transferencia", "Efectivo", "Débito automático", "Mercado Pago", "Tarjeta"]) assert.ok(MEDIOS_DEL_REPORTE.includes(m), m);
  });

  it("lo que viene de la dirección no rompe: valores repetidos, larguísimos o raros", () => {
    const f = leerFiltrosDePagos({ q: "x".repeat(500), desde: ["2026-10-01", "2026-09-01"], ejemplo: ["0", "1"] }, HOY);
    assert.equal(f.q.length, 80);
    assert.equal(f.desde, "2026-10-01", "con un valor repetido vale el primero");
    assert.equal(f.conEjemplo, false);
  });

  it("los atajos: este mes, mes pasado, últimos 30 días y este año", () => {
    const [mes, pasado, treinta, anio] = atajosDeFechas(HOY);
    assert.deepEqual([mes!.desde, mes!.hasta], ["2026-11-01", HOY]);
    assert.deepEqual([pasado!.desde, pasado!.hasta], ["2026-10-01", "2026-10-31"]);
    assert.deepEqual([treinta!.desde, treinta!.hasta], ["2026-10-12", HOY]);
    assert.deepEqual([anio!.desde, anio!.hasta], ["2026-01-01", HOY]);
  });

  it("los atajos cruzan el año: en enero, el mes pasado es diciembre", () => {
    const pasado = atajosDeFechas("2027-01-15")[1]!;
    assert.deepEqual([pasado.desde, pasado.hasta], ["2026-12-01", "2026-12-31"]);
  });

  it("las cuentas de fechas", () => {
    assert.equal(primerDiaDelMes("2026-11-10"), "2026-11-01");
    assert.equal(ultimoDiaDelMes("2026-02-10"), "2026-02-28");
    assert.equal(ultimoDiaDelMes("2028-02-10"), "2028-02-29", "bisiesto");
    assert.equal(sumarDiasAFecha("2026-12-31", 1), "2027-01-01");
    assert.equal(sumarDiasAFecha("2026-03-01", -1), "2026-02-28");
    assert.equal(diasDelRango({ desde: "2026-11-01", hasta: "2026-11-10" }), 10);
    assert.equal(diasDelRango({ desde: "2026-11-10", hasta: "2026-11-10" }), 1);
  });
});

describe("el reporte de pagos: qué se muestra", () => {
  it("un pago sin medio anotado dice «Sin dato»", () => {
    assert.equal(medioDelPago(null), SIN_DATO);
    assert.equal(medioDelPago(""), SIN_DATO);
    assert.equal(medioDelPago("  "), SIN_DATO);
    assert.equal(medioDelPago(" Efectivo "), "Efectivo");
  });

  it("totales: lo que entró en total y por cada medio, el que más puso primero", () => {
    const t = totalesDePagos([
      pago({ clave: "a", medio: "Transferencia", monto: 50_000 }),
      pago({ clave: "b", medio: "Efectivo", monto: 30_000 }),
      pago({ clave: "c", medio: "Transferencia", monto: 30_000 }),
      pago({ clave: "d", medio: "Débito automático", monto: 150_000 }),
    ]);
    assert.equal(t.total, 260_000);
    assert.equal(t.cantidad, 4);
    assert.deepEqual(t.porMedio, [
      { medio: "Débito automático", cantidad: 1, monto: 150_000 },
      { medio: "Transferencia", cantidad: 2, monto: 80_000 },
      { medio: "Efectivo", cantidad: 1, monto: 30_000 },
    ]);
  });

  it("sin pagos los totales son cero", () => {
    assert.deepEqual(totalesDePagos([]), { total: 0, cantidad: 0, porMedio: [] });
  });

  it("la lupa busca por nombre sin importar tildes ni mayúsculas", () => {
    const pagos = [pago({ clave: "a", institucion: "Colegio San Andrés del Norte" }), pago({ clave: "b", institucion: "Club Ribera" })];
    assert.deepEqual(filtrarPagosPorInstitucion(pagos, "san ANDRES").map((p) => p.clave), ["a"]);
    assert.equal(filtrarPagosPorInstitucion(pagos, "").length, 2);
    assert.equal(filtrarPagosPorInstitucion(pagos, "zzz").length, 0);
  });

  it("de más nuevo a más viejo, y a igual día un orden estable", () => {
    const orden = ordenarPagos([
      pago({ clave: "viejo", fecha: "2026-11-01" }),
      pago({ clave: "b", fecha: "2026-11-05", institucion: "Zeta" }),
      pago({ clave: "a", fecha: "2026-11-05", institucion: "Alfa" }),
      pago({ clave: "nuevo", fecha: "2026-11-09" }),
    ]).map((p) => p.clave);
    assert.deepEqual(orden, ["nuevo", "a", "b", "viejo"]);
  });
});

describe("el reporte de pagos: CSV", () => {
  it("una celda lleva comillas escapadas y neutraliza las fórmulas", () => {
    assert.equal(celdaCsv('Colegio "San Andrés"'), '"Colegio ""San Andrés"""');
    assert.equal(celdaCsv("=SUMA(A1:A9)"), `"'=SUMA(A1:A9)"`);
    assert.equal(celdaCsv("+54 11"), `"'+54 11"`);
    assert.equal(celdaCsv("-5"), `"'-5"`);
    assert.equal(celdaCsv("@x"), `"'@x"`);
    assert.equal(celdaCsv("normal"), '"normal"');
  });

  it("el archivo trae encabezado, una fila por pago con su medio, y el total al final; con BOM y separado por punto y coma", () => {
    const csv = csvDePagos([pago(), pago({ clave: "p:2", tipo: "puntual", concepto: "Búsqueda puntual", plan: "puntual", medio: "Efectivo", monto: 110_000, comprobante: null, cuit: null })], (c) =>
      c === "puntual" ? "Búsqueda puntual" : "Plan Colegios",
    );
    assert.ok(csv.startsWith("﻿"), "BOM para Excel");
    const lineas = csv.trimEnd().split("\r\n");
    assert.equal(lineas.length, 4, "encabezado + 2 pagos + total");
    assert.equal(lineas[0], '"Fecha de pago";"Institución";"CUIT";"Concepto";"Plan";"Medio de pago";"Monto";"N.º de comprobante"'.replace(/^/, "﻿"));
    assert.equal(lineas[1], '"05/11/2026";"Colegio San Andrés";"30-71234567-1";"Noviembre 2026";"Plan Colegios";"Transferencia";"50000";"AB12CD34"');
    assert.equal(lineas[2], '"05/11/2026";"Colegio San Andrés";"";"Búsqueda puntual";"Búsqueda puntual";"Efectivo";"110000";""');
    assert.equal(lineas[3], '"Total";"";"";"";"";"";"160000";""');
  });

  it("sin pagos el archivo igual lleva el encabezado y el total en cero", () => {
    const lineas = csvDePagos([], () => "").trimEnd().split("\r\n");
    assert.equal(lineas.length, 2);
    assert.ok(lineas[1]!.includes('"0"'));
  });

  it("el nombre del archivo lleva las fechas y la fecha se muestra día/mes/año", () => {
    assert.equal(nombreDelCsv({ desde: "2026-11-01", hasta: "2026-11-10" }), "pagos-2026-11-01-a-2026-11-10.csv");
    assert.equal(fechaParaCsv("2026-11-05"), "05/11/2026");
  });
});
