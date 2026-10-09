import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { describe, it } from "node:test";
import { enlaceDeWhatsApp, esTokenDePerfil, rutaDePerfilCompartido, textoParaCompartir, urlDePerfilCompartido } from "./compartir-perfil";

describe("token del perfil compartido", () => {
  it("acepta un token como el que se genera (24 caracteres url-safe)", () => {
    const token = randomBytes(18).toString("base64url");
    assert.equal(token.length, 24);
    assert.equal(esTokenDePerfil(token), true);
  });

  it("rechaza lo que no tiene forma de token", () => {
    assert.equal(esTokenDePerfil(""), false);
    assert.equal(esTokenDePerfil("corto"), false);
    assert.equal(esTokenDePerfil("a".repeat(65)), false);
    assert.equal(esTokenDePerfil("a".repeat(24) + "/../x"), false);
    assert.equal(esTokenDePerfil("a".repeat(23) + " "), false);
    assert.equal(esTokenDePerfil("a".repeat(23) + "%"), false);
  });
});

describe("enlace y texto para compartir", () => {
  const token = "Abc123_-Abc123_-Abc123_-";

  it("arma la ruta y la dirección completa, sin barra doble", () => {
    assert.equal(rutaDePerfilCompartido(token), `/profesional/${token}`);
    assert.equal(urlDePerfilCompartido("https://www.unidoar.com.ar", token), `https://www.unidoar.com.ar/profesional/${token}`);
    assert.equal(urlDePerfilCompartido("https://www.unidoar.com.ar/", token), `https://www.unidoar.com.ar/profesional/${token}`);
  });

  it("el mensaje de WhatsApp lleva el enlace y va escapado", () => {
    const url = urlDePerfilCompartido("https://www.unidoar.com.ar", token);
    const texto = textoParaCompartir(url);
    assert.ok(texto.includes(url));
    const enlace = enlaceDeWhatsApp(texto);
    assert.ok(enlace.startsWith("https://wa.me/?text="));
    assert.equal(decodeURIComponent(enlace.slice("https://wa.me/?text=".length)), texto);
    assert.ok(!enlace.includes(" "));
  });
});
