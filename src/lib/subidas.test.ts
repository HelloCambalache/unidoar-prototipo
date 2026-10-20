import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import {
  CARPETA_DE_PASO,
  LIMITE_CUERPO_PETICION,
  LIMITE_PDF,
  detectarArchivo,
  esPathPrivadoPropio,
  esUrlPublicaPropia,
  tipoDeCarpeta,
  urlPublicaDe,
} from "@/lib/subidas";

const UID = "1b8c3355-2755-443f-af6a-0a2a7a06b997";
const OTRO = "00000000-0000-4000-8000-000000000000";
const ARCHIVO = "3f2a9c1e-77aa-4d3b-9c0e-123456789abc.pdf";

const bytes = (...b: number[]) => new Uint8Array(b);
const ascii = (s: string) => new Uint8Array([...s].map((c) => c.charCodeAt(0)));

describe("tipo real del archivo (se mira los bytes, no lo que declara el navegador)", () => {
  it("reconoce JPG, PNG, WebP y PDF", () => {
    assert.deepEqual(detectarArchivo(bytes(0xff, 0xd8, 0xff, 0xe0)), { mime: "image/jpeg", ext: "jpg", clase: "imagen" });
    assert.deepEqual(detectarArchivo(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)), { mime: "image/png", ext: "png", clase: "imagen" });
    assert.deepEqual(detectarArchivo(ascii("RIFF....WEBPVP8 ")), { mime: "image/webp", ext: "webp", clase: "imagen" });
    assert.deepEqual(detectarArchivo(ascii("%PDF-1.7\n")), { mime: "application/pdf", ext: "pdf", clase: "pdf" });
  });

  it("rechaza todo lo demás", () => {
    assert.equal(detectarArchivo(ascii("<html><script>alert(1)</script>")), null);
    assert.equal(detectarArchivo(ascii("MZ\u0090\u0000 programa")), null);
    assert.equal(detectarArchivo(ascii("AAAAAAAAAAAAAAAA")), null);
    assert.equal(detectarArchivo(new Uint8Array()), null);
    assert.equal(detectarArchivo(ascii("%PDF")), null, "un PDF truncado antes de la versión no cuenta");
  });
});

describe("carpetas permitidas", () => {
  it("cada carpeta acepta su tipo y las que no existen no se aceptan", () => {
    assert.equal(tipoDeCarpeta("publico", "logos"), "imagen");
    assert.equal(tipoDeCarpeta("privado", "cv"), "pdf");
    assert.equal(tipoDeCarpeta("privado", "documentos"), "imagen-o-pdf");
    assert.equal(tipoDeCarpeta("privado", "logos"), null);
    assert.equal(tipoDeCarpeta("publico", "cv"), null);
    assert.equal(tipoDeCarpeta("privado", "../otra"), null);
  });

  it("la carpeta de paso de los PDF grandes no es un destino válido de /api/subir ni de las acciones", () => {
    assert.equal(tipoDeCarpeta("privado", CARPETA_DE_PASO), null);
    assert.equal(tipoDeCarpeta("publico", CARPETA_DE_PASO), null);
  });

  it("el límite de PDF es mayor que lo que entra en una petición de Vercel", () => {
    assert.ok(LIMITE_PDF > LIMITE_CUERPO_PETICION);
    assert.ok(LIMITE_CUERPO_PETICION < 4.5 * 1024 * 1024);
  });
});

