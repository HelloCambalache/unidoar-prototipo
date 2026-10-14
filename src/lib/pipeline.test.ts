import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { autorDeNota, notaDeTarjeta, puedeVerElContacto } from "./pipeline";

describe("nota de la tarjeta del tablero", () => {
  const sinEntrevista = { entrevista: null };

  it("en Examen preocupacional avisa si falta el examen y, una vez anotado, que está hecho", () => {
    assert.deepEqual(notaDeTarjeta({ etapa: "examen_preocupacional", ...sinEntrevista, examenPreocupacional: null }), { texto: "Falta el examen", tono: "ambar" });
    assert.deepEqual(notaDeTarjeta({ etapa: "examen_preocupacional", ...sinEntrevista, examenPreocupacional: { cuando: "15/10/2026" } }), {
      texto: "Examen realizado ✓",
      tono: "verde",
    });
  });

  it("el resto de las etapas no cambia", () => {
    assert.deepEqual(notaDeTarjeta({ etapa: "oferta", ...sinEntrevista, examenPreocupacional: null }), { texto: "Esperando respuesta", tono: "rosa" });
    assert.equal(notaDeTarjeta({ etapa: "nuevos", ...sinEntrevista, examenPreocupacional: null }), null);
    assert.equal(notaDeTarjeta({ etapa: "contratado", ...sinEntrevista, examenPreocupacional: { cuando: "15/10/2026" } }), null);
  });
});

describe("quién escribió una nota", () => {
  const YO = "11111111-1111-4111-8111-111111111111";
  const OTRA = "22222222-2222-4222-8222-222222222222";

  it("quien mira ve \"Vos\" en sus notas", () => {
    assert.equal(autorDeNota({ usuarioId: YO, yo: YO, nombreEnElEquipo: "Marina Gómez" }), "Vos");
  });

  it("las de otra persona llevan su nombre en el equipo", () => {
    assert.equal(autorDeNota({ usuarioId: OTRA, yo: YO, nombreEnElEquipo: "  Lucía Pérez " }), "Lucía Pérez");
  });

  it("el dueño sin fila propia en el equipo figura con el nombre de contacto de la institución", () => {
    assert.equal(autorDeNota({ usuarioId: OTRA, yo: YO, esPropietario: true, contactoNombre: "Marina Gómez", email: "m@colegio.edu.ar" }), "Marina Gómez");
    // Si no es el dueño, el nombre de contacto no se le presta.
    assert.equal(autorDeNota({ usuarioId: OTRA, yo: YO, esPropietario: false, contactoNombre: "Marina Gómez", email: "lucia@colegio.edu.ar" }), "lucia");
  });

  it("sin nombre se usa la parte local del email, y sin cuenta no hay autor", () => {
    assert.equal(autorDeNota({ usuarioId: OTRA, yo: YO, email: "lucia.perez@colegio.edu.ar" }), "lucia.perez");
    assert.equal(autorDeNota({ usuarioId: OTRA, yo: YO }), null);
    assert.equal(autorDeNota({ usuarioId: null, yo: YO, nombreEnElEquipo: "Marina" }), null);
  });
});

describe("quién muestra su contacto en el tablero", () => {
  it("quien se postuló", () => {
    assert.equal(puedeVerElContacto("postulacion", false), true);
  });

  it("quien le mandó su CV a la institución, aunque la hayan invitado", () => {
    assert.equal(puedeVerElContacto("invitacion", true), true);
  });

  it("no quien solo fue invitado: una invitación no alcanza", () => {
    assert.equal(puedeVerElContacto("invitacion", false), false);
  });
});
