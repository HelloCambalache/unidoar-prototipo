import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { codificarAceptacion, decodificarAceptacion, EDAD_MAXIMA_COOKIE_MS, VERSION_TERMINOS } from "@/lib/terminos";

const AHORA = new Date("2026-10-07T15:00:00.000Z");

describe("constancia de aceptación de los términos", () => {
  it("lo que se codifica se lee igual, con la versión vigente por defecto", () => {
    const texto = codificarAceptacion(AHORA);
    assert.equal(texto, `${VERSION_TERMINOS}|2026-10-07T15:00:00.000Z`);
    const leido = decodificarAceptacion(texto, { ahora: AHORA });
    assert.equal(leido?.version, VERSION_TERMINOS);
    assert.equal(leido?.en.toISOString(), "2026-10-07T15:00:00.000Z");
  });

  it("rechaza lo que no tiene la forma esperada", () => {
    for (const valor of [undefined, null, 42, "", "2026-09", "2026-09|ayer", "26-09|2026-10-07T15:00:00.000Z", "2026-09|2026-13-45T99:00:00.000Z", "2026-09|2026-10-07T15:00:00.000Z|x"]) {
      assert.equal(decodificarAceptacion(valor, { ahora: AHORA }), null, String(valor));
    }
  });

  it("no acepta una fecha del futuro, salvo el margen de 5 minutos", () => {
    assert.equal(decodificarAceptacion("2026-09|2026-10-07T15:04:00.000Z", { ahora: AHORA })?.version, "2026-09");
    assert.equal(decodificarAceptacion("2026-09|2026-10-07T15:06:00.000Z", { ahora: AHORA }), null);
    assert.equal(decodificarAceptacion("2026-09|2027-01-01T00:00:00.000Z", { ahora: AHORA }), null);
  });

  it("una constancia en cookie vence a las 2 horas; la de los datos de la cuenta no vence", () => {
    const hace3Horas = codificarAceptacion(new Date(AHORA.getTime() - 3 * 60 * 60 * 1000));
    assert.equal(decodificarAceptacion(hace3Horas, { ahora: AHORA, edadMaximaMs: EDAD_MAXIMA_COOKIE_MS }), null);
    assert.ok(decodificarAceptacion(hace3Horas, { ahora: AHORA }));
    const hace1Hora = codificarAceptacion(new Date(AHORA.getTime() - 60 * 60 * 1000));
    assert.ok(decodificarAceptacion(hace1Hora, { ahora: AHORA, edadMaximaMs: EDAD_MAXIMA_COOKIE_MS }));
  });
});
