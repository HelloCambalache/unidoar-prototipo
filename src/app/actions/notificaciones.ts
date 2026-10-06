"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { notificaciones } from "@/db/schema";
import { usuarioActual } from "@/lib/auth";

export async function marcarTodasLeidas() {
  const usuario = await usuarioActual();
  if (!usuario) return;
  await getDb()
    .update(notificaciones)
    .set({ leida: true })
    .where(and(eq(notificaciones.usuarioId, usuario.id), eq(notificaciones.leida, false)));
  revalidatePath("/", "layout");
}

export async function marcarLeida(id: string) {
  const usuario = await usuarioActual();
  if (!usuario) return;
  await getDb()
    .update(notificaciones)
    .set({ leida: true })
    .where(and(eq(notificaciones.id, id), eq(notificaciones.usuarioId, usuario.id)));
  revalidatePath("/", "layout");
}
