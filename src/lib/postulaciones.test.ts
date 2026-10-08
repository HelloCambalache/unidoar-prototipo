import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { textoDeCierreDeBusqueda } from "./postulaciones";

describe("aviso de cierre de búsqueda", () => {
  it("al postulante le dice que se cubrió, le agradece y lo invita a seguir", () => {
    const t = textoDeCierreDeBusqueda("Maestra Nivel Inicial", false);
    assert.equal(
      t,
      "cerró la búsqueda «Maestra Nivel Inicial»: el puesto ya se cubrió. ¡Gracias por postularte! Seguí postulándote a otras búsquedas.",
    );
  });

  it("a quien fue invitado y no se postuló no le agradece la postulación", () => {
    const t = textoDeCierreDeBusqueda("Maestra Nivel Inicial", true);
    assert.ok(t.includes("a la que te había invitado"));
    assert.ok(t.includes("Seguí postulándote a otras búsquedas."));
    assert.ok(!t.includes("por postularte"));
  });

  it("los dos textos son distintos (la deduplicación del día los distingue) y encajan después del nombre de la institución", () => {
    assert.notEqual(textoDeCierreDeBusqueda("X", true), textoDeCierreDeBusqueda("X", false));
    for (const invitado of [true, false]) assert.match(textoDeCierreDeBusqueda("X", invitado), /^cerró la búsqueda «X»/);
  });
});
