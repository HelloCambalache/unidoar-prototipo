import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CARPETA_CV_CONTACTO,
  MAX_CVS_POR_INSTITUCION,
  aplicarCambioDeCv,
  cabeOtroCv,
  leerCambioDeCv,
  nombreDeCvParaMostrar,
  rutaDeCvDeContacto,
} from "./contacto-cv";
import { objetoDeArchivo, patronDePaths } from "./archivos";
import { tipoDeCarpeta } from "./subidas";

const USUARIO = "3f2a9c1e-5b7d-4e8a-9c01-2d3e4f5a6b7c";
const OTRO = "00000000-0000-4000-8000-000000000000";
const ARCHIVO = "11111111-2222-4333-8444-555555555555.pdf";
const propio = `${USUARIO}/${CARPETA_CV_CONTACTO}/${ARCHIVO}`;

const leer = (accion: unknown, path?: unknown, nombre?: unknown) => leerCambioDeCv({ accion, path, nombre }, USUARIO);

describe("CV de un contacto: qué se acepta del navegador", () => {
  it("sin el campo, o con «igual», no cambia nada", () => {
    assert.deepEqual(leer(null), { ok: true, cambio: { tipo: "igual" } });
    assert.deepEqual(leer(undefined), { ok: true, cambio: { tipo: "igual" } });
    assert.deepEqual(leer(""), { ok: true, cambio: { tipo: "igual" } });
    assert.deepEqual(leer("igual", propio), { ok: true, cambio: { tipo: "igual" } }, "un path de más no se usa");
  });

  it("«quitar» quita el CV", () => {
    assert.deepEqual(leer("quitar"), { ok: true, cambio: { tipo: "quitar" } });
  });

  it("un CV nuevo se acepta solo si lo subió esta cuenta a la carpeta de CV de contactos", () => {
    assert.deepEqual(leer("nuevo", propio, "  Mi  CV.pdf "), { ok: true, cambio: { tipo: "nuevo", path: propio, nombre: "Mi CV.pdf" } });
    assert.equal(leer("nuevo", `${OTRO}/${CARPETA_CV_CONTACTO}/${ARCHIVO}`).ok, false, "de otra cuenta");
    assert.equal(leer("nuevo", `${USUARIO}/cv/${ARCHIVO}`).ok, false, "de otra carpeta (la del CV de un profesional)");
    assert.equal(leer("nuevo", `${USUARIO}/documentos/${ARCHIVO}`).ok, false, "ni un documento");
    assert.equal(leer("nuevo", `${USUARIO}/subidas/${ARCHIVO}`).ok, false, "ni la carpeta de paso");
    assert.equal(leer("nuevo", `${USUARIO}/${CARPETA_CV_CONTACTO}/../cv/${ARCHIVO}`).ok, false, "ni un ../");
    assert.equal(leer("nuevo", `${USUARIO}/${CARPETA_CV_CONTACTO}/%2e%2e%2f${ARCHIVO}`).ok, false, "ni un ../ codificado");
    assert.equal(leer("nuevo", `${USUARIO}/${CARPETA_CV_CONTACTO}/${ARCHIVO.replace(".pdf", ".png")}`).ok, false, "solo PDF");
    assert.equal(leer("nuevo", "").ok, false, "sin path");
    assert.equal(leer("nuevo", 123).ok, false, "un path que no es texto");
    assert.equal(leer("nuevo").ok, false);
  });

  it("una acción desconocida se rechaza", () => {
    assert.equal(leer("borrar-todo").ok, false);
    assert.equal(leer(7).ok, false);
    assert.equal(leer({}).ok, false);
  });

  it("si el navegador no manda el nombre, se usa el del archivo", () => {
    assert.deepEqual(leer("nuevo", propio), { ok: true, cambio: { tipo: "nuevo", path: propio, nombre: ARCHIVO } });
    assert.deepEqual(leer("nuevo", propio, 42), { ok: true, cambio: { tipo: "nuevo", path: propio, nombre: ARCHIVO } });
  });
});

describe("CV de un contacto: qué queda guardado", () => {
  const actual = { path: `${USUARIO}/${CARPETA_CV_CONTACTO}/aaaaaaaa-2222-4333-8444-555555555555.pdf`, nombre: "viejo.pdf" };

  it("«igual» deja lo que había (con o sin CV)", () => {
    assert.deepEqual(aplicarCambioDeCv(actual, { tipo: "igual" }), actual);
    assert.equal(aplicarCambioDeCv(null, { tipo: "igual" }), null);
  });

  it("«quitar» lo borra y «nuevo» lo reemplaza", () => {
    assert.equal(aplicarCambioDeCv(actual, { tipo: "quitar" }), null);
    assert.deepEqual(aplicarCambioDeCv(actual, { tipo: "nuevo", path: propio, nombre: "nuevo.pdf" }), { path: propio, nombre: "nuevo.pdf" });
    assert.deepEqual(aplicarCambioDeCv(null, { tipo: "nuevo", path: propio, nombre: "nuevo.pdf" }), { path: propio, nombre: "nuevo.pdf" });
  });
});

describe("CV de un contacto: tope, nombre y enlace", () => {
  it("hay un tope de contactos con CV", () => {
    assert.equal(cabeOtroCv(0), true);
    assert.equal(cabeOtroCv(MAX_CVS_POR_INSTITUCION - 1), true);
    assert.equal(cabeOtroCv(MAX_CVS_POR_INSTITUCION), false);
  });

  it("la pantalla muestra el nombre del archivo y nunca el path; sin CV no muestra nada", () => {
    assert.equal(nombreDeCvParaMostrar(propio, "María Gómez.pdf"), "María Gómez.pdf");
    assert.equal(nombreDeCvParaMostrar(propio, null), "CV.pdf");
    assert.equal(nombreDeCvParaMostrar(propio, "   "), "CV.pdf");
    assert.equal(nombreDeCvParaMostrar(null, "huérfano.pdf"), null);
  });

  it("el enlace va por la ruta que comprueba la cuenta", () => {
    assert.equal(rutaDeCvDeContacto(OTRO), `/api/cv/contacto/${OTRO}`);
  });
});

describe("CV de un contacto: Storage", () => {
  it("la carpeta es privada y solo de PDF (la subida no la acepta como imagen ni en el bucket público)", () => {
    assert.equal(tipoDeCarpeta("privado", CARPETA_CV_CONTACTO), "pdf");
    assert.equal(tipoDeCarpeta("publico", CARPETA_CV_CONTACTO), null);
  });

  it("la limpieza de Storage reconoce la carpeta (si no, la tomaría por ajena y no la borraría al quitar el CV)", () => {
    assert.deepEqual(objetoDeArchivo(propio), { bucket: "privado", path: propio });
    assert.match(propio, new RegExp(patronDePaths()));
  });
});
