import "server-only";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { cobrosMp } from "@/db/schema";
import { estadoGuardado, type EstadoSuscripcion } from "@/lib/debito-automatico";
import { fechaLarga } from "@/lib/fechas-curso";
import { suscripcionDe } from "@/lib/queries/suscripcion";

/** Cuántos cobros recientes se muestran en la ficha. */
const COBROS_A_MOSTRAR = 5;

export type DebitoParaBackoffice = {
  suscripcion: null | {
    estado: EstadoSuscripcion;
    monto: number;
    /** Clave del plan para el que se suscribió. */
    plan: string;
    /** "20 de noviembre de 2026" */
    proximoCobro: string | null;
    desde: Date;
    /** Con qué cuenta paga, si Mercado Pago lo informó (por el enlace de un plan no siempre lo hace). */
    email: string | null;
  };
  /** Los últimos cobros (aprobados, rechazados y en proceso), del más nuevo al más viejo. */
  cobros: { id: string; periodo: string | null; monto: number | null; resultado: string; intento: number; cuando: Date }[];
};

/** El débito automático de una institución, para la ficha del backoffice: estado, próximo cobro y últimos cobros. */
export async function debitoParaBackoffice(institucionId: string): Promise<DebitoParaBackoffice> {
  const [susc, cobros] = await Promise.all([
    suscripcionDe(institucionId),
    getDb()
      .select({ id: cobrosMp.id, periodo: cobrosMp.periodo, monto: cobrosMp.monto, resultado: cobrosMp.resultado, intento: cobrosMp.intento, cuando: cobrosMp.actualizadoEn })
      .from(cobrosMp)
      .where(eq(cobrosMp.institucionId, institucionId))
      .orderBy(desc(cobrosMp.actualizadoEn))
      .limit(COBROS_A_MOSTRAR),
  ]);
  return {
    suscripcion: susc
      ? {
          estado: estadoGuardado(susc.estado) ?? "cancelada",
          monto: susc.monto,
          plan: susc.plan,
          proximoCobro: susc.proximoCobro ? fechaLarga(susc.proximoCobro) : null,
          desde: susc.creadaEn,
          email: susc.email,
        }
      : null,
    cobros,
  };
}
