import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { describe, it } from "node:test";
import { estadoTrasAviso, firmaValida, leerWebhook, pideLaBaja, RESPUESTA_A_LA_BAJA, RESPUESTA_AUTOMATICA } from "./webhook";

const firmar = (cuerpo: string, secreto: string) => `sha256=${createHmac("sha256", secreto).update(cuerpo, "utf8").digest("hex")}`;

describe("firma del webhook", () => {
  const cuerpo = JSON.stringify({ object: "whatsapp_business_account", entry: [] });

  it("acepta la firma que corresponde al cuerpo y a la clave", () => {
    assert.equal(firmaValida(cuerpo, firmar(cuerpo, "clave"), "clave"), true);
  });

  it("rechaza un cuerpo cambiado, otra clave, una firma mal formada o ninguna", () => {
    assert.equal(firmaValida(cuerpo + " ", firmar(cuerpo, "clave"), "clave"), false);
    assert.equal(firmaValida(cuerpo, firmar(cuerpo, "otra"), "clave"), false);
    assert.equal(firmaValida(cuerpo, "sha256=abc", "clave"), false);
    assert.equal(firmaValida(cuerpo, "sha1=" + "a".repeat(40), "clave"), false);
    assert.equal(firmaValida(cuerpo, firmar(cuerpo, "clave").replace("sha256=", ""), "clave"), false);
    assert.equal(firmaValida(cuerpo, null, "clave"), false);
    assert.equal(firmaValida(cuerpo, undefined, "clave"), false);
  });

  it("sin clave configurada no se acepta nada (falla cerrado)", () => {
    assert.equal(firmaValida(cuerpo, firmar(cuerpo, ""), undefined), false);
    assert.equal(firmaValida(cuerpo, firmar(cuerpo, ""), ""), false);
  });
});

const envuelto = (value: object) => ({ object: "whatsapp_business_account", entry: [{ id: "1", changes: [{ field: "messages", value }] }] });

describe("leer lo que manda Meta", () => {
  it("lee los estados de entrega", () => {
    const l = leerWebhook(
      envuelto({
        statuses: [
          { id: "wamid.1", status: "sent", timestamp: "1762800000" },
          { id: "wamid.1", status: "delivered", timestamp: "1762800005" },
          { id: "wamid.1", status: "read", timestamp: "1762800100" },
        ],
      }),
    );
    assert.deepEqual(l.estados.map((e) => [e.id, e.estado]), [["wamid.1", "enviado"], ["wamid.1", "entregado"], ["wamid.1", "leido"]]);
    assert.equal(l.estados[0]!.cuando?.getTime(), 1762800000 * 1000);
    assert.equal(l.mensajes.length, 0);
  });

  it("un estado fallido trae el código y el motivo", () => {
    const l = leerWebhook(
      envuelto({ statuses: [{ id: "wamid.2", status: "failed", timestamp: "1", errors: [{ code: 131026, title: "Message undeliverable" }] }] }),
    );
    assert.deepEqual(l.estados[0]!.error, { codigo: 131026, titulo: "Message undeliverable" });
  });

  it("lee los mensajes de texto que escribe la gente y marca los que no son texto", () => {
    const l = leerWebhook(
      envuelto({
        messages: [
          { id: "wamid.3", from: "5491154735876", type: "text", text: { body: "BAJA" } },
          { id: "wamid.4", from: "5491154735876", type: "image" },
        ],
      }),
    );
    assert.deepEqual(l.mensajes, [
      { id: "wamid.3", de: "5491154735876", texto: "BAJA" },
      { id: "wamid.4", de: "5491154735876", texto: null },
    ]);
  });

  it("ignora lo que no entiende sin romperse", () => {
    for (const raro of [null, undefined, 5, "x", {}, { object: "page" }, { object: "whatsapp_business_account" }, { object: "whatsapp_business_account", entry: [null, {}, { changes: [null, { field: "otra" }] }] }]) {
      assert.deepEqual(leerWebhook(raro), { estados: [], mensajes: [] }, JSON.stringify(raro));
    }
    const l = leerWebhook(envuelto({ statuses: [{ id: "", status: "sent" }, { id: "w", status: "inventado" }, null], messages: [{ id: "m" }, null] }));
    assert.deepEqual(l, { estados: [], mensajes: [] });
  });
});

describe("estado de un mensaje", () => {
  it("avanza y nunca retrocede", () => {
    assert.equal(estadoTrasAviso("enviado", "entregado"), "entregado");
    assert.equal(estadoTrasAviso("entregado", "leido"), "leido");
    assert.equal(estadoTrasAviso("leido", "entregado"), "leido");
    assert.equal(estadoTrasAviso("entregado", "enviado"), "entregado");
    assert.equal(estadoTrasAviso("pendiente", "enviado"), "enviado");
  });

  it("un fallo no desmiente algo que ya se entregó, pero sí a lo que no salió", () => {
    assert.equal(estadoTrasAviso("entregado", "fallido"), "entregado");
    assert.equal(estadoTrasAviso("leido", "fallido"), "leido");
    assert.equal(estadoTrasAviso("enviado", "fallido"), "fallido");
    assert.equal(estadoTrasAviso("procesando", "fallido"), "fallido");
  });

  it("si llegó un estado de un mensaje que dábamos por fallido, el estado real manda", () => {
    assert.equal(estadoTrasAviso("fallido", "entregado"), "entregado");
  });
});

describe("pedir la baja", () => {
  it("reconoce las formas habituales, sin tildes ni mayúsculas ni signos", () => {
    for (const t of ["BAJA", "baja", "Baja.", " ¡Stop! ", "PARAR", "cancelar", "No quiero más avisos", "dar de baja"]) {
      assert.equal(pideLaBaja(t), true, t);
    }
  });

  it("no confunde una frase cualquiera con una baja", () => {
    for (const t of ["hola", "no me llegó el aviso", "quiero dar de baja mi cuenta de la plataforma", "baja la fiebre", "", null, undefined]) {
      assert.equal(pideLaBaja(t), false, String(t));
    }
  });

  it("las respuestas automáticas dicen cómo seguir y no prometen lo que no hay", () => {
    assert.match(RESPUESTA_AUTOMATICA, /BAJA/);
    assert.match(RESPUESTA_AUTOMATICA, /unidoar@gmail\.com/);
    assert.match(RESPUESTA_A_LA_BAJA, /Mi cuenta/);
  });
});
