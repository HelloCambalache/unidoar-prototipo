import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { contactosInstitucion } from "@/db/schema";
import { almacenamientoConfigurado, urlFirmada } from "@/lib/almacenamiento";
import { institucionActual, usuarioActual } from "@/lib/auth";
import { esUuid } from "@/lib/busquedas";

/**
 * Abre el CV que una institución adjuntó a uno de sus contactos propios (el «CV» de la fila en Profesionales). El archivo está en el bucket
 * privado y trae datos personales de alguien que no tiene cuenta, así que solo lo abre alguien del equipo de la institución dueña del contacto:
 * se filtra por la institución de la sesión, no por el id que llega en la dirección. Nunca hay una URL del archivo en la página: este enlace
 * comprueba y redirige a una URL firmada de un minuto. Sin sesión, con otra institución, sin CV o suspendida, responde 404 (401 sin sesión).
 */

const NO_ENCONTRADO = new NextResponse("No encontramos ese archivo.", { status: 404, headers: { "Cache-Control": "no-store" } });

export async function GET(_req: Request, { params }: { params: Promise<{ contactoId: string }> }) {
  const { contactoId } = await params;
  const usuario = await usuarioActual();
  if (!usuario) return new NextResponse("Iniciá sesión para ver este archivo.", { status: 401, headers: { "Cache-Control": "no-store" } });
  const institucion = await institucionActual();
  if (!institucion || (institucion.suspendida && usuario.rol !== "admin")) return NO_ENCONTRADO;
  if (!esUuid(contactoId) || !almacenamientoConfigurado()) return NO_ENCONTRADO;

  const [contacto] = await getDb()
    .select({ cvPath: contactosInstitucion.cvPath })
    .from(contactosInstitucion)
    .where(and(eq(contactosInstitucion.id, contactoId), eq(contactosInstitucion.institucionId, institucion.id)))
    .limit(1);
  if (!contacto?.cvPath) return NO_ENCONTRADO;

  const url = await urlFirmada(contacto.cvPath, 60);
  if (!url) return NO_ENCONTRADO;
  return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "no-store" } });
}
