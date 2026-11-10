"use server";

import { revalidatePath } from "next/cache";
import { fallo, ok, type Resultado } from "@/lib/acciones";
import { requerirUsuario } from "@/lib/auth";
import { crearTope } from "@/lib/tope";
import { activarAvisosPorWhatsapp, avisosPorWhatsappDe, retirarAvisosPorWhatsapp } from "@/lib/queries/whatsapp";
import { whatsappActivo } from "@/lib/whatsapp/config";
import { ERROR_DE_NUMERO } from "@/lib/whatsapp/consentimiento";

/*
 * Avisos por WhatsApp desde «Mi cuenta» (profesional e institución). Solo toca la cuenta de la sesión: nadie activa ni retira el consentimiento de otra persona.
 * La casilla viene apagada y activarla exige escribir el celular: el consentimiento queda atado a ESE número (ver src/lib/whatsapp/consentimiento.ts).
 */

/** 10 cambios por hora y por cuenta: de sobra para corregir un número mal escrito, y frena a quien probara números ajenos. (En la memoria de la instancia, como `crearTope`.) */
const permitirCambio = crearTope(10, 60 * 60 * 1000);

export async function guardarAvisosPorWhatsapp(_previo: Resultado | null, formData: FormData): Promise<Resultado> {
  const usuario = await requerirUsuario();
  if (usuario.rol === "admin") return fallo("Esta opción es para cuentas de profesionales e instituciones.");
  if (!whatsappActivo()) return fallo("Los avisos por WhatsApp todavía no están disponibles.");
  if (!permitirCambio(usuario.id)) return fallo("Hiciste muchos cambios seguidos. Probá de nuevo en un rato.");

  const quiere = formData.get("activar") === "on";
  const telefono = typeof formData.get("telefono") === "string" ? String(formData.get("telefono")).slice(0, 40) : "";

  if (!quiere) {
    await retirarAvisosPorWhatsapp(usuario.id);
  } else if (telefono.trim() === "") {
    // Sin número nuevo: vale el que ya tenía, si lo tenía. Si no, hay que escribirlo.
    if (!(await avisosPorWhatsappDe(usuario.id)).activos) return fallo(ERROR_DE_NUMERO, { telefono: "Escribí tu celular para recibir los avisos." });
  } else {
    const r = await activarAvisosPorWhatsapp(usuario.id, telefono, "cuenta");
    if (!r.ok) return fallo(r.error, { telefono: r.error });
  }

  revalidatePath("/docente/cuenta");
  revalidatePath("/institucion/cuenta");
  return ok();
}
