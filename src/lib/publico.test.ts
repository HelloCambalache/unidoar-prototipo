import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { enlaceWhatsapp } from "@/lib/pipeline";
import { CONTACTO_SITIO, logosEnMovimiento, MINIMO_PARA_TIRA_EN_MOVIMIENTO, sinCifrasDeLaRed } from "@/lib/publico";

describe("tira de logos de la portada", () => {
  it("con pocas fundadoras se muestran quietas, sin repetir ninguna; con varias, corre", () => {
    assert.equal(logosEnMovimiento(1), false, "una sola no se repite nueve veces para llenar el ancho");
    assert.equal(logosEnMovimiento(MINIMO_PARA_TIRA_EN_MOVIMIENTO - 1), false);
    assert.equal(logosEnMovimiento(MINIMO_PARA_TIRA_EN_MOVIMIENTO), true);
    assert.equal(logosEnMovimiento(24), true);
  });
});

describe("cifras de la red ocultas", () => {
  const resumen = {
    docentesVerificados: 16,
    institucionesVerificadas: 1,
    busquedasActivas: 7,
    urgentes: 2,
    disciplinas: 70,
    tiposInstitucion: 3,
    categorias: {
      educador: { verificados: 11, busquedasActivas: 5, institucionesBuscando: 2, urgentes: 1 },
      entrenador: { verificados: 3, busquedasActivas: 1, institucionesBuscando: 1, urgentes: 1 },
      guardavidas: { verificados: 2, busquedasActivas: 1, institucionesBuscando: 1, urgentes: 0 },
    },
  };

  it("pone en cero todas las cifras de la red, también las de cada categoría", () => {
    const r = sinCifrasDeLaRed(resumen);
    assert.deepEqual(
      [r.docentesVerificados, r.institucionesVerificadas, r.busquedasActivas, r.disciplinas, r.tiposInstitucion],
      [0, 0, 0, 0, 0],
    );
    for (const c of Object.values(r.categorias)) assert.deepEqual([c.verificados, c.busquedasActivas, c.institucionesBuscando], [0, 0, 0]);
  });

  it("no toca las búsquedas urgentes abiertas, que no son una cifra de la red", () => {
    const r = sinCifrasDeLaRed(resumen);
    assert.equal(r.urgentes, 2);
    assert.deepEqual(Object.values(r.categorias).map((c) => c.urgentes), [1, 1, 0]);
  });

  it("no modifica el resumen que recibe", () => {
    sinCifrasDeLaRed(resumen);
    assert.equal(resumen.docentesVerificados, 16);
    assert.equal(resumen.categorias.educador.verificados, 11);
  });
});

describe("contacto del sitio", () => {
  it("el email tiene forma de email y no es uno de los buzones que nunca existieron", () => {
    assert.match(CONTACTO_SITIO.email, /^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    assert.ok(!/^(hola|facturacion|no-responder)@unidoar\.com/.test(CONTACTO_SITIO.email), "ese buzón no recibe mails");
  });

  it("el WhatsApp se reconoce como número argentino y arma su enlace wa.me", () => {
    assert.ok(CONTACTO_SITIO.whatsapp, "la tarjeta de WhatsApp de /contacto necesita el número");
    assert.equal(enlaceWhatsapp(CONTACTO_SITIO.whatsapp), "https://wa.me/5491154735876");
  });
});
