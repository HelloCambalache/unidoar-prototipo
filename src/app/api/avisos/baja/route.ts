import { NextResponse } from "next/server";
import { darDeBajaConFirma } from "@/lib/queries/correo";

// Depende de la base y de la firma del enlace: nunca se cachea.
export const dynamic = "force-dynamic";

const SIN_CACHE = { "Cache-Control": "no-store" };

/**
 * "Darse de baja con un clic" (RFC 8058): Gmail y otros clientes mandan un POST a la URL de la cabecera List-Unsubscribe
 * de los mails de avisos. La firma del enlace es la autorización; solo apaga los avisos opcionales de esa cuenta.
 */
export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const usuario = searchParams.get("u") ?? "";
  const firma = searchParams.get("t") ?? "";
  try {
    const r = await darDeBajaConFirma(usuario, firma);
    if (r === "invalido") return NextResponse.json({ error: "Enlace no válido" }, { status: 400, headers: SIN_CACHE });
    return NextResponse.json({ ok: true }, { headers: SIN_CACHE });
  } catch (e) {
    console.error("No se pudo procesar la baja de avisos por mail", e);
    return NextResponse.json({ error: "No se pudo procesar" }, { status: 500, headers: SIN_CACHE });
  }
}

/** Abrir el enlace en un navegador (o que un antivirus de correo lo visite) no cambia nada: lleva a la página que pide confirmar. */
export function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const destino = new URL("/avisos/baja", request.url);
  for (const clave of ["u", "t"]) {
    const v = searchParams.get(clave);
    if (v) destino.searchParams.set(clave, v);
  }
  return NextResponse.redirect(destino, { status: 303, headers: SIN_CACHE });
}
