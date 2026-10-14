import "server-only";
import { almacenamientoConfigurado } from "@/lib/almacenamiento";
import { LIMITE_FOTO_DE_GOOGLE, urlDeFotoDeGoogle } from "@/lib/foto-de-google";
import { clienteAdmin } from "@/lib/supabase/admin";
import { detectarArchivo, urlPublicaDe } from "@/lib/subidas";

/** Lee el cuerpo de una respuesta sin pasar de `max` bytes: si hay más, corta la descarga y devuelve null. */
async function leerConTope(res: Response, max: number): Promise<Uint8Array | null> {
  const lector = res.body?.getReader();
  if (!lector) return null;
  const partes: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await lector.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await lector.cancel().catch(() => undefined);
      return null;
    }
    partes.push(value);
  }
  const bytes = new Uint8Array(total);
  let desde = 0;
  for (const parte of partes) {
    bytes.set(parte, desde);
    desde += parte.byteLength;
  }
  return bytes;
}

/**
 * Trae la foto de la cuenta de Google y deja una copia en el bucket `publico` (`<usuario>/fotos/…`), para guardar como foto del
 * perfil la dirección de NUESTRO Storage y no la de Google (ver src/lib/foto-de-google.ts). Devuelve la URL pública de la copia, o
 * null si no se pudo por cualquier motivo (no es una foto de Google, Google no contesta, pesa de más, no es una imagen…): el perfil
 * queda sin foto y la persona puede subir una. Nunca rompe a quien la llama.
 *
 * Google ya recomprime la imagen en su servidor (sin datos EXIF), así que acá no hace falta lo que sí se hace con las que sube la gente
 * desde el navegador. `redirect: "error"` evita que una respuesta nos mande a otro servidor.
 */
export async function copiarFotoDeGoogle(usuarioId: string, direccion: string | null | undefined): Promise<string | null> {
  const origen = urlDeFotoDeGoogle(direccion);
  if (!origen || !almacenamientoConfigurado()) return null;
  try {
    const res = await fetch(origen, { redirect: "error", signal: AbortSignal.timeout(5000), headers: { Accept: "image/jpeg,image/png,image/webp" } });
    if (!res.ok) return null;
    const declarado = Number(res.headers.get("content-length") ?? 0);
    if (declarado > LIMITE_FOTO_DE_GOOGLE) return null;
    const bytes = await leerConTope(res, LIMITE_FOTO_DE_GOOGLE);
    if (!bytes || bytes.byteLength === 0) return null;
    // El tipo que declara el servidor no se toma: se miran los bytes, como en cualquier subida.
    const tipo = detectarArchivo(bytes);
    if (!tipo || tipo.clase !== "imagen") return null;

    const path = `${usuarioId}/fotos/${crypto.randomUUID()}.${tipo.ext}`;
    const { error } = await clienteAdmin()
      .storage.from("publico")
      .upload(path, bytes, { contentType: tipo.mime, upsert: false, cacheControl: "31536000" });
    if (error) {
      console.error("[foto-de-google] no se pudo guardar la copia:", error.message);
      return null;
    }
    return urlPublicaDe(path);
  } catch (error) {
    console.error("[foto-de-google] no se pudo traer la foto:", error instanceof Error ? error.message : error);
    return null;
  }
}
