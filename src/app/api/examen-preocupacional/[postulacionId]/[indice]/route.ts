import { NextResponse } from "next/server";
import { institucionActual, usuarioActual } from "@/lib/auth";
import { almacenamientoConfigurado, urlFirmada } from "@/lib/almacenamiento";
import { esUuid } from "@/lib/busquedas";
import { archivosDeExamen } from "@/lib/examen-preocupacional";
import { postulacionPropia } from "@/lib/queries/pipeline";

/**
 * Abre un archivo del examen preocupacional que guardó la institución. Es un dato sensible (de salud): no hay una URL
 * pública ni una URL firmada en la página; este enlace comprueba que quien lo abre sea de la institución dueña de la
 * postulación y recién ahí redirige a una URL firmada de un minuto.
 */

const NO_ENCONTRADO = new NextResponse("No encontramos ese archivo.", { status: 404, headers: { "Cache-Control": "no-store" } });

export async function GET(_req: Request, { params }: { params: Promise<{ postulacionId: string; indice: string }> }) {
  const { postulacionId, indice } = await params;
  const usuario = await usuarioActual();
  if (!usuario) return new NextResponse("Iniciá sesión para ver este archivo.", { status: 401, headers: { "Cache-Control": "no-store" } });
  const institucion = await institucionActual();
  if (!institucion || (institucion.suspendida && usuario.rol !== "admin")) return NO_ENCONTRADO;
  if (!esUuid(postulacionId) || !/^\d{1,2}$/.test(indice) || !almacenamientoConfigurado()) return NO_ENCONTRADO;

  const fila = await postulacionPropia(institucion.id, postulacionId);
  const archivo = fila ? archivosDeExamen(fila.postulacion.examenPreocupacionalArchivos)[Number(indice)] : undefined;
  if (!archivo) return NO_ENCONTRADO;

  const url = await urlFirmada(archivo.path, 60);
  if (!url) return NO_ENCONTRADO;
  return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "no-store" } });
}