describe("paths del bucket privado", () => {
  it("acepta solo un archivo propio, en la carpeta indicada", () => {
    assert.equal(esPathPrivadoPropio(`${UID}/documentos/${ARCHIVO}`, UID, "documentos"), true);
    assert.equal(esPathPrivadoPropio(`${UID}/cv/${ARCHIVO}`, UID, "cv"), true);
  });

  it("rechaza el de otra cuenta, otra carpeta, la de paso y los intentos de salirse con ../", () => {
    assert.equal(esPathPrivadoPropio(`${OTRO}/documentos/${ARCHIVO}`, UID, "documentos"), false);
    assert.equal(esPathPrivadoPropio(`${UID}/cv/${ARCHIVO}`, UID, "documentos"), false);
    assert.equal(esPathPrivadoPropio(`${UID}/${CARPETA_DE_PASO}/${ARCHIVO}`, UID, "documentos"), false);
    assert.equal(esPathPrivadoPropio(`${UID}/documentos/../${CARPETA_DE_PASO}/${ARCHIVO}`, UID, "documentos"), false);
    assert.equal(esPathPrivadoPropio(`${UID}/documentos/..`, UID, "documentos"), false, "un nombre que es solo ..");
    assert.equal(esPathPrivadoPropio(`${UID}/documentos/a..b.pdf`, UID, "documentos"), false, "ni uno que contenga ..");
    assert.equal(esPathPrivadoPropio(`${UID}/documentos/`, UID, "documentos"), false);
    assert.equal(esPathPrivadoPropio(`${UID}/documentos/a/b.pdf`, UID, "documentos"), false);
    assert.equal(esPathPrivadoPropio(`${UID}/documentos/a?x=1.pdf`, UID, "documentos"), false);
  });

  it("el de paso es de la cuenta y de esa carpeta (lo que valida /api/subir/confirmar)", () => {
    assert.equal(esPathPrivadoPropio(`${UID}/${CARPETA_DE_PASO}/${ARCHIVO}`, UID, CARPETA_DE_PASO), true);
    assert.equal(esPathPrivadoPropio(`${OTRO}/${CARPETA_DE_PASO}/${ARCHIVO}`, UID, CARPETA_DE_PASO), false);
  });
});

describe("URLs públicas", () => {
  before(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://proyecto.supabase.co";
  });

  it("arma la URL de un path del bucket público", () => {
    assert.equal(urlPublicaDe(`${UID}/logos/a.webp`), `https://proyecto.supabase.co/storage/v1/object/public/publico/${UID}/logos/a.webp`);
  });

  it("solo acepta una URL subida por la misma cuenta", () => {
    assert.equal(esUrlPublicaPropia(urlPublicaDe(`${UID}/logos/a.webp`)!, UID), true);
    assert.equal(esUrlPublicaPropia(urlPublicaDe(`${OTRO}/logos/a.webp`)!, UID), false);
    assert.equal(esUrlPublicaPropia("https://sitio-ajeno.com/foto.png", UID), false);
    assert.equal(esUrlPublicaPropia(urlPublicaDe(`${UID}/`)!, UID), false);
    assert.equal(esUrlPublicaPropia(urlPublicaDe(`${UID}/logos/a.webp?x=1`)!, UID), false);
    assert.equal(esUrlPublicaPropia(urlPublicaDe(`${UID}/../${OTRO}/logos/a.webp`)!, UID), false);
  });
});

describe("nombres de carpeta y de archivo que intentan colarse", () => {
  before(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://proyecto.supabase.co";
  });

  it("las carpetas son solo las de la lista: los nombres heredados de Object no valen", () => {
    for (const nombre of ["constructor", "toString", "valueOf", "hasOwnProperty", "__proto__", "isPrototypeOf"]) {
      assert.equal(tipoDeCarpeta("privado", nombre), null, nombre);
      assert.equal(tipoDeCarpeta("publico", nombre), null, nombre);
    }
  });

  it("un path privado no puede esconder un ../ codificado", () => {
    assert.equal(esPathPrivadoPropio(`${UID}/cv/%2e%2e%2f${OTRO}%2fcv%2f${ARCHIVO}`, UID, "cv"), false);
    assert.equal(esPathPrivadoPropio(`${UID}/cv/%2E%2E/${ARCHIVO}`, UID, "cv"), false);
    assert.equal(esPathPrivadoPropio(`${UID}/cv/a%2Fb.pdf`, UID, "cv"), false);
    assert.equal(esPathPrivadoPropio(`${UID}/cv/${ARCHIVO}`, UID, "cv"), true, "el nombre normal sigue valiendo");
  });

  it("una URL pública tampoco puede esconder un ../ codificado", () => {
    assert.equal(esUrlPublicaPropia(urlPublicaDe(`${UID}/logos/%2e%2e%2f${OTRO}%2flogos%2fa.webp`)!, UID), false);
    assert.equal(esUrlPublicaPropia(urlPublicaDe(`${UID}/logos/a%00.webp`)!, UID), false);
    assert.equal(esUrlPublicaPropia(urlPublicaDe(`${UID}/logos/3f2a9c1e-77aa-4d3b-9c0e-123456789abc.webp`)!, UID), true);
  });
});
