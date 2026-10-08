import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { enviarMensaje, interpretarRespuesta, type Mensaje } from "./enviar";

const MENSAJE: Mensaje = {
  de: "UNIDOAR <no-responder@unidoar.com.ar>",
  para: "ana@example.com",
  asunto: "Hola",
  html: "<p>Hola</p>",
  texto: "Hola",
  responderA: "hola@unidoar.com.ar",
  cabeceras: { "List-Unsubscribe": "<https://unidoar.com.ar/api/avisos/baja?u=1&t=2>" },
  claveDeIdempotencia: "fila-1",
};

const respuesta = (status: number, cuerpo: unknown) => (async () => new Response(JSON.stringify(cuerpo), { status })) as unknown as typeof fetch;

describe("envío por Resend", () => {
  it("interpreta las respuestas: éxito, reintentables (429 y 5xx) y errores definitivos", () => {
    assert.deepEqual(interpretarRespuesta(200, { id: "abc" }), { ok: true, id: "abc" });
    assert.deepEqual(interpretarRespuesta(429, { message: "Too many requests" }), { ok: false, reintentable: true, motivo: "Resend 429: Too many requests" });
    assert.equal((interpretarRespuesta(503, null) as { reintentable: boolean }).reintentable, true);
    const invalido = interpretarRespuesta(422, { name: "validation_error", message: "Invalid `to` field" });
    assert.deepEqual(invalido, { ok: false, reintentable: false, motivo: "Resend 422: Invalid `to` field" });
    // Un 200 sin id no cuenta como enviado.
    assert.equal(interpretarRespuesta(200, {}).ok, false);
    assert.equal(interpretarRespuesta(403, { name: "domain_not_verified" }).ok, false);
  });

  it("manda el pedido con la clave, la idempotencia y los campos esperados", async () => {
    let visto: { url: string; init: RequestInit } | null = null;
    const fetchFalso = (async (url: string, init: RequestInit) => {
      visto = { url, init };
      return new Response(JSON.stringify({ id: "msg_1" }), { status: 200 });
    }) as unknown as typeof fetch;

    const r = await enviarMensaje(MENSAJE, "resend", { fetchImpl: fetchFalso, clave: "re_clave" });
    assert.deepEqual(r, { ok: true, id: "msg_1" });
    assert.equal(visto!.url, "https://api.resend.com/emails");
    const cabeceras = visto!.init.headers as Record<string, string>;
    assert.equal(cabeceras.Authorization, "Bearer re_clave");
    assert.equal(cabeceras["Idempotency-Key"], "fila-1");
    const cuerpo = JSON.parse(visto!.init.body as string);
    assert.deepEqual(cuerpo.to, ["ana@example.com"]);
    assert.equal(cuerpo.from, MENSAJE.de);
    assert.equal(cuerpo.reply_to, "hola@unidoar.com.ar");
    assert.equal(cuerpo.subject, "Hola");
    assert.equal(cuerpo.headers["List-Unsubscribe"], MENSAJE.cabeceras!["List-Unsubscribe"]);
  });

  it("un error de red se reintenta y uno de Resend define si se reintenta", async () => {
    const sinRed = (async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    const caida = await enviarMensaje(MENSAJE, "resend", { fetchImpl: sinRed, clave: "re_clave" });
    assert.equal(caida.ok, false);
    assert.equal((caida as { reintentable: boolean }).reintentable, true);

    const limite = await enviarMensaje(MENSAJE, "resend", { fetchImpl: respuesta(429, { message: "slow down" }), clave: "re_clave" });
    assert.equal((limite as { reintentable: boolean }).reintentable, true);
    const rechazo = await enviarMensaje(MENSAJE, "resend", { fetchImpl: respuesta(422, { message: "bad" }), clave: "re_clave" });
    assert.equal((rechazo as { reintentable: boolean }).reintentable, false);
  });

  it("apagado no envía, consola no hace red, y sin clave no se intenta", async () => {
    let llamadas = 0;
    const contador = (async () => {
      llamadas += 1;
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;
    assert.equal((await enviarMensaje(MENSAJE, "apagado", { fetchImpl: contador })).ok, false);
    const original = console.info;
    console.info = () => {};
    try {
      assert.deepEqual(await enviarMensaje(MENSAJE, "consola", { fetchImpl: contador }), { ok: true, id: "consola" });
    } finally {
      console.info = original;
    }
    const delete_ = process.env.RESEND_API_KEY;
    delete process.env.RESEND_API_KEY;
    try {
      const sinClave = await enviarMensaje(MENSAJE, "resend", { fetchImpl: contador });
      assert.equal(sinClave.ok, false);
    } finally {
      if (delete_ !== undefined) process.env.RESEND_API_KEY = delete_;
    }
    assert.equal(llamadas, 0);
  });
});
