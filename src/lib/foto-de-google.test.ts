import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { LADO_DE_LA_FOTO, urlDeFotoDeGoogle } from "./foto-de-google";

describe("urlDeFotoDeGoogle", () => {
  it("acepta una foto de los servidores de Google y la pide en el tamaño que usamos", () => {
    assert.equal(
      urlDeFotoDeGoogle("https://lh3.googleusercontent.com/a/ACg8ocJxyz123=s96-c"),
      `https://lh3.googleusercontent.com/a/ACg8ocJxyz123=s${LADO_DE_LA_FOTO}-c`,
    );
    assert.equal(
      urlDeFotoDeGoogle("https://lh6.googleusercontent.com/-abc/AAAAAAAAAAI/AAAAAAAAAAA/photo.jpg"),
      `https://lh6.googleusercontent.com/-abc/AAAAAAAAAAI/AAAAAAAAAAA/photo.jpg=s${LADO_DE_LA_FOTO}-c`,
    );
  });

  it("cambia el tamaño aunque venga con otras opciones", () => {
    assert.equal(
      urlDeFotoDeGoogle("https://lh4.googleusercontent.com/a/ACg8oc=s512"),
      `https://lh4.googleusercontent.com/a/ACg8oc=s${LADO_DE_LA_FOTO}-c`,
    );
  });

  it("descarta lo que no es de Google, aunque lo parezca", () => {
    for (const malo of [
      "https://evil.com/a.jpg",
      "https://lh3.googleusercontent.com.evil.com/a/x=s96-c",
      "https://evil.com/lh3.googleusercontent.com/a/x",
      "https://lh3.googleusercontent.com@evil.com/a/x",
      "https://googleusercontent.com/a/x",
      "https://lh7.googleusercontent.com/a/x",
      "https://lh3.google.com/a/x",
    ]) {
      assert.equal(urlDeFotoDeGoogle(malo), null, malo);
    }
  });

  it("descarta http, usuario y clave, puerto y caminos raros", () => {
    assert.equal(urlDeFotoDeGoogle("http://lh3.googleusercontent.com/a/x=s96-c"), null);
    assert.equal(urlDeFotoDeGoogle("https://usuario:clave@lh3.googleusercontent.com/a/x"), null);
    assert.equal(urlDeFotoDeGoogle("https://lh3.googleusercontent.com:8443/a/x"), null);
    assert.equal(urlDeFotoDeGoogle("https://lh3.googleusercontent.com/"), null);
  });

  it("descarta lo vacío, lo que no es una dirección y lo demasiado largo", () => {
    assert.equal(urlDeFotoDeGoogle(null), null);
    assert.equal(urlDeFotoDeGoogle(undefined), null);
    assert.equal(urlDeFotoDeGoogle(""), null);
    assert.equal(urlDeFotoDeGoogle("no es una url"), null);
    assert.equal(urlDeFotoDeGoogle(`https://lh3.googleusercontent.com/a/${"x".repeat(500)}`), null);
  });
});
