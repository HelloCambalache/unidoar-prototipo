import { NextResponse, type NextRequest } from "next/server";
import { institucionPorCodigo } from "@/lib/queries/referidos";
import { RUTA_REGISTRO_INSTITUCION } from "@/lib/publico";
import { COOKIE_REFERIDO, normalizarCodigo, OPCIONES_DE_COOKIE_REFERIDO } from "@/lib/referidos";

/**
 * El enlace que una institución le manda a otra (`/referido/<código>`). Si el código es de una institución en pie, el navegador guarda
 * el código en una cookie (30 días) y la persona sigue al alta de institución; al crear su cuenta queda anotada como recomendada.
 * Con un código que no existe, o de una institución dada de baja o suspendida, sigue igual al alta pero sin anotar nada: no se dice
 * cuál de los dos pasó.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  const destino = request.nextUrl.clone();
  destino.pathname = RUTA_REGISTRO_INSTITUCION;
  destino.search = "";
  const respuesta = NextResponse.redirect(destino, { status: 302, headers: { "Cache-Control": "no-store" } });

  const normal = normalizarCodigo(codigo);
  if (normal && (await institucionPorCodigo(normal).catch(() => null))) {
    respuesta.cookies.set(COOKIE_REFERIDO, normal, OPCIONES_DE_COOKIE_REFERIDO);
  }
  return respuesta;
}
