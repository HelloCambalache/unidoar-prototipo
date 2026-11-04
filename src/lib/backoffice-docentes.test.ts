import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MENSAJE_REAPERTURA, PESTANAS_COLA, leerEstadoCola, modificadoTrasObservacion, puedeReabrirRevision } from "@/lib/backoffice-docentes";

describe("pestañas de la cola de verificación", () => {
  it("leen la de la URL y cualquier valor desconocido cae en «Toda la cola»", () => {
    for (const e of PESTANAS_COLA) assert.equal(leerEstadoCola(e), e);
    assert.equal(leerEstadoCola(""), "todos");
    assert.equal(leerEstadoCola("verificado"), "todos");
    assert.equal(leerEstadoCola("constructor"), "todos");
  });

  it("un perfil en la cola con una observación anterior es «modificado»: volvió a subir después de que se le pidió una corrección", () => {
    assert.equal(modificadoTrasObservacion("pendiente", "Falta el dorso del DNI"), true);
  });

  it("no es «modificado» quien nunca fue observado, ni quien todavía no corrigió, ni quien ya se resolvió", () => {
    assert.equal(modificadoTrasObservacion("pendiente", null), false);
    assert.equal(modificadoTrasObservacion("pendiente", ""), false);
    assert.equal(modificadoTrasObservacion("pendiente", "   "), false);
    assert.equal(modificadoTrasObservacion("correccion", "Falta el dorso del DNI"), false);
    assert.equal(modificadoTrasObservacion("verificado", "Falta el dorso del DNI"), false);
    assert.equal(modificadoTrasObservacion("rechazado", "Falta el dorso del DNI"), false);
  });
});

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
