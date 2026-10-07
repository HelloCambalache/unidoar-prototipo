import { NextResponse } from "next/server";
import { z } from "zod";
import { almacenamientoConfigurado } from "@/lib/almacenamiento";
import { usuarioActual } from "@/lib/auth";
import { clienteAdmin } from "@/lib/supabase/admin";
import { CARPETA_DE_PASO, LIMITE_PDF, mb, tipoDeCarpeta } from "@/lib/subidas";

/**
 * Primer paso de la subida de un PDF grande (de más de ~4 MB, que no entra en una petición de Vercel): da una URL
 * firmada para que el navegador lo suba directo a Storage, en una carpeta de paso (`<usuarioId>/subidas/`) que ninguna
 * acción acepta como valor guardado. El segundo paso, /api/subir/confirmar, revisa los bytes y guarda lo revisado en su carpeta.
 */

const entrada = z.object({ carpeta: z.string().min(1).max(40), tamano: z.number().int().positive() });

const responder = (cuerpo: { ok: true; [k: string]: unknown } | { ok: false; error: string }, status = 200) =>
  NextResponse.json(cuerpo, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(req: Request) {
  if (!almacenamientoConfigurado()) {
    return responder({ ok: false, error: "La subida de archivos se habilita en cuanto se configure el almacenamiento." }, 503);
  }
  const usuario = await usuarioActual();
  if (!usuario) return responder({ ok: false, error: "Iniciá sesión para subir archivos." }, 401);

  const datos = entrada.safeParse(await req.json().catch(() => null));
  if (!datos.success) return responder({ ok: false, error: "Elegí un archivo para subir." }, 400);
  const { carpeta, tamano } = datos.data;

  // Solo el bucket privado recibe PDF, y solo las carpetas que los aceptan.
  const tipo = tipoDeCarpeta("privado", carpeta);
  if (!tipo || tipo === "imagen") return responder({ ok: false, error: "Destino de subida no permitido." }, 400);
  if (tamano > LIMITE_PDF) {
    return responder({ ok: false, error: `El archivo pesa demasiado (máximo ${mb(LIMITE_PDF)} MB).` }, 413);
  }

  const path = `${usuario.id}/${CARPETA_DE_PASO}/${crypto.randomUUID()}.pdf`;
  const { data, error } = await clienteAdmin().storage.from("privado").createSignedUploadUrl(path);
  if (error || !data) {
    console.error("[api/subir/firmar] no se pudo firmar la subida:", error?.message);
    return responder({ ok: false, error: "No pudimos preparar la subida. Probá de nuevo en un rato." }, 502);
  }
  return responder({ ok: true, path: data.path, token: data.token });
}
