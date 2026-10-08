import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { usuarios } from "@/db/schema";
import { firmaDeBajaValida } from "@/lib/correo/baja";

/** Enciende o apaga los avisos por mail de una cuenta (los de búsquedas y postulaciones). Devuelve false si la cuenta no existe. */
export async function fijarAvisosPorCorreo(usuarioId: string, activos: boolean) {
  const filas = await getDb()
    .update(usuarios)
    .set({ avisosPorCorreo: activos })
    .where(eq(usuarios.id, usuarioId))
    .returning({ id: usuarios.id });
  return filas.length > 0;
}

/** Si la cuenta recibe los avisos por mail; null si no existe. */
export async function recibeAvisosPorCorreo(usuarioId: string) {
  const [fila] = await getDb().select({ activos: usuarios.avisosPorCorreo }).from(usuarios).where(eq(usuarios.id, usuarioId)).limit(1);
  return fila ? fila.activos : null;
}

/**
 * Baja de avisos con el enlace firmado de un mail: no hace falta tener la sesión abierta. Solo sirve para APAGAR los
 * avisos de esa cuenta; volver a prenderlos es desde Mi cuenta.
 */
export async function darDeBajaConFirma(usuarioId: string, firma: string): Promise<"hecho" | "invalido"> {
  if (!firmaDeBajaValida(usuarioId, firma)) return "invalido";
  return (await fijarAvisosPorCorreo(usuarioId.toLowerCase(), false)) ? "hecho" : "invalido";
}
