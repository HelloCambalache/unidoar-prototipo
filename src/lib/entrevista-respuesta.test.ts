import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  avisoDeRespuesta,
  etiquetaDeRespuesta,
  motivoParaNoResponder,
  respuestaDesdeEnlace,
  rutaParaResponder,
} from "./entrevista-respuesta";

describe("respuesta a la entrevista", () => {
  it("lee el parámetro de los botones del mail y nada más", () => {
    assert.equal(respuestaDesdeEnlace("voy"), "voy");
    assert.equal(respuestaDesdeEnlace("no-puedo"), "no_puedo");
    assert.equal(respuestaDesdeEnlace(["no-puedo", "voy"]), "no_puedo");
    assert.equal(respuestaDesdeEnlace("no_puedo"), null);
    assert.equal(respuestaDesdeEnlace("si"), null);
    assert.equal(respuestaDesdeEnlace(undefined), null);
  });

  it("arma la ruta del cajón con la respuesta", () => {
    assert.equal(rutaParaResponder("/docente/postulaciones?abrir=1", "voy"), "/docente/postulaciones?abrir=1&entrevista=voy");
    assert.equal(rutaParaResponder("/docente/postulaciones", "no_puedo"), "/docente/postulaciones?entrevista=no-puedo");
  });

  it("solo deja responder una entrevista agendada y futura", () => {
    const ahora = new Date("2026-10-15T12:00:00Z");
    assert.equal(motivoParaNoResponder(new Date("2026-10-16T12:00:00Z"), ahora), null);
    assert.match(motivoParaNoResponder(new Date("2026-10-14T12:00:00Z"), ahora) ?? "", /ya pasó/);
    assert.match(motivoParaNoResponder(ahora, ahora) ?? "", /ya pasó/);
    assert.match(motivoParaNoResponder(null, ahora) ?? "", /todavía no agendó/);
  });

  it("redacta el aviso para la institución", () => {
    assert.deepEqual(avisoDeRespuesta("Ana Pérez", "Inglés", "voy", null), {
      titulo: "Ana Pérez",
      texto: "confirmó que va a la entrevista para «Inglés».",
    });
    assert.equal(
      avisoDeRespuesta("Ana Pérez", "Inglés", "no_puedo", "El viernes puedo").texto,
      "avisó que no puede ir a la entrevista para «Inglés». Mensaje: «El viernes puedo»",
    );
  });

  it("etiqueta cada estado", () => {
    assert.equal(etiquetaDeRespuesta("voy").tono, "verde");
    assert.equal(etiquetaDeRespuesta("no_puedo").texto, "No puede ir");
    assert.equal(etiquetaDeRespuesta(null).texto, "Sin respuesta");
  });
});
