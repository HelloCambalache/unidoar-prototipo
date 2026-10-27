import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CANALES,
  enlaceDeCanal,
  mensajeDeBusqueda,
  mensajeDeInstitucion,
  mensajeDePerfil,
  resumenDeBusqueda,
  rutaDeInstitucion,
  rutaDeOferta,
  urlCompleta,
  type Mensaje,
} from "./compartir";

const ID = "3f2a9c1e-5b7d-4e8a-9c01-2d3e4f5a6b7c";
const M: Mensaje = { url: "https://www.unidoar.com.ar/ofertas/abc?x=1&y=2", texto: "Búsqueda: Profe de inglés & más", asunto: "Profe de inglés · Colegio" };

describe("enlaces de los canales", () => {
  it("hay un enlace por canal y todos llevan el enlace compartido escapado", () => {
    for (const { canal } of CANALES) {
      const enlace = enlaceDeCanal(canal, M);
      assert.ok(enlace.includes(encodeURIComponent(M.url)) || canal === "whatsapp" || canal === "correo", canal);
      assert.ok(!enlace.includes(" "), `${canal}: sin espacios sueltos`);
    }
  });

  it("WhatsApp lleva el texto y el enlace juntos", () => {
    const enlace = enlaceDeCanal("whatsapp", M);
    assert.ok(enlace.startsWith("https://wa.me/?text="));
    assert.equal(decodeURIComponent(enlace.slice("https://wa.me/?text=".length)), `${M.texto} ${M.url}`);
  });

  it("Facebook y LinkedIn reciben solo la dirección; X, el texto y la dirección", () => {
    assert.equal(enlaceDeCanal("facebook", M), `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(M.url)}`);
    assert.equal(enlaceDeCanal("linkedin", M), `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(M.url)}`);
    const x = new URL(enlaceDeCanal("x", M));
    assert.equal(x.origin + x.pathname, "https://x.com/intent/post");
    assert.equal(x.searchParams.get("text"), M.texto);
    assert.equal(x.searchParams.get("url"), M.url);
  });

  it("el correo lleva asunto y cuerpo (texto, línea en blanco y enlace)", () => {
    const enlace = enlaceDeCanal("correo", M);
    assert.ok(enlace.startsWith("mailto:?"));
    const p = new URLSearchParams(enlace.slice("mailto:?".length));
    assert.equal(p.get("subject"), M.asunto);
    assert.equal(p.get("body"), `${M.texto}\n\n${M.url}`);
  });

  it("un enlace con & y = en la dirección no rompe los parámetros", () => {
    const x = new URL(enlaceDeCanal("x", M));
    assert.equal(x.searchParams.get("url"), "https://www.unidoar.com.ar/ofertas/abc?x=1&y=2");
  });
});

describe("rutas y mensajes de lo que se comparte", () => {
  it("la oferta y la institución tienen ruta pública, y la dirección completa no repite la barra", () => {
    assert.equal(rutaDeOferta(ID), `/ofertas/${ID}`);
    assert.equal(rutaDeInstitucion("colegio-san-andres"), "/instituciones/colegio-san-andres");
    assert.equal(urlCompleta("https://www.unidoar.com.ar/", rutaDeOferta(ID)), `https://www.unidoar.com.ar/ofertas/${ID}`);
    assert.equal(urlCompleta("https://www.unidoar.com.ar", rutaDeOferta(ID)), `https://www.unidoar.com.ar/ofertas/${ID}`);
  });

  it("el mensaje de una búsqueda dice el puesto y la institución", () => {
    const m = mensajeDeBusqueda({ puesto: "Profe de natación", institucion: "Club Atlético", url: "https://x.test/ofertas/1" });
    assert.ok(m.texto.includes("Profe de natación") && m.texto.includes("Club Atlético"));
    assert.ok(m.asunto.includes("Profe de natación"));
    assert.equal(m.url, "https://x.test/ofertas/1");
  });

  it("el de una institución y el de un perfil llevan su enlace", () => {
    assert.equal(mensajeDeInstitucion({ nombre: "Colegio", url: "https://x.test/i" }).url, "https://x.test/i");
    assert.equal(mensajeDePerfil("https://x.test/p").url, "https://x.test/p");
    assert.ok(mensajeDePerfil("https://x.test/p").texto.includes("perfil profesional"));
  });
});

describe("resumen para la vista previa", () => {
  it("usa lo que escribió la institución, sin saltos de línea y cortado a 160", () => {
    assert.equal(resumenDeBusqueda({ descripcion: "Buscamos\n\n  profe de inglés", tipo: "Titular", zona: "Olivos", institucion: "Colegio" }), "Buscamos profe de inglés");
    const larga = resumenDeBusqueda({ descripcion: "a".repeat(400), tipo: "Titular", zona: null, institucion: "Colegio" });
    assert.ok(larga.length <= 160 && larga.endsWith("…"));
  });

  it("sin descripción arma una frase con el tipo, la zona y la institución", () => {
    assert.equal(resumenDeBusqueda({ descripcion: null, tipo: "Suplencia", zona: "Olivos", institucion: "Colegio" }), "Suplencia · Olivos · Colegio");
    assert.equal(resumenDeBusqueda({ descripcion: "   ", tipo: "Suplencia", zona: null, institucion: "Colegio" }), "Suplencia · Colegio");
  });
});
