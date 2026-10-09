import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { destinoDePublicar, esPedidoUrgente, queHacerAlPublicar, RUTA_PUBLICAR_BUSQUEDA, RUTA_PUBLICAR_URGENTE } from "@/lib/publicar-busqueda";

describe("botones para publicar una búsqueda", () => {
  it("una institución ingresada va directo a publicar", () => {
    assert.equal(queHacerAlPublicar("institucion"), "publicar");
  });

  it("sin sesión elige entre ingresar y crear la cuenta de institución", () => {
    assert.equal(queHacerAlPublicar(null), "elegir");
  });

  it("un profesional no es mandado a su panel: se le avisa que hace falta una cuenta de institución", () => {
    assert.equal(queHacerAlPublicar("docente"), "otra-cuenta");
  });

  it("el admin va a su propia área", () => {
    assert.equal(queHacerAlPublicar("admin"), "admin");
  });

  it("el destino es la pantalla de publicar, y la urgente arranca como suplencia rápida", () => {
    assert.equal(destinoDePublicar(false), "/institucion/publicar");
    assert.equal(destinoDePublicar(true), "/institucion/publicar?urgente=1");
  });

  it("solo ?urgente=1 cuenta como pedido urgente", () => {
    assert.equal(esPedidoUrgente("1"), true);
    assert.equal(esPedidoUrgente(["1", "0"]), true);
    for (const v of [undefined, "", "0", "true", "si", ["0"], []]) assert.equal(esPedidoUrgente(v), false, String(v));
  });

  it("las rutas de los botones apuntan a la pantalla que decide", () => {
    assert.equal(RUTA_PUBLICAR_BUSQUEDA, "/publicar-busqueda");
    assert.equal(RUTA_PUBLICAR_URGENTE, "/publicar-busqueda?urgente=1");
  });
});
