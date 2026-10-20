import "server-only";
import { getDb } from "@/db";
import { suscripcionesMp } from "@/db/schema";
import { leerCobro } from "@/lib/debito-automatico";
import { resumenDeError } from "@/lib/errores";
import { buscarCobrosMp, obtenerSuscripcionMp } from "@/lib/mercadopago-cliente";
import { mercadoPagoActivo } from "@/lib/mercadopago-config";
import { avisarAAdmins } from "@/lib/queries/avisos";
import { aplicarCobro, aplicarEstadoDeSuscripcion } from "@/lib/queries/suscripcion";

export type ResultadoDeReconciliacion = { revisadas: number; estadosCorregidos: number; cobrosRecuperados: number; fallidas: number };

/** Hasta cuándo se sigue revisando una suscripción ya cancelada: cubre un último cobro que acreditó después de la baja. */
const DIAS_DE_CANCELADAS = 60;

/**
 * La red de seguridad de los avisos: una vez por día le pregunta a Mercado Pago, por cada suscripción viva, en qué estado está y qué cobros
 * tiene, y aplica lo que falte. Hace falta porque Mercado Pago **no siempre avisa cuando un cobro "en proceso" se acredita**, ni se puede
 * contar con que todos los avisos lleguen (Biomea perdió un cobro real de $95.200 así: quedó cobrado y sin anotar hasta que alguien lo vio
 * a mano). Todo es idempotente: un cobro ya aplicado no se toca ("repetido"). Si recupera algo, le avisa al equipo, porque es señal de que
 * un aviso no llegó. La corre el cron diario de facturas. Nunca lanza: cada suscripción se revisa por separado y lo que falle se reintenta mañana.
 */
export async function reconciliarSuscripciones(): Promise<ResultadoDeReconciliacion> {
  const resultado: ResultadoDeReconciliacion = { revisadas: 0, estadosCorregidos: 0, cobrosRecuperados: 0, fallidas: 0 };
  if (!mercadoPagoActivo()) return resultado;

  try {
    const filas = await getDb().select().from(suscripcionesMp);
    const limite = Date.now() - DIAS_DE_CANCELADAS * 24 * 60 * 60 * 1000;
    // Las canceladas viejas no se consultan: no pueden tener cobros nuevos y cada una cuesta una llamada a la API en cada corrida.
    const aRevisar = filas.filter((f) => f.estado !== "cancelada" || f.actualizadaEn.getTime() > limite);

    for (const susc of aRevisar) {
      resultado.revisadas++;
      try {
        const { resultado: estado } = await aplicarEstadoDeSuscripcion(await obtenerSuscripcionMp(susc.suscripcionId));
        if (estado === "actualizada" || estado === "adoptada") resultado.estadosCorregidos++;

        for (const cobro of await buscarCobrosMp(susc.suscripcionId)) {
          const leido = leerCobro(cobro);
          if (!leido) continue;
          if ((await aplicarCobro(leido)) === "aprobado") resultado.cobrosRecuperados++;
        }
      } catch (e) {
        resultado.fallidas++;
        console.error("[mercadopago] no se pudo revisar una suscripción", resumenDeError(e));
      }
    }

    if (resultado.cobrosRecuperados > 0) {
      await avisarAAdmins(getDb(), {
        titulo: "Cobros de Mercado Pago recuperados",
        texto: `La revisión diaria encontró ${resultado.cobrosRecuperados} cobro${resultado.cobrosRecuperados === 1 ? "" : "s"} aprobado${resultado.cobrosRecuperados === 1 ? "" : "s"} que no estaban anotados (el aviso de Mercado Pago no llegó o llegó antes de acreditar). Ya quedaron marcados como pagos.`,
        enlace: "/backoffice/cobros",
      });
    }
  } catch (e) {
    console.error("[mercadopago] no se pudieron revisar las suscripciones", resumenDeError(e));
    resultado.fallidas++;
  }
  return resultado;
}
