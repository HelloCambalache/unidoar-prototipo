import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { suscripcionesMp } from "@/db/schema";
import { registrarAuditoria } from "@/lib/auditoria";
import { suscripcionVigente } from "@/lib/debito-automatico";
import { resumenDeError } from "@/lib/errores";
import { cancelarSuscripcionMp, ErrorDeMercadoPago } from "@/lib/mercadopago-cliente";
import { mercadoPagoActivo } from "@/lib/mercadopago-config";
import { suscripcionDe } from "@/lib/queries/suscripcion";

export type ResultadoDeCancelacion = { ok: true; habiaVigente: boolean } | { ok: false; error: string };

/**
 * Cancela el débito automático de una institución. Primero se cancela en Mercado Pago y SOLO si salió bien se anota acá: si Mercado Pago no
 * responde, el estado no cambia y se puede reintentar (nunca queda "cancelado" en pantalla y cobrando). Si Mercado Pago ya no conoce la
 * suscripción, está cancelada igual. La usan quien cancela desde Plan y facturación y la baja de la institución (`motivo`).
 */
export async function cancelarSuscripcion(
  institucionId: string,
  quien: { usuarioId: string | null; motivo: "institucion" | "baja" | "plan-anual" },
): Promise<ResultadoDeCancelacion> {
  const susc = await suscripcionDe(institucionId);
  if (!susc || !suscripcionVigente(susc.estado)) return { ok: true, habiaVigente: false };

  if (!mercadoPagoActivo()) {
    return {
      ok: false,
      error:
        "Hay un débito automático activo y Mercado Pago no está configurado en este entorno, así que no se puede cancelar. Cargá las variables de Mercado Pago o cancelalo a mano desde el panel de Mercado Pago.",
    };
  }
  try {
    await cancelarSuscripcionMp(susc.suscripcionId);
  } catch (e) {
    if (!(e instanceof ErrorDeMercadoPago && e.tipo === "no-existe")) {
      console.error("No se pudo cancelar la suscripción de Mercado Pago", resumenDeError(e));
      return { ok: false, error: "No pudimos cancelar el débito automático en Mercado Pago. Probá de nuevo en un rato." };
    }
  }

  await getDb()
    .update(suscripcionesMp)
    .set({ estado: "cancelada", actualizadaEn: new Date() })
    .where(eq(suscripcionesMp.institucionId, institucionId));
  await registrarAuditoria({
    usuarioId: quien.usuarioId,
    accion: "suscripcion.cancelar",
    entidad: "institucion",
    entidadId: institucionId,
    detalle: { desde: susc.estado, motivo: quien.motivo },
  });
  return { ok: true, habiaVigente: true };
}
