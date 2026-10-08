import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { estadoParaDocente, ETAPAS_MOVIBLES, faltaExamenPreocupacional, textoDeCierreDeBusqueda } from "./postulaciones";

describe("estado de una postulación para el profesional", () => {
  it("una postulación archivada se ve como enviada y activa mientras la búsqueda sigue abierta (no se le avisa)", () => {
    for (const busqueda of ["activa", "pausada"] as const) {
      assert.deepEqual(estadoParaDocente("descartado", busqueda), estadoParaDocente("nuevos", busqueda));
      assert.equal(estadoParaDocente("descartado", busqueda).texto, "Postulación enviada");
      assert.equal(estadoParaDocente("descartado", busqueda).activa, true);
    }
  });

  it("cuando la búsqueda se cierra, la archivada pasa a 'Búsqueda cerrada' como todas", () => {
    assert.deepEqual(estadoParaDocente("descartado", "cerrada"), { texto: "Búsqueda cerrada", tono: "neutro", activa: false });
    assert.deepEqual(estadoParaDocente("nuevos", "cerrada"), estadoParaDocente("descartado", "cerrada"));
  });

  it("el resto de los estados no cambia", () => {
    assert.equal(estadoParaDocente("contratado", "cerrada").texto, "Contratada");
    assert.equal(estadoParaDocente("preseleccionados", "activa").texto, "Preseleccionada");
    assert.equal(estadoParaDocente("entrevista", "activa").texto, "Entrevista agendada");
    assert.equal(estadoParaDocente("oferta", "activa").texto, "Oferta recibida");
    assert.equal(estadoParaDocente("nuevos", "activa").texto, "Postulación enviada");
  });
});

describe("examen preocupacional", () => {
  it("el profesional ve si el examen está pendiente o ya realizado, y es una etapa activa", () => {
    assert.deepEqual(estadoParaDocente("examen_preocupacional", "activa"), { texto: "Examen preocupacional pendiente", tono: "ambar", activa: true });
    assert.deepEqual(estadoParaDocente("examen_preocupacional", "activa", true), { texto: "Examen preocupacional realizado", tono: "verde", activa: true });
  });

  it("si la búsqueda se cierra, pasa a \"Búsqueda cerrada\" como las demás", () => {
    assert.equal(estadoParaDocente("examen_preocupacional", "cerrada", true).texto, "Búsqueda cerrada");
  });

  it("se puede mover a esa etapa desde el tablero, justo después de Oferta", () => {
    const i = ETAPAS_MOVIBLES.indexOf("examen_preocupacional");
    assert.ok(i > 0);
    assert.equal(ETAPAS_MOVIBLES[i - 1], "oferta");
  });

  it("Contratar pide confirmar solo si está en esa etapa y todavía no anotaron el examen", () => {
    assert.equal(faltaExamenPreocupacional({ etapa: "examen_preocupacional", examenPreocupacionalEn: null }), true);
    assert.equal(faltaExamenPreocupacional({ etapa: "examen_preocupacional", examenPreocupacionalEn: new Date() }), false);
    // Quien nunca pasó por la etapa (la institución no la usa) no recibe ningún aviso.
    for (const etapa of ["nuevos", "preseleccionados", "entrevista", "oferta", "contratado", "descartado"] as const) {
      assert.equal(faltaExamenPreocupacional({ etapa, examenPreocupacionalEn: null }), false, etapa);
    }
  });
});

describe("aviso de cierre de búsqueda", () => {
  it("al postulante le dice que se cubrió, le agradece y lo invita a seguir", () => {
    const t = textoDeCierreDeBusqueda("Maestra Nivel Inicial", false);
    assert.equal(
      t,
      "cerró la búsqueda «Maestra Nivel Inicial»: el puesto ya se cubrió. ¡Gracias por postularte! Seguí postulándote a otras búsquedas.",
    );
  });

  it("a quien fue invitado y no se postuló no le agradece la postulación", () => {
    const t = textoDeCierreDeBusqueda("Maestra Nivel Inicial", true);
    assert.ok(t.includes("a la que te había invitado"));
    assert.ok(t.includes("Seguí postulándote a otras búsquedas."));
    assert.ok(!t.includes("por postularte"));
  });

  it("los dos textos son distintos (la deduplicación del día los distingue) y encajan después del nombre de la institución", () => {
    assert.notEqual(textoDeCierreDeBusqueda("X", true), textoDeCierreDeBusqueda("X", false));
    for (const invitado of [true, false]) assert.match(textoDeCierreDeBusqueda("X", invitado), /^cerró la búsqueda «X»/);
  });
});
