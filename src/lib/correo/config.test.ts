import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { firmaDeBaja, firmaDeBajaValida, rutaDeBaja } from "./baja";
import { avisarDescartesPorCorreo, destinatariosDelEquipo, modoCorreo, origenDeLosMails, remitenteDe } from "./config";

const USUARIO = "3f2b8c1e-5d4a-4c7b-9e0a-1b2c3d4e5f60";
const OTRO = "3f2b8c1e-5d4a-4c7b-9e0a-1b2c3d4e5f61";
const ENTORNO = { SUPABASE_SERVICE_ROLE_KEY: "una-clave-de-servicio-larga-0123456789" };

describe("configuración de los mails", () => {
  it("sin clave de Resend la app no manda ni anota nada; CORREO_MODO manda sobre la clave", () => {
    assert.equal(modoCorreo({}), "apagado");
    assert.equal(modoCorreo({ RESEND_API_KEY: "  " }), "apagado");
    assert.equal(modoCorreo({ RESEND_API_KEY: "re_123" }), "resend");
    assert.equal(modoCorreo({ RESEND_API_KEY: "re_123", CORREO_MODO: "apagado" }), "apagado");
    assert.equal(modoCorreo({ CORREO_MODO: "consola" }), "consola");
    assert.equal(modoCorreo({ CORREO_MODO: "CONSOLA", RESEND_API_KEY: "re_123" }), "consola");
    // Pedir "resend" sin clave no lo enciende.
    assert.equal(modoCorreo({ CORREO_MODO: "resend" }), "apagado");
  });

  it("remitentes con valores por defecto y configurables", () => {
    assert.equal(remitenteDe("app", {}).de, "UNIDOAR <no-responder@unidoar.com.ar>");
    assert.equal(remitenteDe("app", {}).responderA, "hola@unidoar.com.ar");
    assert.equal(remitenteDe("facturacion", {}).responderA, "facturacion@unidoar.com.ar");
    assert.equal(remitenteDe("app", { CORREO_DE: "UNIDOAR <hola@otro.com>", CORREO_RESPONDER_A: "x@otro.com" }).de, "UNIDOAR <hola@otro.com>");
  });

  it("destinatarios del equipo: lista limpia, en minúsculas y sin repetidos", () => {
    assert.deepEqual(destinatariosDelEquipo({}), []);
    assert.deepEqual(destinatariosDelEquipo({ CORREO_EQUIPO: "A@x.com, b@x.com;a@x.com  c@x.com basura" }), ["a@x.com", "b@x.com", "c@x.com"]);
  });

  it("el origen de los enlaces sale de la URL del sitio, del dominio de producción de Vercel o de localhost", () => {
    assert.equal(origenDeLosMails({ NEXT_PUBLIC_SITE_URL: "https://unidoar.com.ar/" }), "https://unidoar.com.ar");
    assert.equal(origenDeLosMails({ VERCEL_PROJECT_PRODUCTION_URL: "unidoar-prototipo.vercel.app" }), "https://unidoar-prototipo.vercel.app");
    assert.equal(origenDeLosMails({}), "http://localhost:3000");
  });

  it("los descartes solo se avisan por mail si se pide expresamente", () => {
    assert.equal(avisarDescartesPorCorreo({}), false);
    assert.equal(avisarDescartesPorCorreo({ CORREO_AVISAR_DESCARTES: "no" }), false);
    assert.equal(avisarDescartesPorCorreo({ CORREO_AVISAR_DESCARTES: "Si" }), true);
  });
});

describe("enlace de baja de avisos", () => {
  it("la firma es estable y solo vale para esa cuenta", () => {
    const firma = firmaDeBaja(USUARIO, ENTORNO);
    assert.ok(firma && firma.length >= 40);
    assert.equal(firmaDeBaja(USUARIO, ENTORNO), firma);
    assert.ok(firmaDeBajaValida(USUARIO, firma!, ENTORNO));
    assert.ok(firmaDeBajaValida(USUARIO.toUpperCase(), firma!, ENTORNO));
    assert.ok(!firmaDeBajaValida(OTRO, firma!, ENTORNO));
    assert.ok(!firmaDeBajaValida(USUARIO, firma!.slice(0, -1) + (firma!.endsWith("A") ? "B" : "A"), ENTORNO));
    assert.ok(!firmaDeBajaValida(USUARIO, "", ENTORNO));
    assert.ok(!firmaDeBajaValida(USUARIO, "x".repeat(firma!.length), ENTORNO));
  });

  it("otra clave del servidor invalida las firmas, y una clave propia pisa a la de Supabase", () => {
    const firma = firmaDeBaja(USUARIO, ENTORNO)!;
    assert.ok(!firmaDeBajaValida(USUARIO, firma, { SUPABASE_SERVICE_ROLE_KEY: "otra-clave-de-servicio-0123456789" }));
    const propia = firmaDeBaja(USUARIO, { ...ENTORNO, CORREO_SECRETO: "secreto-propio-de-los-mails-123" })!;
    assert.notEqual(propia, firma);
    assert.ok(firmaDeBajaValida(USUARIO, propia, { CORREO_SECRETO: "secreto-propio-de-los-mails-123" }));
  });

  it("sin secreto o con un id que no es uuid no se firma nada", () => {
    assert.equal(firmaDeBaja(USUARIO, {}), null);
    assert.equal(firmaDeBaja(USUARIO, { SUPABASE_SERVICE_ROLE_KEY: "corta" }), null);
    assert.equal(firmaDeBaja("no-es-un-uuid", ENTORNO), null);
    assert.equal(rutaDeBaja(USUARIO, {}), null);
    assert.ok(!firmaDeBajaValida(USUARIO, "cualquiera", {}));
  });

  it("la ruta lleva el id y la firma, y se puede verificar", () => {
    const ruta = rutaDeBaja(USUARIO, ENTORNO)!;
    assert.ok(ruta.startsWith(`/avisos/baja?u=${USUARIO}&t=`));
    const t = new URL(ruta, "https://x.test").searchParams.get("t")!;
    assert.ok(firmaDeBajaValida(USUARIO, t, ENTORNO));
  });
});
