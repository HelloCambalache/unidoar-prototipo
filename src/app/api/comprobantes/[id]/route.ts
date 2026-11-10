import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { comprobantesPago } from "@/db/schema";
import { almacenamientoConfigurado, urlFirmada } from "@/lib/almacenamiento";
import { usuarioActual } from "@/lib/auth";
import { esUuid } from "@/lib/busquedas";

/**
 * Abre el comprobante de un pago que adjuntó el equipo (la captura o el PDF de la transferencia, el recibo). El archivo está en el bucket privado
 * y es un dato financiero de la institución: lo abre solo el equipo (rol admin). Nunca hay una URL del archivo en la página: este enlace comprueba
 * y redirige a una URL firmada de un minuto. Sin sesión, 401; con otro rol, sin comprobante o con un id que no existe, 404.
 */

const NO_ENCONTRADO = new NextResponse("No encontramos ese archivo.", { status: 404, headers: { "Cache-Control": "no-store" } });

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const usuario = await usuarioActual();
  if (!usuario) return new NextResponse("Iniciá sesión para ver este archivo.", { status: 401, headers: { "Cache-Control": "no-store" } });
  if (usuario.rol !== "admin" || !esUuid(id) || !almacenamientoConfigurado()) return NO_ENCONTRADO;

  const [fila] = await getDb().select({ path: comprobantesPago.path }).from(comprobantesPago).where(eq(comprobantesPago.id, id)).limit(1);
  if (!fila) return NO_ENCONTRADO;

  const url = await urlFirmada(fila.path, 60);
  if (!url) return NO_ENCONTRADO;
  return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "no-store" } });
}
