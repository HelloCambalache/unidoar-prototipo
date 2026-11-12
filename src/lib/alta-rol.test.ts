import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { destinoSiNoPuedeHacerElAlta, puedeHacerElAlta, RUTA_CUENTA_DEL_EQUIPO } from "./alta-rol";

const INICIO = { docente: "/docente/dashboard", institucion: "/institucion/dashboard", admin: "/backoffice/verificacion" } as const;

describe("puedeHacerElAlta", () => {
  it("cada cuenta hace el alta de su propio rol", () => {
    assert.equal(puedeHacerElAlta("docente", "docente"), true);
    assert.equal(puedeHacerElAlta("institucion", "institucion"), true);
  });

  it("una cuenta del equipo NO crea un perfil de profesional", () => {
    assert.equal(puedeHacerElAlta("docente", "admin"), false);
  });

  it("una cuenta del equipo sí puede hacer el alta de una institución (como hasta ahora)", () => {
    assert.equal(puedeHacerElAlta("institucion", "admin"), true);
  });

  it("un profesional no hace el alta de una institución, ni al revés", () => {
    assert.equal(puedeHacerElAlta("institucion", "docente"), false);
    assert.equal(puedeHacerElAlta("docente", "institucion"), false);
  });
});

describe("destinoSiNoPuedeHacerElAlta", () => {
  it("el equipo va a la explicación y el resto a su propio inicio", () => {
    assert.equal(destinoSiNoPuedeHacerElAlta("admin", INICIO), RUTA_CUENTA_DEL_EQUIPO);
    assert.equal(destinoSiNoPuedeHacerElAlta("institucion", INICIO), "/institucion/dashboard");
    assert.equal(destinoSiNoPuedeHacerElAlta("docente", INICIO), "/docente/dashboard");
  });
});
