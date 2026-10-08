import "server-only";
import { and, eq, isNull, ne, or } from "drizzle-orm";
import { getDb } from "@/db";
import { usuarios } from "@/db/schema";
import { VERSION_TERMINOS } from "@/lib/terminos";

type Ejecutor = Pick<ReturnType<typeof getDb>, "update">;

/**
 * Deja constancia de que la persona aceptó la versión vigente de los términos, ahora. No pisa una constancia de
 * la misma versión (re-guardar un formulario no cambia la fecha en que aceptó).
 */
export async function registrarAceptacionDeTerminos(usuarioId: string, ejecutor: Ejecutor = getDb()) {
  await ejecutor
    .update(usuarios)
    .set({ terminosAceptadosEn: new Date(), terminosVersion: VERSION_TERMINOS })
    .where(and(eq(usuarios.id, usuarioId), or(isNull(usuarios.terminosVersion), ne(usuarios.terminosVersion, VERSION_TERMINOS))));
}
