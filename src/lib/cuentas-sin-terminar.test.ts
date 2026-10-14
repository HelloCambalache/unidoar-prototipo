import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { HORAS_MINIMAS_SIN_TERMINAR, etapaDeAltaSinTerminar, horasDesde, impedimentoDeBorrarCuentaSinTerminar } from "./cuentas-sin-terminar";

const AHORA = new Date("2026-10-20T12:00:00Z");
const haceHoras = (h: number) => new Date(AHORA.getTime() - h * 3_600_000);

const base = { rol: "docente", tieneAltaCompleta: false, esDemo: false, creadaEn: haceHoras(48), ahora: AHORA, esElMismoAdmin: false };

describe("a qué cuenta se la puede borrar desde Altas sin terminar", () => {
  it("a un profesional o una institución que se quedó a medias hace más de un día", () => {
    assert.equal(impedimentoDeBorrarCuentaSinTerminar(base), null);
    assert.equal(impedimentoDeBorrarCuentaSinTerminar({ ...base, rol: "institucion" }), null);
  });

  it("también a quien solo existe en el acceso (sin fila de usuario)", () => {
    assert.equal(impedimentoDeBorrarCuentaSinTerminar({ ...base, rol: null }), null);
  });

  it("no a una cuenta recién registrada: puede estar completando el alta", () => {
    assert.match(impedimentoDeBorrarCuentaSinTerminar({ ...base, creadaEn: haceHoras(2) }) ?? "", /menos de 24 horas/);
    assert.match(impedimentoDeBorrarCuentaSinTerminar({ ...base, creadaEn: haceHoras(HORAS_MINIMAS_SIN_TERMINAR - 0.1) }) ?? "", /menos de 24 horas/);
    assert.equal(impedimentoDeBorrarCuentaSinTerminar({ ...base, creadaEn: haceHoras(HORAS_MINIMAS_SIN_TERMINAR) }), null);
  });

  it("no a una cuenta que ya terminó el alta (se da de baja desde su ficha)", () => {
    assert.match(impedimentoDeBorrarCuentaSinTerminar({ ...base, tieneAltaCompleta: true }) ?? "", /terminó el alta/);
  });

  it("no a una cuenta del equipo, a un perfil de ejemplo ni a uno mismo", () => {
    assert.match(impedimentoDeBorrarCuentaSinTerminar({ ...base, rol: "admin" }) ?? "", /equipo de UNIDOAR/);
    assert.match(impedimentoDeBorrarCuentaSinTerminar({ ...base, esDemo: true }) ?? "", /ejemplo/);
    assert.match(impedimentoDeBorrarCuentaSinTerminar({ ...base, esElMismoAdmin: true }) ?? "", /propia cuenta/);
  });

  it("calcula las horas desde el registro", () => {
    assert.equal(horasDesde(haceHoras(36), AHORA), 36);
    assert.equal(horasDesde(AHORA, AHORA), 0);
  });
});

describe("en qué punto se quedó", () => {
  it("sin fila de usuario: nunca confirmó el mail, o lo confirmó y no pasó de ahí", () => {
    assert.equal(etapaDeAltaSinTerminar({ enUsuarios: false, confirmoElMail: false, perfilEmpezado: false }), "Nunca confirmó el mail");
    assert.equal(etapaDeAltaSinTerminar({ enUsuarios: false, confirmoElMail: true, perfilEmpezado: false }), "Confirmó el mail y no pasó de ahí");
  });

  it("con fila de usuario: eligió el rol, o empezó el perfil", () => {
    assert.equal(etapaDeAltaSinTerminar({ enUsuarios: true, confirmoElMail: true, perfilEmpezado: false }), "Eligió el rol y no siguió");
    assert.equal(etapaDeAltaSinTerminar({ enUsuarios: true, confirmoElMail: true, perfilEmpezado: true }), "Empezó a llenar su perfil");
  });
});
