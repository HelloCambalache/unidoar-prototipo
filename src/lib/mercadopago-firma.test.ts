import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { describe, it } from "node:test";
import { InvalidWebhookSignatureError, SignatureFailureReason, WebhookSignatureValidator } from "mercadopago";
import { TOLERANCIA_DE_AVISO_SEGUNDOS } from "@/lib/mercadopago-config";

/*
 * Guarda de la firma de los avisos: el SDK (`WebhookSignatureValidator`) tiene que seguir aceptando una firma armada como lo documenta
 * Mercado Pago (`id:<data.id>;request-id:<x-request-id>;ts:<ts>;`, HMAC-SHA256 con la clave secreta) y seguir rechazando lo demás. Si una
 * actualización del SDK cambiara algo, esta prueba lo avisa antes de que dejemos de anotar cobros (o de aceptar avisos falsos).
 */

const SECRETO = "clave-secreta-de-prueba-0123456789";
const AHORA = Date.UTC(2026, 9, 20, 15, 0, 0);

function aviso(id = "2c93808493f2a9", pedido = "req-123", ts = Math.floor(AHORA / 1000), secreto = SECRETO) {
  const hash = createHmac("sha256", secreto).update(`id:${id};request-id:${pedido};ts:${ts};`).digest("hex");
  return { xSignature: `ts=${ts},v1=${hash}`, xRequestId: pedido, dataId: id };
}

const validar = (a: ReturnType<typeof aviso>, extra: { secret?: string; tolerancia?: number } = {}) =>
  WebhookSignatureValidator.validate({ ...a, secret: extra.secret ?? SECRETO, toleranceSeconds: extra.tolerancia ?? TOLERANCIA_DE_AVISO_SEGUNDOS, now: () => AHORA });

const motivo = (fn: () => void) => {
  try {
    fn();
  } catch (e) {
    assert.ok(e instanceof InvalidWebhookSignatureError, "tiene que ser el error de firma del SDK");
    return e.reason;
  }
  return null;
};

describe("firma de los avisos de Mercado Pago", () => {
  it("acepta un aviso firmado como lo documenta Mercado Pago", () => {
    assert.doesNotThrow(() => validar(aviso()));
  });

  it("rechaza si cambia el recurso, el pedido o la clave", () => {
    const bueno = aviso();
    assert.equal(motivo(() => validar({ ...bueno, dataId: "otro-recurso" })), SignatureFailureReason.SignatureMismatch);
    assert.equal(motivo(() => validar({ ...bueno, xRequestId: "otro-pedido" })), SignatureFailureReason.SignatureMismatch);
    assert.equal(motivo(() => validar(bueno, { secret: "otra-clave" })), SignatureFailureReason.SignatureMismatch);
  });

  it("rechaza una firma que falta o está mal formada", () => {
    const bueno = aviso();
    assert.equal(motivo(() => validar({ ...bueno, xSignature: "" })), SignatureFailureReason.MissingSignatureHeader);
    assert.notEqual(motivo(() => validar({ ...bueno, xSignature: "cualquier-cosa" })), null);
    assert.notEqual(motivo(() => validar({ ...bueno, xSignature: `ts=${Math.floor(AHORA / 1000)},v1=${"0".repeat(64)}` })), null);
  });

  it("rechaza un aviso con el reloj muy corrido (repetido o armado de antes)", () => {
    const viejo = aviso(undefined, undefined, Math.floor(AHORA / 1000) - TOLERANCIA_DE_AVISO_SEGUNDOS - 60);
    assert.equal(motivo(() => validar(viejo)), SignatureFailureReason.TimestampOutOfTolerance);
    const futuro = aviso(undefined, undefined, Math.floor(AHORA / 1000) + TOLERANCIA_DE_AVISO_SEGUNDOS + 60);
    assert.equal(motivo(() => validar(futuro)), SignatureFailureReason.TimestampOutOfTolerance);
  });

  it("un aviso dentro de la tolerancia pasa", () => {
    assert.doesNotThrow(() => validar(aviso(undefined, undefined, Math.floor(AHORA / 1000) - 60)));
  });
});
