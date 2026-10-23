import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { avisoDeSedes } from "@/lib/aviso-sedes";
import { CATALOGO_POR_DEFECTO, crearPlanes, planesPorDefecto as P } from "@/lib/planes";

const sinSemestre = { semestrePagoHasta: null };

describe("el cartel de Sedes", () => {
  it("con Colegios o Clubes dice cuánto suma cada sede adicional, desde cuándo y cuándo cambia el trato", () => {
    assert.equal(
      avisoDeSedes({ plan: "colegio", acuerdo: null, P, ...sinSemestre }),
      "Cada sede adicional se suma a tu abono: $ 25.000 por mes (50 % menos que la primera). Se cobra desde la próxima factura. Desde 5 sedes el valor se acuerda con el equipo (plan Multisede).",
    );
    assert.match(avisoDeSedes({ plan: "deportiva", acuerdo: null, P, ...sinSemestre }) ?? "", /\$ 15\.000 por mes/);
  });

  it("con un abono acordado calcula sobre ese abono, no sobre el de lista", () => {
    const texto = avisoDeSedes({ plan: "colegio", acuerdo: { modalidad: "abono", monto: 48_000 }, P, ...sinSemestre });
    assert.match(texto ?? "", /\$ 24\.000 por mes/);
  });

  it("con un convenio a medida avisa que sumar sedes no cambia el monto fijo, y no habla de descuentos", () => {
    const texto = avisoDeSedes({ plan: "colegio", acuerdo: { modalidad: "total", monto: 200_000 }, P, ...sinSemestre });
    assert.equal(texto, "Tu convenio con UNIDOAR es un monto fijo por mes: sumar sedes no cambia lo que pagás.");
  });

  it("con la búsqueda puntual no habla de abono ni de precio por sede, y recuerda que se publica en una sola", () => {
    const texto = avisoDeSedes({ plan: "puntual", acuerdo: null, P, ...sinSemestre }) ?? "";
    assert.match(texto, /búsqueda puntual/);
    assert.match(texto, /una sola sede/);
    assert.doesNotMatch(texto, /abono:|por mes/);
    assert.doesNotMatch(texto, /\$ /);
  });

  it("con Multisede dice que cada sede paga entera", () => {
    assert.equal(avisoDeSedes({ plan: "multisede", acuerdo: null, P, ...sinSemestre }), "Tu plan cobra cada sede: $ 15.000 por mes por sede, desde la próxima factura.");
  });

  it("con un semestre pago que cubre meses por delante, avisa desde cuándo se suma la sede nueva", () => {
    const texto = avisoDeSedes({ plan: "colegio", acuerdo: null, P, semestrePagoHasta: "2027-03" }) ?? "";
    assert.match(texto, /Tu semestre pago cubre hasta marzo 2027: la sede nueva se suma a tu abono desde la factura de abril 2027\./);
    assert.doesNotMatch(texto, /Se cobra desde la próxima factura/);
  });

  it("el semestre cruzando de año", () => {
    const texto = avisoDeSedes({ plan: "colegio", acuerdo: null, P, semestrePagoHasta: "2026-12" }) ?? "";
    assert.match(texto, /cubre hasta diciembre 2026.*enero 2027/);
  });

  it("sigue lo que el equipo cambió en Planes: el descuento y desde cuántas sedes es Multisede", () => {
    const catalogo = structuredClone(CATALOGO_POR_DEFECTO);
    catalogo.condiciones.descuentoSedeExtra = 30;
    catalogo.condiciones.sedesMultisede = 8;
    const texto = avisoDeSedes({ plan: "colegio", acuerdo: null, P: crearPlanes(catalogo), ...sinSemestre }) ?? "";
    assert.match(texto, /\$ 35\.000 por mes \(30 % menos que la primera\)/);
    assert.match(texto, /Desde 8 sedes/);
  });

  it("sin descuento no dice «0 % menos»; con descuento total, las sedes adicionales no cuestan", () => {
    const sin = structuredClone(CATALOGO_POR_DEFECTO);
    sin.condiciones.descuentoSedeExtra = 0;
    const textoSin = avisoDeSedes({ plan: "colegio", acuerdo: null, P: crearPlanes(sin), ...sinSemestre }) ?? "";
    assert.match(textoSin, /\$ 50\.000 por mes\./);
    assert.doesNotMatch(textoSin, /% menos/);

    const gratis = structuredClone(CATALOGO_POR_DEFECTO);
    gratis.condiciones.descuentoSedeExtra = 100;
    assert.match(avisoDeSedes({ plan: "colegio", acuerdo: null, P: crearPlanes(gratis), ...sinSemestre }) ?? "", /no tienen costo/);
  });
});
