import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  corteDeInvitaciones,
  DIAS_DE_VIGENCIA_DE_INVITACION,
  invitacionVencida,
  MAX_INVITACIONES_PENDIENTES,
  MAX_PERSONAS_EN_EL_EQUIPO,
  motivoDeTopeDeEquipo,
  puedeSumarseAlEquipo,
  rutaDeInvitacion,
} from "./equipo";

describe("tope de invitaciones", () => {
  it("un equipo normal puede seguir invitando", () => {
    assert.equal(motivoDeTopeDeEquipo(5, 3), null);
    assert.equal(motivoDeTopeDeEquipo(1, 0), null);
  });

  it("corta con muchas invitaciones sin responder", () => {
    assert.equal(motivoDeTopeDeEquipo(2, MAX_INVITACIONES_PENDIENTES - 1), null);
    assert.match(motivoDeTopeDeEquipo(2, MAX_INVITACIONES_PENDIENTES) ?? "", /sin responder/);
  });

  it("corta cuando el equipo (activos más invitados) llega al máximo", () => {
    assert.equal(motivoDeTopeDeEquipo(MAX_PERSONAS_EN_EL_EQUIPO - 5, 4), null);
    assert.match(motivoDeTopeDeEquipo(MAX_PERSONAS_EN_EL_EQUIPO - 5, 5) ?? "", /máximo/);
  });
});

describe("sumarse al equipo", () => {
  it("exige haber aceptado los términos", () => {
    assert.equal(puedeSumarseAlEquipo({ terminosAceptadosEn: new Date() }), true);
    assert.equal(puedeSumarseAlEquipo({ terminosAceptadosEn: null }), false);
  });
});

describe("enlace de una invitación al equipo", () => {
  it("lleva directo a la invitación (no al registro genérico)", () => {
    assert.equal(rutaDeInvitacion("3f2a9c1e-5b7d-4e8a-9c01-2d3e4f5a6b7c"), "/invitacion/3f2a9c1e-5b7d-4e8a-9c01-2d3e4f5a6b7c");
  });
});

describe("vencimiento de las invitaciones", () => {
  const ahora = new Date("2026-10-20T12:00:00Z");
  const haceDias = (n: number) => new Date(ahora.getTime() - n * 86_400_000);

  it("una invitación vale 30 días", () => {
    assert.equal(DIAS_DE_VIGENCIA_DE_INVITACION, 30);
    assert.equal(invitacionVencida(haceDias(0), ahora), false);
    assert.equal(invitacionVencida(haceDias(1), ahora), false);
    assert.equal(invitacionVencida(haceDias(29), ahora), false);
  });

  it("pasados los 30 días venció", () => {
    assert.equal(invitacionVencida(haceDias(30), ahora), true);
    assert.equal(invitacionVencida(haceDias(45), ahora), true);
  });

  it("el corte es la fecha desde la que todavía valen", () => {
    assert.equal(corteDeInvitaciones(ahora).getTime(), haceDias(30).getTime());
    assert.equal(invitacionVencida(new Date(corteDeInvitaciones(ahora).getTime() + 1), ahora), false);
  });
});
