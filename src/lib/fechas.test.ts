import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { aFechaHoraAR, parsearFechaHoraAR } from "./fechas";

describe("fecha y hora de una entrevista (hora argentina)", () => {
  it("un instante vuelve al valor del datetime-local con el que se agendó", () => {
    for (const valor of ["2026-10-15T10:30", "2026-12-31T23:59", "2027-01-01T00:00", "2026-03-08T07:05"]) {
      assert.equal(aFechaHoraAR(parsearFechaHoraAR(valor)!), valor);
    }
  });

  it("usa la hora de Argentina (UTC-3), no la del servidor", () => {
    assert.equal(aFechaHoraAR(new Date("2026-10-15T13:30:00Z")), "2026-10-15T10:30");
    // 02:30 UTC del 16 todavía es el 15 en Argentina.
    assert.equal(aFechaHoraAR(new Date("2026-10-16T02:30:00Z")), "2026-10-15T23:30");
  });

  it("la medianoche es 00:00 y no 24:00", () => {
    assert.equal(aFechaHoraAR(new Date("2026-10-15T03:00:00Z")), "2026-10-15T00:00");
  });
});
