import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MENSAJE_REAPERTURA, puedeReabrirRevision } from "@/lib/backoffice-docentes";

describe("reabrir la revisión de un perfil", () => {
  it("solo se reabre un perfil rechazado: es el único estado sin salida", () => {
    assert.equal(puedeReabrirRevision("rechazado"), true);
  });

  it("no se reabre uno que ya está en la cola, con corrección pedida o verificado", () => {
    assert.equal(puedeReabrirRevision("pendiente"), false);
    assert.equal(puedeReabrirRevision("correccion"), false);
    assert.equal(puedeReabrirRevision("verificado"), false);
  });

  it("el mensaje de siempre le dice a la persona qué hacer y no repite que se reabrió (el aviso ya lo dice)", () => {
    assert.ok(MENSAJE_REAPERTURA.length > 20);
    assert.match(MENSAJE_REAPERTURA, /^Subí de nuevo/);
    assert.doesNotMatch(MENSAJE_REAPERTURA, /reabr|abrir/i);
  });
});
