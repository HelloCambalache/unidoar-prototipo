import "server-only";
import { and, eq, gte } from "drizzle-orm";
import { getDb } from "@/db";
import { notificaciones, type Docente, type Institucion } from "@/db/schema";
import { notificar } from "@/lib/queries/notificaciones";

/** Medianoche de hoy en Buenos Aires (UTC-3, sin horario de verano). */
function inicioDelDia() {
  const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());
  return new Date(`${hoy}T00:00:00-03:00`);
}

/**
 * Avisa al docente (si tiene cuenta) que una institución abrió su perfil: "Colegio X vio tu perfil".
 * Como máximo una por institución y día. No es una server action a propósito: la llama la página
 * en el servidor, así el cliente no puede disparar avisos a nombre de otra institución.
 */
export async function registrarVistaDePerfil(
  institucion: Pick<Institucion, "nombre" | "slug">,
  docente: Pick<Docente, "usuarioId">,
) {
  if (!docente.usuarioId) return;
  // El enlace identifica a la institución: abre su perfil público, y de paso sirve para no repetir el aviso.
  const enlace = `/docente/instituciones/${institucion.slug}`;
  const [yaAvisado] = await getDb()
    .select({ id: notificaciones.id })
    .from(notificaciones)
    .where(
      and(
        eq(notificaciones.usuarioId, docente.usuarioId),
        eq(notificaciones.tipo, "vista"),
        eq(notificaciones.enlace, enlace),
        gte(notificaciones.creadoEn, inicioDelDia()),
      ),
    )
    .limit(1);
  if (yaAvisado) return;
  await notificar(docente.usuarioId, { tipo: "vista", titulo: institucion.nombre, texto: "vio tu perfil.", enlace });
}
