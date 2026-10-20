import { NextResponse } from "next/server";
import { institucionActual, usuarioActual } from "@/lib/auth";
import { almacenamientoConfigurado, urlFirmada } from "@/lib/almacenamiento";
import { esUuid } from "@/lib/busquedas";
import { puedeVerElContacto } from "@/lib/pipeline";
import { mandoSuCv, postulacionPropia } from "@/lib/queries/pipeline";

/**
 * Abre el CV de quien se postuló a una búsqueda de la institución (el "Descargar CV" del tablero de postulantes). El CV está en el
 * bucket privado: no hay una URL pública ni firmada en la página; este enlace comprueba que la postulación sea de la institución
 * de quien lo abre, que el perfil no esté suspendido y que la persona se haya postulado o haya mandado su CV (el CV trae el
 * teléfono y el email: una invitación sin aceptar no alcanza, igual que para el contacto), y recién ahí redirige a una URL
 * firmada de un minuto.
 */

const NO_ENCONTRADO = new NextResponse("No encontramos ese archivo.", { status: 404, headers: { "Cache-Control": "no-store" } });

export async function GET(_req: Request, { params }: { params: Promise<{ postulacionId: string }> }) {
  const { postulacionId } = await params;
  const usuario = await usuarioActual();
  if (!usuario) return new NextResponse("Iniciá sesión para ver este archivo.", { status: 401, headers: { "Cache-Control": "no-store" } });
  const institucion = await institucionActual();
  if (!institucion || (institucion.suspendida && usuario.rol !== "admin")) return NO_ENCONTRADO;
  if (!esUuid(postulacionId) || !almacenamientoConfigurado()) return NO_ENCONTRADO;

  const fila = await postulacionPropia(institucion.id, postulacionId);
  const cv = fila?.docente.cvUrl;
  if (!fila || !cv || fila.docente.suspendido) return NO_ENCONTRADO;
  if (!puedeVerElContacto(fila.postulacion.origen, await mandoSuCv(institucion.id, fila.docente.id))) return NO_ENCONTRADO;

  // Un CV cargado como enlace externo (cuentas viejas) se abre tal cual; lo subido a Storage, con una URL firmada.
  const url = /^https?:\/\//.test(cv) ? cv : await urlFirmada(cv, 60);
  if (!url) return NO_ENCONTRADO;
  return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "no-store" } });
}
