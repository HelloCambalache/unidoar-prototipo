import "server-only";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { cobrosMp, type Institucion } from "@/db/schema";
import { etiquetaPeriodo, hoyAR } from "@/lib/cobros";
import { decidirActivacion, esPlanDebitable, estadoGuardado, suscripcionVigente, type EstadoSuscripcion } from "@/lib/debito-automatico";
import { fechaLarga } from "@/lib/fechas-curso";
import { diferirPrimerCobroActivo } from "@/lib/mercadopago-config";
import { acuerdoDe } from "@/lib/queries/acuerdos";
import { debitoDisponiblePara } from "@/lib/queries/mercadopago-modo";
import { puedeGestionarPlan, rolEnInstitucion } from "@/lib/queries/plan";
import { planes } from "@/lib/queries/planes";
import { cantidadDeSedes } from "@/lib/queries/sedes";
import { suscripcionDe } from "@/lib/queries/suscripcion";
import { estadoDePago, ultimoPlanDe } from "@/lib/queries/suscripcion-planes";

/** Cuánto tiempo después de mandar a la persona a Mercado Pago se le sigue ofreciendo "Ya me suscribí" (puede haber seguido sin volver). */
const HORAS_DE_PLAN_RECIENTE = 3;

/** Todo lo que muestra la tarjeta "Débito automático" de /institucion/plan, en una sola lectura. */
export type DebitoVista = {
  /** Mercado Pago está configurado (hay token): sin eso la tarjeta ni se muestra. */
  disponible: boolean;
  /** El plan se cobra mes a mes (la búsqueda puntual no). */
  planDebitable: boolean;
  puedeGestionar: boolean;
  /** Lo que cobraría Mercado Pago hoy por mes (plan × sedes), o null si no se pudo calcular. */
  montoActual: number | null;
  /**
   * Se la mandó a Mercado Pago hace poco y todavía no hay suscripción: pudo haberse suscripto sin volver a nuestro sitio (o el aviso no llegó),
   * así que se le ofrece confirmarlo.
   */
  planReciente: boolean;
  /**
   * Si el mes en curso ya está pago y el período de prueba está encendido, cuándo sale el primer cobro del débito ("20 de noviembre de 2026"):
   * en vez de cobrar al suscribirse, Mercado Pago espera al próximo día de cobro. null si el primer cobro sale al suscribirse.
   */
  primerCobro: string | null;
  /**
   * Si el mes en curso ya está pago y la institución es real (y el período de prueba está apagado), desde cuándo puede activar el débito
   * ("1 de noviembre de 2026"): hasta entonces no se le ofrece, para no cobrarle dos veces el mismo mes. null si puede activarlo ahora.
   */
  activarDesde: string | null;
  /** Si lo que impide activarlo es un semestre pagado al contado, hasta qué mes está pago ("marzo 2027"); null si es solo el mes en curso. */
  semestrePagoHasta: string | null;
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
  const [P, rol, susc, ultimo, sedes, plan, pago, acuerdo] = await Promise.all([
    planes(),
    rolEnInstitucion(institucion, usuarioId),
    suscripcionDe(institucion.id),
    db.select().from(cobrosMp).where(eq(cobrosMp.institucionId, institucion.id)).orderBy(desc(cobrosMp.actualizadoEn)).limit(1),
    cantidadDeSedes(db, [institucion.id]),
    ultimoPlanDe(institucion.id),
    estadoDePago(institucion.id),
    acuerdoDe(db, institucion.id),
  ]);
  const monto = P.montoDePlan(institucion.plan, sedes.get(institucion.id) ?? 1, acuerdo);
  // `susc.estado` ya está en nuestro vocabulario (autorizada…): no se traduce como los de Mercado Pago (authorized…). Con el traductor de
  // Mercado Pago, una suscripción autorizada se mostraba como cancelada.
  const estado = susc ? (estadoGuardado(susc.estado) ?? "cancelada") : null;
  const cobro = ultimo[0];
  const sinSuscripcionViva = !estado || estado === "cancelada";
  const planReciente = !!plan && sinSuscripcionViva && Date.now() - plan.creadoEn.getTime() < HORAS_DE_PLAN_RECIENTE * 60 * 60 * 1000;
  const decision = sinSuscripcionViva
    ? decidirActivacion({
        hoy: hoyAR(),
        diaDeCobro: institucion.diaCobro,
        mesActualPago: pago.mesActualPago,
        pagoHasta: pago.pagoHasta,
        diferirActivo: diferirPrimerCobroActivo(),
        esDemo: institucion.esDemo,
      })
    : null;

  return {
    // Sin token no hay débito; con un token de prueba, solo las instituciones de ejemplo lo ven (una real no puede suscribirse a un cobro de mentira).
    disponible: await debitoDisponiblePara(institucion),
    planDebitable: esPlanDebitable(institucion.plan),
    puedeGestionar: puedeGestionarPlan(rol),
    montoActual: Number.isInteger(monto) && monto > 0 ? monto : null,
    planReciente,
    primerCobro: decision?.accion === "con-prueba" ? fechaLarga(decision.fecha) : null,
    activarDesde: decision?.accion === "esperar" ? fechaLarga(decision.desde) : null,
    semestrePagoHasta: decision?.accion === "esperar" && decision.hasta ? etiquetaPeriodo(decision.hasta).toLowerCase() : null,
    suscripcion:
      susc && estado
        ? { estado, monto: susc.monto, proximoCobro: susc.proximoCobro ? fechaLarga(susc.proximoCobro) : null, email: susc.email }
        : null,
    rechazo: cobro && cobro.resultado === "rechazado" && estado === "autorizada" ? { periodo: cobro.periodo ?? "", detalle: cobro.detalle } : null,
  };
}

/**
 * ¿Se le muestra en el inicio de la institución el aviso para activar el débito automático? Sí cuando ya está verificada (no se le pide pagar
 * antes de que la revisemos), no está suspendida, su plan es mensual, puede manejar el plan, el débito está disponible para ella y todavía no
 * tiene una suscripción viva. Devuelve lo que cobraría por mes, o null si no hay que mostrarlo.
 */
export async function avisoDeDebito(institucion: Institucion, usuarioId: string): Promise<{ monto: number | null } | null> {
  if (!institucion.verificada || institucion.suspendida || !esPlanDebitable(institucion.plan)) return null;
  if (!(await debitoDisponiblePara(institucion))) return null;
  const [rol, susc] = await Promise.all([rolEnInstitucion(institucion, usuarioId), suscripcionDe(institucion.id)]);
  if (!puedeGestionarPlan(rol)) return null;
  if (susc && suscripcionVigente(susc.estado)) return null;
  // Con el mes ya pago una institución real todavía no puede activarlo: no se le propone.
  const decision = decidirActivacion({
    hoy: hoyAR(),
    diaDeCobro: institucion.diaCobro,
    ...(await estadoDePago(institucion.id)),
    diferirActivo: diferirPrimerCobroActivo(),
    esDemo: institucion.esDemo,
  });
  if (decision.accion === "esperar") return null;
  const [P, sedes, acuerdo] = await Promise.all([planes(), cantidadDeSedes(getDb(), [institucion.id]), acuerdoDe(getDb(), institucion.id)]);
  const monto = P.montoDePlan(institucion.plan, sedes.get(institucion.id) ?? 1, acuerdo);
  return { monto: Number.isInteger(monto) && monto > 0 ? monto : null };
}
