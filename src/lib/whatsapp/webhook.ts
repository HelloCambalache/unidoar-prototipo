import { createHmac, timingSafeEqual } from "node:crypto";

/*
 * Lo que Meta le manda a nuestro webhook de WhatsApp (https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks). Sin base ni red: la firma,
 * la lectura del cuerpo y la regla de la baja son puras y se prueban solas.
 */

/**
 * Meta firma cada pedido con HMAC-SHA256 del cuerpo EXACTO (tal como llegó, antes de leerlo como JSON) usando la clave secreta de la app, en la
 * cabecera `X-Hub-Signature-256` con la forma `sha256=<hex>`. Sin clave o sin firma válida no se acepta nada: acá no se cuenta con que el aviso sea
 * verdadero (alguien podría mandarnos un «BAJA» ajeno o un estado falso).
 */
export function firmaValida(cuerpoCrudo: string, cabecera: string | null | undefined, secreto: string | undefined): boolean {
  if (!secreto || !cabecera) return false;
  const [metodo, recibida] = cabecera.trim().split("=");
  if (metodo !== "sha256" || !recibida || !/^[0-9a-f]{64}$/i.test(recibida)) return false;
  const esperada = createHmac("sha256", secreto).update(cuerpoCrudo, "utf8").digest();
  const recibidaEnBytes = Buffer.from(recibida, "hex");
  return recibidaEnBytes.length === esperada.length && timingSafeEqual(recibidaEnBytes, esperada);
}

export type EstadoDeEntrega = "enviado" | "entregado" | "leido" | "fallido";

export type EstadoRecibido = {
  /** El id del mensaje (el mismo que devolvió la API al mandarlo). */
  id: string;
  estado: EstadoDeEntrega;
  /** Cuándo pasó, según Meta. */
  cuando: Date | null;
  /** Solo en `fallido`: el código y el motivo que da Meta. */
  error: { codigo: number | null; titulo: string } | null;
};

export type MensajeRecibido = {
  id: string;
  /** El número de quien escribe, como lo manda Meta. */
  de: string;
  /** El texto, si es un mensaje de texto; null para imágenes, audios, botones y demás. */
  texto: string | null;
};

export type LecturaDelWebhook = { estados: EstadoRecibido[]; mensajes: MensajeRecibido[] };

const ESTADOS: Record<string, EstadoDeEntrega> = { sent: "enviado", delivered: "entregado", read: "leido", failed: "fallido" };

const texto = (v: unknown): string | null => (typeof v === "string" && v !== "" ? v : null);

/** Saca del cuerpo (como lo manda Meta) los estados de los mensajes que mandamos y los mensajes que nos escribió la gente. Ignora todo lo demás. */
export function leerWebhook(cuerpo: unknown): LecturaDelWebhook {
  const lectura: LecturaDelWebhook = { estados: [], mensajes: [] };
  const raiz = cuerpo as { object?: unknown; entry?: unknown } | null;
  if (!raiz || raiz.object !== "whatsapp_business_account" || !Array.isArray(raiz.entry)) return lectura;

  for (const entrada of raiz.entry as { changes?: unknown }[]) {
    if (!Array.isArray(entrada?.changes)) continue;
    for (const cambio of entrada.changes as { field?: unknown; value?: unknown }[]) {
      if (cambio?.field !== "messages") continue;
      const valor = (cambio.value ?? {}) as { statuses?: unknown; messages?: unknown };

      if (Array.isArray(valor.statuses)) {
        for (const s of valor.statuses as { id?: unknown; status?: unknown; timestamp?: unknown; errors?: { code?: unknown; title?: unknown; message?: unknown }[] }[]) {
          const id = texto(s?.id);
          const estado = typeof s?.status === "string" && Object.hasOwn(ESTADOS, s.status) ? ESTADOS[s.status] : undefined;
          if (!id || !estado) continue;
          const segundos = Number(s.timestamp);
          const primero = Array.isArray(s.errors) ? s.errors[0] : undefined;
          lectura.estados.push({
            id,
            estado,
            cuando: Number.isFinite(segundos) && segundos > 0 ? new Date(segundos * 1000) : null,
            error:
              estado === "fallido"
                ? { codigo: typeof primero?.code === "number" ? primero.code : null, titulo: (texto(primero?.title) ?? texto(primero?.message) ?? "sin detalle").slice(0, 200) }
                : null,
          });
        }
      }

      if (Array.isArray(valor.messages)) {
        for (const m of valor.messages as { id?: unknown; from?: unknown; type?: unknown; text?: { body?: unknown } }[]) {
          const id = texto(m?.id);
          const de = texto(m?.from);
          if (!id || !de) continue;
          lectura.mensajes.push({ id, de, texto: m.type === "text" ? texto(m.text?.body) : null });
        }
      }
    }
  }
  return lectura;
}

/** Cuánto vale cada estado: uno nunca retrocede (un «entregado» que llega después de un «leído» no lo desmiente). `fallido` manda sobre todo lo anterior a leído. */
const RANGO: Record<string, number> = { pendiente: 0, procesando: 0, enviado: 1, entregado: 2, leido: 3 };

/** El estado en que queda un mensaje cuando llega uno nuevo de Meta, sin retroceder. */
export function estadoTrasAviso(actual: string, nuevo: EstadoDeEntrega): string {
  if (nuevo === "fallido") return actual === "leido" || actual === "entregado" ? actual : "fallido";
  if (actual === "fallido" || actual === "omitido") return nuevo;
  return (RANGO[nuevo] ?? 0) > (RANGO[actual] ?? 0) ? nuevo : actual;
}

const PALABRAS_DE_BAJA = new Set(["baja", "stop", "parar", "cancelar", "no quiero mas avisos", "no quiero mas", "dar de baja", "dejar de recibir"]);

/** ¿Este mensaje pide dejar de recibir avisos? Sin tildes, mayúsculas ni signos: «BAJA», «Baja.», «¡Stop!», «parar». */
export function pideLaBaja(texto: string | null | undefined): boolean {
  const normal = (texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return PALABRAS_DE_BAJA.has(normal);
}

/** Lo que se le contesta a quien escribe al número de avisos (que no atiende consultas) y a quien pide la baja. */
export const RESPUESTA_AUTOMATICA =
  "Este número solo envía avisos de UNIDOAR y no recibe consultas. Para escribirnos: unidoar@gmail.com. Si no querés recibir más avisos por WhatsApp, respondé BAJA.";
export const RESPUESTA_A_LA_BAJA =
  "Listo, no te vamos a mandar más avisos por WhatsApp. Si cambiás de idea, podés volver a activarlos desde Mi cuenta en UNIDOAR.";
