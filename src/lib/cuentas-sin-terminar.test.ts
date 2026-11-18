import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DIAS_ENTRE_AVISOS,
  HORAS_MINIMAS_SIN_TERMINAR,
  MAX_AVISOS_POR_DIA,
  MAX_AVISOS_POR_PERSONA,
  SIN_AVISOS,
  cupoDeAvisosDeHoy,
  diasParaVolverAAvisar,
  etapaDeAltaSinTerminar,
  etiquetaDeAvisos,
  horasDesde,
  impedimentoDeAvisar,
  impedimentoDeBorrarCuentaSinTerminar,
  tipoDeAvisoDeAlta,
} from "./cuentas-sin-terminar";

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

describe("qué se le manda a cada cuenta", () => {
  it("a quien nunca confirmó el mail, el mail de confirmación; al resto, un recordatorio", () => {
    assert.equal(tipoDeAvisoDeAlta({ enUsuarios: false, confirmoElMail: false }), "confirmacion");
    assert.equal(tipoDeAvisoDeAlta({ enUsuarios: false, confirmoElMail: true }), "recordatorio");
    assert.equal(tipoDeAvisoDeAlta({ enUsuarios: true, confirmoElMail: null }), "recordatorio");
    assert.equal(tipoDeAvisoDeAlta({ enUsuarios: true, confirmoElMail: false }), "recordatorio");
  });
});

describe("a quién se le puede mandar un aviso desde Altas sin terminar", () => {
  const cuenta = { rol: "docente", tieneAltaCompleta: false, esDemo: false, creadaEn: haceHoras(72), ahora: AHORA, esElMismoAdmin: false };
  const hace = (dias: number): Date => new Date(AHORA.getTime() - dias * 86_400_000);

  it("a una cuenta que se quedó a medias hace más de un día y nunca recibió un aviso", () => {
    assert.equal(impedimentoDeAvisar(cuenta, SIN_AVISOS), null);
    assert.equal(impedimentoDeAvisar({ ...cuenta, rol: "institucion" }, SIN_AVISOS), null);
    assert.equal(impedimentoDeAvisar({ ...cuenta, rol: null }, SIN_AVISOS), null);
  });

  it("no a una recién registrada, a una que ya terminó el alta, a una del equipo, a un perfil de ejemplo ni a uno mismo", () => {
    assert.match(impedimentoDeAvisar({ ...cuenta, creadaEn: haceHoras(2) }, SIN_AVISOS) ?? "", /menos de 24 horas/);
    assert.match(impedimentoDeAvisar({ ...cuenta, tieneAltaCompleta: true }, SIN_AVISOS) ?? "", /terminó el alta/);
    assert.match(impedimentoDeAvisar({ ...cuenta, rol: "admin" }, SIN_AVISOS) ?? "", /equipo/);
    assert.match(impedimentoDeAvisar({ ...cuenta, esDemo: true }, SIN_AVISOS) ?? "", /ejemplo/);
    assert.match(impedimentoDeAvisar({ ...cuenta, esElMismoAdmin: true }, SIN_AVISOS) ?? "", /propia cuenta/);
  });

  it("no a quien ya recibió el máximo de avisos, aunque haya pasado mucho tiempo", () => {
    assert.match(impedimentoDeAvisar(cuenta, { cantidad: MAX_AVISOS_POR_PERSONA, ultimo: hace(90) }) ?? "", /no le escribimos más/);
    assert.equal(impedimentoDeAvisar(cuenta, { cantidad: MAX_AVISOS_POR_PERSONA - 1, ultimo: hace(30) }), null);
  });

  it("no a quien recibió uno hace menos de una semana, y dice cuántos días faltan", () => {
    assert.match(impedimentoDeAvisar(cuenta, { cantidad: 1, ultimo: hace(2) }) ?? "", /en 5 días/);
    assert.match(impedimentoDeAvisar(cuenta, { cantidad: 1, ultimo: hace(DIAS_ENTRE_AVISOS - 0.5) }) ?? "", /en 1 día./);
    assert.equal(impedimentoDeAvisar(cuenta, { cantidad: 1, ultimo: hace(DIAS_ENTRE_AVISOS) }), null);
  });

  it("cuenta los días que faltan, redondeando para arriba", () => {
    assert.equal(diasParaVolverAAvisar(SIN_AVISOS, AHORA), 0);
    assert.equal(diasParaVolverAAvisar({ cantidad: 1, ultimo: hace(0) }, AHORA), DIAS_ENTRE_AVISOS);
    assert.equal(diasParaVolverAAvisar({ cantidad: 1, ultimo: hace(6.2) }, AHORA), 1);
    assert.equal(diasParaVolverAAvisar({ cantidad: 1, ultimo: hace(20) }, AHORA), 0);
  });

  it("el tope diario deja lo que falta y nunca baja de cero", () => {
    assert.equal(cupoDeAvisosDeHoy(0), MAX_AVISOS_POR_DIA);
    assert.equal(cupoDeAvisosDeHoy(MAX_AVISOS_POR_DIA - 5), 5);
    assert.equal(cupoDeAvisosDeHoy(MAX_AVISOS_POR_DIA), 0);
    assert.equal(cupoDeAvisosDeHoy(MAX_AVISOS_POR_DIA + 30), 0);
    assert.equal(cupoDeAvisosDeHoy(-3), MAX_AVISOS_POR_DIA);
  });

  it("la columna dice cuántos avisos recibió y cuándo fue el último", () => {
    const cuando = () => "hace 3 días";
    assert.equal(etiquetaDeAvisos(SIN_AVISOS, cuando), "Ninguno");
    assert.equal(etiquetaDeAvisos({ cantidad: 1, ultimo: hace(3) }, cuando), "1 aviso · hace 3 días");
    assert.equal(etiquetaDeAvisos({ cantidad: 2, ultimo: hace(3) }, cuando), "2 avisos · hace 3 días");
  });
});
