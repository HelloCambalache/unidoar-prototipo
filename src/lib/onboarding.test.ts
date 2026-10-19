import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { EDAD_MAXIMA, EDAD_MINIMA, limitesDeNacimiento } from "./onboarding";

describe("límites de la fecha de nacimiento", () => {
  it("el máximo es de hace 16 años y el mínimo de hace 100, para que el calendario no abra en hoy", () => {
    const { min, max } = limitesDeNacimiento(new Date(2026, 9, 19, 12));
    assert.equal(max, "2010-10-19");
    assert.equal(min, "1926-10-19");
    assert.equal(EDAD_MINIMA, 16);
    assert.equal(EDAD_MAXIMA, 100);
  });

  it("el 29 de febrero no rompe la cuenta", () => {
    const { min, max } = limitesDeNacimiento(new Date(2028, 1, 29, 12));
    assert.match(min, /^\d{4}-\d{2}-\d{2}$/);
    assert.match(max, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(min < max);
  });
});
