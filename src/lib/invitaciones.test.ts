import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MAX_INVITACIONES_A_PROFESIONALES_POR_DIA, motivoDeTopeDeInvitaciones } from "@/lib/invitaciones";

describe("tope diario de invitaciones a profesionales", () => {
  it("un uso normal no se entera", () => {
    assert.equal(motivoDeTopeDeInvitaciones(0), null);
    assert.equal(motivoDeTopeDeInvitaciones(10), null);
    assert.equal(motivoDeTopeDeInvitaciones(MAX_INVITACIONES_A_PROFESIONALES_POR_DIA - 1), null);
  });

  it("al llegar al máximo corta y lo explica", () => {
    const motivo = motivoDeTopeDeInvitaciones(MAX_INVITACIONES_A_PROFESIONALES_POR_DIA);
    assert.ok(motivo?.includes(String(MAX_INVITACIONES_A_PROFESIONALES_POR_DIA)));
    assert.ok(motivoDeTopeDeInvitaciones(500));
  });
});
