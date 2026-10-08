import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { claveDePostulantes, diasEntre, planificarRecordatorios, sumarDias, type FacturaParaRecordar } from "./claves";

const ID = "9d6b5d0a-1c0e-4c1d-8f5a-0a7a3b1c2d3e";

describe("clave de postulantes nuevos (M30)", () => {
  it("una por búsqueda y por día (hora de Argentina)", () => {
    // 2026-10-08 14:30 UTC = 11:30 en Argentina.
    const a = claveDePostulantes(ID, false, new Date("2026-10-08T14:30:00Z"));
    const b = claveDePostulantes(ID, false, new Date("2026-10-08T22:59:00Z"));
    assert.equal(a, `M30:${ID}:2026-10-08`);
    assert.equal(b, a);
    // 02:00 UTC del 9 todavía es el 8 en Argentina.
    assert.equal(claveDePostulantes(ID, false, new Date("2026-10-09T02:00:00Z")), a);
    assert.notEqual(claveDePostulantes(ID, false, new Date("2026-10-09T03:00:00Z")), a);
    assert.notEqual(claveDePostulantes("otra-busqueda", false, new Date("2026-10-08T14:30:00Z")), a);
  });

  it("en las búsquedas rápidas, una por hora", () => {
    const h1 = claveDePostulantes(ID, true, new Date("2026-10-08T14:05:00Z"));
    const h1bis = claveDePostulantes(ID, true, new Date("2026-10-08T14:55:00Z"));
    const h2 = claveDePostulantes(ID, true, new Date("2026-10-08T15:05:00Z"));
    assert.equal(h1, `M30:${ID}:2026-10-08T11`);
    assert.equal(h1bis, h1);
    assert.equal(h2, `M30:${ID}:2026-10-08T12`);
    // La medianoche argentina es la hora 00, no 24.
    assert.equal(claveDePostulantes(ID, true, new Date("2026-10-08T03:10:00Z")), `M30:${ID}:2026-10-08T00`);
  });
});

describe("recordatorios de factura", () => {
  const f = (id: string, fechaCobro: string, estado = "pendiente"): FacturaParaRecordar => ({ id, institucionId: "i1", estado, fechaCobro });

  it("cuenta los días de calendario entre dos fechas", () => {
    assert.equal(diasEntre("2026-10-08", "2026-10-11"), 3);
    assert.equal(diasEntre("2026-10-08", "2026-10-08"), 0);
    assert.equal(diasEntre("2026-10-08", "2026-10-01"), -7);
    assert.equal(diasEntre("2026-12-30", "2027-01-02"), 3);
    assert.equal(diasEntre("2026-02-27", "2026-03-01"), 2);
  });

  it("suma días atravesando fin de mes y de año", () => {
    assert.equal(sumarDias("2026-10-08", 3), "2026-10-11");
    assert.equal(sumarDias("2026-10-30", 3), "2026-11-02");
    assert.equal(sumarDias("2026-12-30", 3), "2027-01-02");
    assert.equal(sumarDias("2026-10-08", -30), "2026-09-08");
    assert.equal(sumarDias("2026-03-01", -1), "2026-02-28");
  });

  it("avisa que vence desde 3 días antes hasta el mismo día", () => {
    const hoy = "2026-10-08";
    assert.deepEqual(planificarRecordatorios([f("a", "2026-10-12")], hoy), []);
    for (const dia of ["2026-10-11", "2026-10-10", "2026-10-09", "2026-10-08"]) {
      const r = planificarRecordatorios([f("a", dia)], hoy);
      assert.equal(r.length, 1, dia);
      assert.equal(r[0]!.plantilla, "M51");
      assert.equal(r[0]!.clave, "M51:a");
    }
  });

  it("avisa que venció, y a la semana avisa de nuevo, con claves distintas", () => {
    const hoy = "2026-10-20";
    const primera = planificarRecordatorios([f("a", "2026-10-19")], hoy)[0]!;
    assert.deepEqual([primera.plantilla, primera.segundoAviso, primera.clave], ["M52", false, "M52:a:1"]);
    const seguida = planificarRecordatorios([f("a", "2026-10-14", "vencida")], hoy)[0]!;
    assert.deepEqual([seguida.plantilla, seguida.segundoAviso, seguida.clave], ["M52", false, "M52:a:1"]);
    const segunda = planificarRecordatorios([f("a", "2026-10-13", "vencida")], hoy)[0]!;
    assert.deepEqual([segunda.plantilla, segunda.segundoAviso, segunda.clave], ["M52", true, "M52:a:2"]);
  });

  it("no recuerda deudas viejas ni facturas pagadas ni las que vencen más adelante", () => {
    const hoy = "2026-10-20";
    assert.equal(planificarRecordatorios([f("a", "2026-09-20")], hoy).length, 1); // 30 días: todavía
    assert.equal(planificarRecordatorios([f("a", "2026-09-19")], hoy).length, 0); // 31 días: no
    assert.equal(planificarRecordatorios([f("a", "2026-10-10", "pagada")], hoy).length, 0);
    assert.equal(planificarRecordatorios([f("a", "2026-10-30")], hoy).length, 0);
    assert.equal(planificarRecordatorios([], hoy).length, 0);
  });

  it("varias facturas generan un recordatorio cada una", () => {
    const r = planificarRecordatorios([f("a", "2026-10-21"), f("b", "2026-10-15", "vencida"), f("c", "2026-11-30")], "2026-10-20");
    assert.deepEqual(r.map((x) => x.clave), ["M51:a", "M52:b:1"]);
  });
});
