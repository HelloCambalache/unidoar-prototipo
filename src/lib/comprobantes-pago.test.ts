import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CARPETA_COMPROBANTE, leerArchivoDeComprobante, nombreDeComprobanteParaMostrar, rutaDeComprobanteDePago } from "./comprobantes-pago";
import { tipoDeCarpeta } from "./subidas";

const ADMIN = "11111111-1111-4111-8111-111111111111";
const OTRA = "22222222-2222-4222-8222-222222222222";
const PATH = `${ADMIN}/${CARPETA_COMPROBANTE}/3f2a9c1e-0000-4000-8000-000000000001.pdf`;

describe("el comprobante de un pago", () => {
  it("la carpeta existe en el bucket privado y acepta imagen o PDF", () => {
    assert.equal(tipoDeCarpeta("privado", CARPETA_COMPROBANTE), "imagen-o-pdf");
    assert.equal(tipoDeCarpeta("publico", CARPETA_COMPROBANTE), null, "nunca en el bucket público: es un dato financiero");
  });

  it("acepta un archivo que subió esta misma cuenta a la carpeta de comprobantes", () => {
    for (const ext of ["pdf", "jpg", "png", "webp"]) {
      const r = leerArchivoDeComprobante({ path: `${ADMIN}/${CARPETA_COMPROBANTE}/abc.${ext}`, nombre: "transferencia.pdf" }, ADMIN);
      assert.equal(r.ok, true, ext);
    }
    const r = leerArchivoDeComprobante({ path: PATH, nombre: "  Transferencia  nov.pdf " }, ADMIN);
    assert.deepEqual(r, { ok: true, archivo: { path: PATH, nombre: "Transferencia nov.pdf" } });
  });

  it("rechaza el path de otra cuenta, de otra carpeta, con un ../ escondido o de otro tipo de archivo", () => {
    const malos = [
      `${OTRA}/${CARPETA_COMPROBANTE}/abc.pdf`,
      `${ADMIN}/documentos/abc.pdf`,
      `${ADMIN}/${CARPETA_COMPROBANTE}/../documentos/abc.pdf`,
      `${ADMIN}/${CARPETA_COMPROBANTE}/%2e%2e%2fabc.pdf`,
      `${ADMIN}/${CARPETA_COMPROBANTE}/sub/abc.pdf`,
      `${ADMIN}/${CARPETA_COMPROBANTE}/abc.exe`,
      `${ADMIN}/${CARPETA_COMPROBANTE}/`,
      "",
    ];
    for (const path of malos) assert.equal(leerArchivoDeComprobante({ path, nombre: "x" }, ADMIN).ok, false, path);
  });

  it("lo que llega con otra forma no rompe: un path que no es texto se rechaza y un nombre vacío usa el del archivo", () => {
    assert.equal(leerArchivoDeComprobante({ path: 123, nombre: "x" }, ADMIN).ok, false);
    assert.equal(leerArchivoDeComprobante({ path: null, nombre: null }, ADMIN).ok, false);
    const r = leerArchivoDeComprobante({ path: PATH, nombre: undefined }, ADMIN);
    assert.equal(r.ok && r.archivo.nombre, "3f2a9c1e-0000-4000-8000-000000000001.pdf");
  });

  it("se muestra el nombre del archivo, nunca el path, y la dirección para abrirlo lleva solo el id", () => {
    assert.equal(nombreDeComprobanteParaMostrar("recibo.pdf"), "recibo.pdf");
    assert.equal(nombreDeComprobanteParaMostrar("  "), "Comprobante");
    assert.equal(nombreDeComprobanteParaMostrar(null), "Comprobante");
    assert.equal(rutaDeComprobanteDePago("abc"), "/api/comprobantes/abc");
  });
});
