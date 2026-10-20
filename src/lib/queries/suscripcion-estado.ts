import "server-only";
import { getDb } from "@/db";
import { resumenDeError } from "@/lib/errores";
import { cancelarSuscripcionMp, obtenerSuscripcionMp, type SuscripcionDeMercadoPago } from "@/lib/mercadopago-cliente";
import { avisarAAdmins } from "@/lib/queries/avisos";
import { aplicarEstadoDeSuscripcion, type ResultadoDeEstado } from "@/lib/queries/suscripcion";
import { institucionDelPlan } from "@/lib/queries/suscripcion-planes";

export type SuscripcionProcesada = { suscripcion: SuscripcionDeMercadoPago; resultado: ResultadoDeEstado };

/**
 * Le pregunta a Mercado Pago por una suscripción, la pone al día en la base y hace lo que corresponda con lo que salga. Lo usan los tres
 * caminos por los que nos enteramos de una suscripción (el aviso de Mercado Pago, la vuelta de la persona a nuestro sitio y la revisión
 * diaria), así los tres actúan igual:
 *  - **duplicada** (la institución ya tenía otra activa): se cancela la nueva en Mercado Pago, que cobraría las dos, y se avisa al equipo.
 *  - **desconocida** y autorizada (no sabemos de qué institución es): se avisa al equipo SIN cancelar nada, puede ser legítima.
 *  - **adoptada** (reemplazó a una pendiente): se cancela la pendiente, que no tiene que poder cobrar.
 *
 * `deInstitucion`: si se pasa, solo se procesa una suscripción cuyo plan sea de esa institución (para un número que viene del navegador:
 * nunca se atribuye a otra). Devuelve null si no lo es. Los errores de Mercado Pago o de la base se propagan: quien llama decide (el aviso
 * responde 500 para que Mercado Pago reintente).
 */
export async function procesarSuscripcionDeMp(id: string, opciones: { deInstitucion?: string } = {}): Promise<SuscripcionProcesada | null> {
  const suscripcion = await obtenerSuscripcionMp(id);
  if (opciones.deInstitucion) {
    const mapeo = suscripcion.planId ? await institucionDelPlan(suscripcion.planId) : null;
    if (!mapeo || mapeo.institucionId !== opciones.deInstitucion) return null;
  }

  const { resultado, reemplazada } = await aplicarEstadoDeSuscripcion(suscripcion);

  if (resultado === "duplicada") {
    await cancelarSuscripcionMp(suscripcion.id);
    await avisarAAdmins(getDb(), {
      titulo: "Suscripción duplicada de Mercado Pago",
      texto: `Mercado Pago autorizó una segunda suscripción de una institución que ya tenía el débito activo (${suscripcion.id}). Se canceló la duplicada.`,
      enlace: "/backoffice/cobros",
    });
  } else if (resultado === "desconocida" && suscripcion.estado === "authorized") {
    await avisarAAdmins(getDb(), {
      titulo: "Suscripción de Mercado Pago sin registrar",
      texto: `Mercado Pago avisó de una suscripción autorizada que no podemos atribuir a ninguna institución (${suscripcion.id}${suscripcion.planId ? `, plan ${suscripcion.planId}` : ", sin plan"}). Revisala en Mercado Pago: si no corresponde, cancelala.`,
      enlace: "/backoffice/cobros",
    });
  } else if (resultado === "adoptada" && reemplazada) {
    await cancelarSuscripcionMp(reemplazada).catch((e) => console.error("[mercadopago] no se pudo cancelar la suscripción reemplazada", resumenDeError(e)));
  }
  return { suscripcion, resultado };
}
