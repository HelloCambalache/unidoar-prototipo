import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { estadoDeFactura, numeroDeComprobante, periodoLegible, rutaDeComprobante } from "@/lib/facturacion";

const ID = "3f2a9c1e-5b7d-4e8a-9c01-2d3e4f5a6b7c";

describe("comprobante de una factura", () => {
  it("el número son los primeros 8 caracteres del id, en mayúsculas", () => {
    assert.equal(numeroDeComprobante(ID), "3F2A9C1E");
  });

  it("la ruta lleva el id completo y es interna (se arma contra el sitio en los mails)", () => {
    assert.equal(rutaDeComprobante(ID), `/institucion/plan/facturas/${ID}`);
    assert.ok(rutaDeComprobante(ID).startsWith("/"));
  });
});

describe("vocabulario de facturas", () => {
  it("un estado que no se reconoce cuenta como pendiente", () => {
    assert.equal(estadoDeFactura("pagada"), "pagada");
    assert.equal(estadoDeFactura("vencida"), "vencida");
    assert.equal(estadoDeFactura("lo que sea"), "pendiente");
  });

  it("el período se escribe «Octubre de 2026»", () => {
    assert.equal(periodoLegible("2026-10"), "Octubre de 2026");
  });
});
