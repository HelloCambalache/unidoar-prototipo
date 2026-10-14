import { NextResponse } from "next/server";
import { z } from "zod";
import { almacenamientoConfigurado } from "@/lib/almacenamiento";
import { usuarioActual } from "@/lib/auth";
import { negarConfirmacion } from "@/lib/queries/subidas-permiso";
import { clienteAdmin } from "@/lib/supabase/admin";
import { CARPETA_DE_PASO, LIMITE_PDF, detectarArchivo, esPathPrivadoPropio, mb, tipoDeCarpeta } from "@/lib/subidas";

/**
 * Segundo paso de la subida de un PDF grande (ver /api/subir/firmar): el navegador ya lo subió a la carpeta de paso.
 * Acá se mira que sea de esta cuenta, que pese lo permitido y que los bytes sean de un PDF de verdad (el tipo que declara
 * el navegador no es confiable). Si está bien, el servidor guarda esos mismos bytes en `<usuarioId>/<carpeta>/<uuid>.pdf`
 * (la única forma de llegar a una carpeta que las acciones aceptan) y borra el de paso; si no, lo borra.
 *
 * No se *mueve* el archivo de paso: Storage puede seguir sirviendo una copia vieja de un path que ya se tocó, y moverlo
 * habría permitido revisar una copia válida mientras lo que se guarda es otra cosa. Guardando los bytes ya revisados, lo
 * que queda es siempre lo que se miró.
 */

const entrada = z.object({
  carpeta: z.string().min(1).max(40),
  path: z.string().min(1).max(200),
  nombre: z.string().max(200).optional(),
});

const responder = (cuerpo: { ok: true; [k: string]: unknown } | { ok: false; error: string }, status = 200) =>
  NextResponse.json(cuerpo, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(req: Request) {
  if (!almacenamientoConfigurado()) {
    return responder({ ok: false, error: "La subida de archivos se habilita en cuanto se configure el almacenamiento." }, 503);
  }
  const usuario = await usuarioActual();
  if (!usuario) return responder({ ok: false, error: "Iniciá sesión para subir archivos." }, 401);
  const negada = await negarConfirmacion(usuario);
  if (negada) return responder({ ok: false, error: negada.error }, negada.status);

  const datos = entrada.safeParse(await req.json().catch(() => null));
  if (!datos.success) return responder({ ok: false, error: "No pudimos revisar el archivo. Probá de nuevo." }, 400);
  const { carpeta, path, nombre } = datos.data;

  const tipo = tipoDeCarpeta("privado", carpeta);
  if (!tipo || tipo === "imagen") return responder({ ok: false, error: "Destino de subida no permitido." }, 400);
  // El path tiene que ser uno de paso de esta misma cuenta: nunca se mueve (ni se lee) un archivo ajeno.
  if (!esPathPrivadoPropio(path, usuario.id, CARPETA_DE_PASO) || !path.endsWith(".pdf")) {
    return responder({ ok: false, error: "No encontramos el archivo subido." }, 400);
  }

  const bucket = clienteAdmin().storage.from("privado");
  const descartar = () => bucket.remove([path]).catch(() => undefined);

  const { data: archivo, error } = await bucket.download(path);
  if (error || !archivo) return responder({ ok: false, error: "No encontramos el archivo subido. Probá de nuevo." }, 404);

  const bytes = new Uint8Array(await archivo.arrayBuffer());
  if (bytes.byteLength > LIMITE_PDF) {
    await descartar();
    return responder({ ok: false, error: `El archivo pesa demasiado (máximo ${mb(LIMITE_PDF)} MB).` }, 413);
  }
  if (detectarArchivo(bytes.subarray(0, 16))?.clase !== "pdf") {
    await descartar();
    return responder({ ok: false, error: "Este archivo no sirve: tiene que ser un PDF." }, 415);
  }

  const destino = `${usuario.id}/${carpeta}/${crypto.randomUUID()}.pdf`;
  const { error: errorAlGuardar } = await bucket.upload(destino, bytes, {
    contentType: "application/pdf",
    upsert: false,
    cacheControl: "31536000",
  });
  if (errorAlGuardar) {
    console.error("[api/subir/confirmar] no se pudo guardar el archivo:", errorAlGuardar.message);
    await descartar();
    return responder({ ok: false, error: "No pudimos guardar el archivo. Probá de nuevo en un rato." }, 502);
  }
  await descartar();

  return responder({
    ok: true,
    bucket: "privado",
    path: destino,
    url: null,
    nombre: (nombre ?? "").slice(0, 120),
    tamano: bytes.byteLength,
    clase: "pdf",
  });
}
