import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { estadoDeCredito, ETIQUETA_DE_CREDITO, permisoParaPublicarPuntual, puedeReabrirPuntual, venceEnDePuntual } from "@/lib/puntual";

const AHORA = new Date("2026-10-23T12:00:00Z");
const enDias = (n: number) => new Date(AHORA.getTime() + n * 86_400_000);

describe("cuándo vence una búsqueda puntual", () => {
  it("suma los días de vigencia que fijó el equipo", () => {
    assert.equal(venceEnDePuntual(AHORA, 30).toISOString(), "2026-11-22T12:00:00.000Z");
    assert.equal(venceEnDePuntual(AHORA, 45).toISOString(), "2026-12-07T12:00:00.000Z");
    assert.equal(venceEnDePuntual(AHORA, 1).toISOString(), "2026-10-24T12:00:00.000Z");
  });
});

describe("en qué está una búsqueda pagada", () => {
  it("sin usar está disponible, aunque tenga una fecha suelta", () => {
    assert.equal(estadoDeCredito({ usadoEn: null, venceEn: null, busquedaEstado: null }, AHORA), "disponible");
    assert.equal(estadoDeCredito({ usadoEn: null, venceEn: enDias(-5), busquedaEstado: null }, AHORA), "disponible");
  });

  it("usada y dentro de su plazo está publicada", () => {
    assert.equal(estadoDeCredito({ usadoEn: enDias(-3), venceEn: enDias(27), busquedaEstado: "activa" }, AHORA), "en-curso");
    assert.equal(estadoDeCredito({ usadoEn: enDias(-3), venceEn: enDias(27), busquedaEstado: "pausada" }, AHORA), "en-curso");
  });

  it("usada y con el plazo cumplido está vencida, esté la búsqueda en el estado que esté", () => {
    assert.equal(estadoDeCredito({ usadoEn: enDias(-31), venceEn: enDias(-1), busquedaEstado: "activa" }, AHORA), "vencida");
    assert.equal(estadoDeCredito({ usadoEn: enDias(-31), venceEn: enDias(-1), busquedaEstado: "cerrada" }, AHORA), "vencida");
    assert.equal(estadoDeCredito({ usadoEn: enDias(-30), venceEn: AHORA, busquedaEstado: "activa" }, AHORA), "vencida", "justo a la hora");
  });

  it("cerrada antes de tiempo (contratada o cerrada a mano) figura cerrada", () => {
    assert.equal(estadoDeCredito({ usadoEn: enDias(-3), venceEn: enDias(27), busquedaEstado: "cerrada" }, AHORA), "cerrada");
  });

  it("una búsqueda que se borró (sin estado) pero sigue en plazo figura publicada", () => {
    assert.equal(estadoDeCredito({ usadoEn: enDias(-3), venceEn: enDias(27), busquedaEstado: null }, AHORA), "en-curso");
  });

  it("cada estado tiene su etiqueta", () => {
    assert.deepEqual(Object.keys(ETIQUETA_DE_CREDITO).sort(), ["cerrada", "disponible", "en-curso", "vencida"]);
  });
});

describe("si puede publicar con el plan de búsqueda puntual", () => {
  const base = { disponibles: 1, abiertas: 0, maxAbiertas: 1, sedes: 1, precio: "$ 110.000" };

  it("con una búsqueda pagada, sin otras abiertas y en una sola sede, sí", () => {
    assert.deepEqual(permisoParaPublicarPuntual(base), { ok: true });
    assert.deepEqual(permisoParaPublicarPuntual({ ...base, disponibles: 3, abiertas: 1, maxAbiertas: 2 }), { ok: true });
  });

  it("sin una búsqueda pagada no, y el mensaje dice cuánto sale y a dónde escribir", () => {
    const r = permisoParaPublicarPuntual({ ...base, disponibles: 0 });
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.match(r.error, /\$ 110\.000/);
      assert.match(r.error, /Contacto/);
      assert.equal(r.campo, undefined);
    }
  });

  it("con el tope de búsquedas abiertas alcanzado no, aunque tenga pagadas de sobra", () => {
    const uno = permisoParaPublicarPuntual({ ...base, disponibles: 2, abiertas: 1 });
    assert.equal(uno.ok, false);
    if (!uno.ok) assert.match(uno.error, /1 búsqueda abierta/);
    const dos = permisoParaPublicarPuntual({ ...base, disponibles: 5, abiertas: 2, maxAbiertas: 2 });
    assert.equal(dos.ok, false);
    if (!dos.ok) assert.match(dos.error, /2 búsquedas abiertas/);
  });

  it("en más de una sede a la vez no: cada sede sería otra búsqueda, y señala el campo de las sedes", () => {
    const r = permisoParaPublicarPuntual({ ...base, sedes: 2 });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.campo, "sedeId");
  });

  it("la sede se avisa antes que la falta de pago: es lo primero que se puede corregir en el formulario", () => {
    const r = permisoParaPublicarPuntual({ ...base, sedes: 3, disponibles: 0 });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.campo, "sedeId");
  });
});

describe("reabrir una búsqueda puntual", () => {
  it("solo mientras no haya pasado su plazo", () => {
    assert.equal(puedeReabrirPuntual(enDias(5), AHORA), true);
    assert.equal(puedeReabrirPuntual(enDias(-1), AHORA), false);
    assert.equal(puedeReabrirPuntual(AHORA, AHORA), false, "justo a la hora ya venció");
  });

  it("sin fecha de vencimiento no se reabre: no se sabe de cuándo es", () => {
    assert.equal(puedeReabrirPuntual(null, AHORA), false);
  });
});
