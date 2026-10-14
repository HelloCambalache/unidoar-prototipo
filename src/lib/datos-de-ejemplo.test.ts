import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hayQueOcultarLosEjemplos } from "./datos-de-ejemplo";

describe("interruptor de los datos de ejemplo", () => {
  it("se prende con los valores de siempre, sin importar mayúsculas ni espacios", () => {
    for (const v of ["1", "true", "TRUE", " true ", "si", "sí", "Yes", "on", " ON "]) assert.equal(hayQueOcultarLosEjemplos(v), true, v);
  });

  it("apagado: sin variable, vacío o cualquier otra cosa deja los ejemplos a la vista", () => {
    for (const v of [undefined, null, "", "   ", "0", "false", "no", "off", "talvez", "2"]) assert.equal(hayQueOcultarLosEjemplos(v), false, String(v));
  });
});
