import "server-only";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { notificaciones } from "@/db/schema";
import { haceCuanto } from "@/lib/utils";
import type { NotificacionVista } from "@/lib/notificaciones";

export async function notificacionesDe(usuarioId: string, limite = 20): Promise<NotificacionVista[]> {
  const filas = await getDb()
    .select()
    .from(notificaciones)
    .where(eq(notificaciones.usuarioId, usuarioId))
    .orderBy(desc(notificaciones.creadoEn))
    .limit(limite);
  const ahora = new Date();
  return filas.map((n) => ({
    id: n.id,
    tipo: n.tipo,
    titulo: n.titulo,
    texto: n.texto,
    enlace: n.enlace,
    leida: n.leida,
    cuando: haceCuanto(n.creadoEn, ahora),
  }));
}

/** Crea una notificación para una cuenta. Silencioso si la cuenta no existe (perfiles demo sin usuario). */
export async function notificar(
  usuarioId: string | null | undefined,
  n: { tipo: string; titulo: string; texto: string; enlace?: string },
) {
  if (!usuarioId) return;
  await getDb().insert(notificaciones).values({ usuarioId, ...n });
}
