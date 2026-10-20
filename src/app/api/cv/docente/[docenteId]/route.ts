import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { docentes } from "@/db/schema";
import { almacenamientoConfigurado, urlFirmada } from "@/lib/almacenamiento";
import { institucionActual, usuarioActual } from "@/lib/auth";
import { esUuid } from "@/lib/busquedas";
import { puedeVerElCvDe } from "@/lib/queries/pipeline";

/**
 * Abre el CV de un profesional desde su ficha (el botón "Ver CV (PDF)" de /institucion/docente/<id>). El CV está en el bucket
 * privado y trae el teléfono y el email, así que se abre con la misma regla que el contacto: la persona se postuló a una búsqueda
 * de esta institución o le mandó su CV (una invitación sin aceptar no alcanza). Sin eso, o con el perfil suspendido, responde 404.
 * Nunca hay una URL del archivo en la página: este enlace comprueba y redirige a una URL firmada de un minuto.
 */

const NO_ENCONTRADO = new NextResponse("No encontramos ese archivo.", { status: 404, headers: { "Cache-Control": "no-store" } });

export async function GET(_req: Request, { params }: { params: Promise<{ docenteId: string }> }) {
  const { docenteId } = await params;
  const usuario = await usuarioActual();
  if (!usuario) return new NextResponse("Iniciá sesión para ver este archivo.", { status: 401, headers: { "Cache-Control": "no-store" } });
  const institucion = await institucionActual();
  if (!institucion || (institucion.suspendida && usuario.rol !== "admin")) return NO_ENCONTRADO;
  if (!esUuid(docenteId) || !almacenamientoConfigurado()) return NO_ENCONTRADO;

  const [docente] = await getDb()
    .select({ cvUrl: docentes.cvUrl, suspendido: docentes.suspendido })
    .from(docentes)
    .where(eq(docentes.id, docenteId))
    .limit(1);
  if (!docente?.cvUrl || docente.suspendido) return NO_ENCONTRADO;
  if (!(await puedeVerElCvDe(institucion.id, docenteId))) return NO_ENCONTRADO;

  // Un CV cargado como enlace externo (cuentas viejas) se abre tal cual; lo subido a Storage, con una URL firmada.
  const url = /^https?:\/\//.test(docente.cvUrl) ? docente.cvUrl : await urlFirmada(docente.cvUrl, 60);
  if (!url) return NO_ENCONTRADO;
  return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "no-store" } });
}
