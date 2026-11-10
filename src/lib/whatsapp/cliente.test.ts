import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { enviarWhatsapp, interpretarRespuestaWa, pedidoDeMensaje, type MensajeDeWhatsapp } from "./cliente";
import { datosDeAviso } from "./plantillas";

const aviso: MensajeDeWhatsapp = {
  tipo: "plantilla",
  para: "5491154735876",
  plantilla: "unidoar_oferta",
  datos: datosDeAviso("unidoar_oferta", ["Colegio San Andrés", "Ed. Física"], "/docente/postulaciones?abrir=1"),
};

describe("respuesta de Meta", () => {
  it("un 200 con el id del mensaje es éxito", () => {
    assert.deepEqual(interpretarRespuestaWa(200, { messages: [{ id: "wamid.ABC" }] }), { ok: true, id: "wamid.ABC" });
  });

  it("un 200 sin id no es éxito (no hay forma de seguirlo)", () => {
    assert.equal(interpretarRespuestaWa(200, {}).ok, false);
    assert.equal(interpretarRespuestaWa(200, null).ok, false);
  });

  it("los errores de pedidos de más y los fallos de Meta se reintentan", () => {
    assert.equal(interpretarRespuestaWa(429, {}).ok, false);
    assert.equal((interpretarRespuestaWa(429, {}) as { reintentable: boolean }).reintentable, true);
    assert.equal((interpretarRespuestaWa(503, {}) as { reintentable: boolean }).reintentable, true);
    for (const codigo of [130429, 131048, 131056, 131000, 80007]) {
      const r = interpretarRespuestaWa(400, { error: { code: codigo, message: "m" } });
      assert.equal(r.ok === false && r.reintentable, true, String(codigo));
    }
  });

  it("un token vencido, una plantilla mal armada o un número bloqueado no se reintentan y dicen por qué", () => {
    for (const codigo of [190, 132000, 132001, 131026, 131030, 131047, 100]) {
      const r = interpretarRespuestaWa(400, { error: { code: codigo, message: "algo" } });
      assert.equal(r.ok === false && r.reintentable, false, String(codigo));
    }
    const r = interpretarRespuestaWa(401, { error: { code: 190, message: "Token vencido" } });
    assert.ok(!r.ok && r.motivo.includes("190") && r.motivo.includes("Token vencido"));
  });

  it("prefiere el detalle del error y corta los motivos largos", () => {
    const r = interpretarRespuestaWa(400, { error: { code: 132000, message: "corto", error_data: { details: "número de parámetros distinto" } } });
    assert.ok(!r.ok && r.motivo.includes("número de parámetros distinto"));
    const largo = interpretarRespuestaWa(400, { error: { code: 1, message: "x".repeat(1000) } });
    assert.ok(!largo.ok && largo.motivo.length <= 300);
  });
});

describe("pedido a Meta", () => {
  it("una plantilla lleva el nombre, el idioma y los parámetros", () => {
    const p = pedidoDeMensaje(aviso) as { type: string; to: string; template: { name: string; language: { code: string } } };
    assert.equal(p.type, "template");
    assert.equal(p.to, "5491154735876");
    assert.equal(p.template.name, "unidoar_oferta");
    assert.equal(p.template.language.code, "es_AR");
  });

  it("un texto libre no abre vistas previas de enlaces", () => {
    const p = pedidoDeMensaje({ tipo: "texto", para: "5491154735876", texto: "Hola" }) as { type: string; text: { body: string; preview_url: boolean } };
    assert.equal(p.type, "text");
    assert.equal(p.text.body, "Hola");
    assert.equal(p.text.preview_url, false);
  });
});

describe("enviar", () => {
  it("apagado no manda nada", async () => {
    const r = await enviarWhatsapp(aviso, "apagado");
    assert.equal(r.ok, false);
  });

  it("en consola devuelve éxito sin llamar a la red", async () => {
    const original = console.info;
    let impreso = "";
    console.info = (...args: unknown[]) => void (impreso += JSON.stringify(args));
    try {
      const r = await enviarWhatsapp(aviso, "consola", {
        fetchImpl: (() => {
          throw new Error("no debería llamar");
        }) as unknown as typeof fetch,
      });
      assert.deepEqual(r, { ok: true, id: "consola" });
    } finally {
      console.info = original;
    }
    assert.ok(!impreso.includes("5491154735876"), "la consola no muestra el número entero");
    assert.ok(impreso.includes("5876"));
  });

  it("sin token no intenta salir", async () => {
    const r = await enviarWhatsapp(aviso, "meta", { token: "", idDelNumero: "" });
    assert.ok(!r.ok && r.reintentable === false);
  });

  it("manda el pedido con el token y el número, y devuelve el id", async () => {
    let url = "";
    let cabeceras: Record<string, string> = {};
    let cuerpo = "";
    const r = await enviarWhatsapp(aviso, "meta", {
      token: "secreto",
      idDelNumero: "123",
      version: "v23.0",
      fetchImpl: (async (u: string, init: RequestInit) => {
        url = u;
        cabeceras = init.headers as Record<string, string>;
        cuerpo = String(init.body);
        return new Response(JSON.stringify({ messages: [{ id: "wamid.XYZ" }] }), { status: 200 });
      }) as unknown as typeof fetch,
    });
    assert.deepEqual(r, { ok: true, id: "wamid.XYZ" });
    assert.equal(url, "https://graph.facebook.com/v23.0/123/messages");
    assert.equal(cabeceras.Authorization, "Bearer secreto");
    assert.ok(cuerpo.includes("unidoar_oferta"));
  });

  it("un corte sin respuesta NO se reintenta (no hay forma de saber si salió)", async () => {
    const r = await enviarWhatsapp(aviso, "meta", {
      token: "t",
      idDelNumero: "1",
      fetchImpl: (async () => {
        throw new Error("red caída");
      }) as unknown as typeof fetch,
    });
    assert.ok(!r.ok && r.reintentable === false);
  });
});
