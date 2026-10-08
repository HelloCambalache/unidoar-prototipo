import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { rutaDeInvitacion } from "./equipo";

describe("enlace de una invitación al equipo", () => {
  it("lleva directo a la invitación (no al registro genérico)", () => {
    assert.equal(rutaDeInvitacion("3f2a9c1e-5b7d-4e8a-9c01-2d3e4f5a6b7c"), "/invitacion/3f2a9c1e-5b7d-4e8a-9c01-2d3e4f5a6b7c");
  });
});
