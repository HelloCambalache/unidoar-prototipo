import { NextResponse } from "next/server";
import { z } from "zod";
import { usuarioActual } from "@/lib/auth";
import { almacenamientoConfigurado } from "@/lib/almacenamiento";
import { clienteAdmin } from "@/lib/supabase/admin";
import {
  BUCKETS,
  LIMITE_IMAGEN,
  LIMITE_PDF,
  detectarArchivo,
  mb,
  tipoDeCarpeta,
  urlPublicaDe,
} from "@/lib/subidas";

/**
 * Subida de archivos a Supabase Storage (multipart: `archivo`, `bucket`, `carpeta`).
 * Exige sesión con alta completa, valida bucket y carpeta contra una lista blanca, mira los bytes
 * para confirmar el tipo real (imágenes ≤ 5 MB, PDF ≤ 10 MB) y guarda en `<usuarioId>/<carpeta>/<uuid>.<ext>`.
 * Bucket `publico` devuelve la URL pública; `privado` devuelve solo el path.
 */

const entrada = z.object({ bucket: z.enum(BUCKETS), carpeta: z.string().min(1).max(40) });

const responder = (cuerpo: { ok: true; [k: string]: unknown } | { ok: false; error: string }, status = 200) =>
  NextResponse.json(cuerpo, { status });

export async function POST(req: Request) {
  if (!almacenamientoConfigurado()) {
    return responder({ ok: false, error: "La subida de archivos se habilita en cuanto se configure el almacenamiento." }, 503);
  }

  const usuario = await usuarioActual();
  if (!usuario) return responder({ ok: false, error: "Iniciá sesión para subir archivos." }, 401);

  // Corta antes de leer el cuerpo entero si ya es evidente que no entra.
  const declarado = Number(req.headers.get("content-length") ?? 0);
  if (declarado > LIMITE_PDF + 512 * 1024) {
    return responder({ ok: false, error: `El archivo es demasiado pesado (máximo ${mb(LIMITE_PDF)} MB).` }, 413);
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return responder({ ok: false, error: "No pudimos leer el archivo. Probá de nuevo." }, 400);
  }

  const parametros = entrada.safeParse({ bucket: form.get("bucket"), carpeta: form.get("carpeta") });
  const archivo = form.get("archivo");
  if (!parametros.success || !(archivo instanceof File) || archivo.size === 0) {
    return responder({ ok: false, error: "Elegí un archivo para subir." }, 400);
  }
  const { bucket, carpeta } = parametros.data;

  const tipoPermitido = tipoDeCarpeta(bucket, carpeta);
  if (!tipoPermitido) return responder({ ok: false, error: "Destino de subida no permitido." }, 400);

  const bytes = new Uint8Array(await archivo.arrayBuffer());
  const detectado = detectarArchivo(bytes);
  const aceptaImagen = tipoPermitido !== "pdf";
  const aceptaPdf = tipoPermitido !== "imagen";
  if (!detectado || (detectado.clase === "imagen" && !aceptaImagen) || (detectado.clase === "pdf" && !aceptaPdf)) {
    const quePide = tipoPermitido === "imagen" ? "una imagen JPG, PNG o WebP" : tipoPermitido === "pdf" ? "un PDF" : "una imagen JPG, PNG o WebP, o un PDF";
    return responder({ ok: false, error: `Este archivo no sirve: tiene que ser ${quePide}.` }, 415);
  }
  const limite = detectado.clase === "pdf" ? LIMITE_PDF : LIMITE_IMAGEN;
  if (bytes.byteLength > limite) {
    return responder({ ok: false, error: `El archivo pesa demasiado (máximo ${mb(limite)} MB).` }, 413);
  }

  const path = `${usuario.id}/${carpeta}/${crypto.randomUUID()}.${detectado.ext}`;
  const { error } = await clienteAdmin()
    .storage.from(bucket)
    .upload(path, bytes, { contentType: detectado.mime, upsert: false, cacheControl: "31536000" });
  if (error) {
    console.error("[api/subir] fallo al guardar en Storage:", error.message);
    return responder({ ok: false, error: "No pudimos guardar el archivo. Probá de nuevo en un rato." }, 502);
  }

  return responder({
    ok: true,
    bucket,
    path,
    url: bucket === "publico" ? urlPublicaDe(path) : null,
    nombre: archivo.name.slice(0, 120),
    tamano: bytes.byteLength,
    clase: detectado.clase,
  });
}
