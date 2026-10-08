"use server";

import { darDeBajaConFirma } from "@/lib/queries/correo";

export type EstadoBajaAvisos = { ok: boolean; error?: string } | null;

/** Confirma la baja de avisos por mail desde la página del enlace de un mail (pública: la autoriza la firma del enlace). */
export async function confirmarBajaDeAvisos(_previo: EstadoBajaAvisos, formData: FormData): Promise<EstadoBajaAvisos> {
  const usuario = formData.get("u");
  const firma = formData.get("t");
  if (typeof usuario !== "string" || typeof firma !== "string") return { ok: false, error: "El enlace no es válido." };
  try {
    const r = await darDeBajaConFirma(usuario, firma);
    return r === "hecho" ? { ok: true } : { ok: false, error: "El enlace no es válido o ya no corresponde a una cuenta." };
  } catch (e) {
    console.error("No se pudo dar de baja de los avisos por mail", e);
    return { ok: false, error: "No pudimos guardar el cambio. Probá de nuevo en unos minutos." };
  }
}
