"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { transaccion } from "@/db";
import { mensajesContacto } from "@/db/schema";
import { fallo, ok, type Resultado } from "@/lib/acciones";
import { registrarAuditoria } from "@/lib/auditoria";
import { requerirUsuario } from "@/lib/auth";
import { esUuid } from "@/lib/busquedas";

/** Marca un mensaje de /contacto como atendido (o lo vuelve a "sin atender"). */
export async function marcarMensajeAtendido(mensajeId: string, atendido: boolean): Promise<Resultado> {
  const admin = await requerirUsuario("admin");
  if (!esUuid(mensajeId) || typeof atendido !== "boolean") return fallo("No encontramos ese mensaje.");

  const resultado = await transaccion(async (tx) => {
    const [mensaje] = await tx
      .select({ id: mensajesContacto.id, atendido: mensajesContacto.atendido })
      .from(mensajesContacto)
      .where(eq(mensajesContacto.id, mensajeId))
      .limit(1)
      .for("update");
    if (!mensaje) return fallo("No encontramos ese mensaje.");
    if (mensaje.atendido === atendido) return ok();

    await tx.update(mensajesContacto).set({ atendido }).where(eq(mensajesContacto.id, mensaje.id));
    await registrarAuditoria(
      {
        usuarioId: admin.id,
        accion: atendido ? "mensaje.atender" : "mensaje.reabrir",
        entidad: "mensaje",
        entidadId: mensaje.id,
      },
      tx,
    );
    return ok();
  });

  if (resultado.ok) revalidatePath("/backoffice/mensajes");
  return resultado;
}
