import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { opcionesDeCookieDeSesion } from "@/lib/supabase/cookies";

describe("opciones de las cookies de sesión", () => {
  it("en producción son secure y conservan lo demás", () => {
    const r = opcionesDeCookieDeSesion({ path: "/", sameSite: "lax" as const, maxAge: 100 }, true);
    assert.deepEqual(r, { path: "/", sameSite: "lax", maxAge: 100, secure: true, httpOnly: true });
  });

  it("siempre son httpOnly: el navegador no las puede leer", () => {
    assert.equal(opcionesDeCookieDeSesion({ httpOnly: false }, true).httpOnly, true);
    assert.equal(opcionesDeCookieDeSesion({ path: "/" }, false).httpOnly, true);
  });

  it("en desarrollo no son secure (http://localhost no las guardaría)", () => {
    assert.equal(opcionesDeCookieDeSesion({ path: "/" }, false).secure, false);
  });

  it("no modifica el objeto que recibe", () => {
    const original = { path: "/" };
    opcionesDeCookieDeSesion(original, true);
    assert.deepEqual(original, { path: "/" });
  });
});
