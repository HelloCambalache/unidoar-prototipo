import "server-only";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { cobrosMp, type Institucion } from "@/db/schema";
import { esPlanDebitable, estadoDeSuscripcion, type EstadoSuscripcion } from "@/lib/debito-automatico";
import { fechaLarga } from "@/lib/fechas-curso";
import { mercadoPagoActivo } from "@/lib/mercadopago-config";
import { puedeGestionarPlan, rolEnInstitucion } from "@/lib/queries/plan";
import { planes } from "@/lib/queries/planes";
import { cantidadDeSedes } from "@/lib/queries/sedes";
import { suscripcionDe } from "@/lib/queries/suscripcion";
import { ultimoPlanDe } from "@/lib/queries/suscripcion-planes";

/** Cuánto tiempo después de mandar a la persona a Mercado Pago se le sigue ofreciendo "Ya me suscribí" (puede haber seguido sin volver). */
const HORAS_DE_PLAN_RECIENTE = 3;

/** Todo lo que muestra la tarjeta "Débito automático" de /institucion/plan, en una sola lectura. */
export type DebitoVista = {
  /** Mercado Pago está configurado (hay token): sin eso la tarjeta ni se muestra. */
  disponible: boolean;
  /** El plan se cobra mes a mes (el Anual no). */
  planDebitable: boolean;
  puedeGestionar: boolean;
  /** Lo que cobraría Mercado Pago hoy por mes (plan × sedes), o null si no se pudo calcular. */
  montoActual: number | null;
  /**
   * Se la mandó a Mercado Pago hace poco y todavía no hay suscripción: pudo haberse suscripto sin volver a nuestro sitio (o el aviso no llegó),
   * así que se le ofrece confirmarlo.
   */
  planReciente: boolean;
  suscripcion: null | {
    estado: EstadoSuscripcion;
    monto: number;
    /** "20 de noviembre de 2026" */
    proximoCobro: string | null;
    /** Con qué cuenta paga, si Mercado Pago lo informó (por el enlace de un plan no siempre lo hace). */
    email: string | null;
  };
  /** El último cobro, si fue rechazado y el débito sigue activo (Mercado Pago lo reintenta solo). */
  rechazo: null | { periodo: string; detalle: string | null };
};

export async function datosDeDebito(institucion: Institucion, usuarioId: string): Promise<DebitoVista> {
  const db = getDb();
  const [P, rol, susc, ultimo, sedes, plan] = await Promise.all([
    planes(),
    rolEnInstitucion(institucion, usuarioId),
    suscripcionDe(institucion.id),
    db.select().from(cobrosMp).where(eq(cobrosMp.institucionId, institucion.id)).orderBy(desc(cobrosMp.actualizadoEn)).limit(1),
    cantidadDeSedes(db, [institucion.id]),
    ultimoPlanDe(institucion.id),
  ]);
  const monto = P.montoDePlan(institucion.plan, sedes.get(institucion.id) ?? 1);
  const estado = susc ? (estadoDeSuscripcion(susc.estado) ?? "cancelada") : null;
  const cobro = ultimo[0];
  const sinSuscripcionViva = !estado || estado === "cancelada";
  const planReciente = !!plan && sinSuscripcionViva && Date.now() - plan.creadoEn.getTime() < HORAS_DE_PLAN_RECIENTE * 60 * 60 * 1000;

  return {
    disponible: mercadoPagoActivo(),
    planDebitable: esPlanDebitable(institucion.plan),
    puedeGestionar: puedeGestionarPlan(rol),
    montoActual: Number.isInteger(monto) && monto > 0 ? monto : null,
    planReciente,
    suscripcion:
      susc && estado
        ? { estado, monto: susc.monto, proximoCobro: susc.proximoCobro ? fechaLarga(susc.proximoCobro) : null, email: susc.email }
        : null,
    rechazo: cobro && cobro.resultado === "rechazado" && estado === "autorizada" ? { periodo: cobro.periodo ?? "", detalle: cobro.detalle } : null,
  };
}
