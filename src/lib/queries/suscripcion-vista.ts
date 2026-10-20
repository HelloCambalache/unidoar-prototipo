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

/** Todo lo que muestra la tarjeta "Débito automático" de /institucion/plan, en una sola lectura. */
export type DebitoVista = {
  /** Mercado Pago está configurado (token y clave de los avisos): sin eso la tarjeta ni se muestra. */
  disponible: boolean;
  /** El plan se cobra mes a mes (el Anual no). */
  planDebitable: boolean;
  puedeGestionar: boolean;
  /** Lo que cobraría Mercado Pago hoy por mes (plan × sedes), o null si no se pudo calcular. */
  montoActual: number | null;
  emailSugerido: string;
  suscripcion: null | {
    estado: EstadoSuscripcion;
    monto: number;
    /** "20 de noviembre de 2026" */
    proximoCobro: string | null;
    email: string;
  };
  /** El último cobro, si fue rechazado y el débito sigue activo (Mercado Pago lo reintenta solo). */
  rechazo: null | { periodo: string; detalle: string | null };
};

export async function datosDeDebito(institucion: Institucion, usuarioId: string, emailDeLaCuenta: string): Promise<DebitoVista> {
  const db = getDb();
  const [P, rol, susc, ultimo, sedes] = await Promise.all([
    planes(),
    rolEnInstitucion(institucion, usuarioId),
    suscripcionDe(institucion.id),
    db.select().from(cobrosMp).where(eq(cobrosMp.institucionId, institucion.id)).orderBy(desc(cobrosMp.actualizadoEn)).limit(1),
    cantidadDeSedes(db, [institucion.id]),
  ]);
  const monto = P.montoDePlan(institucion.plan, sedes.get(institucion.id) ?? 1);
  const estado = susc ? (estadoDeSuscripcion(susc.estado) ?? "cancelada") : null;
  const cobro = ultimo[0];

  return {
    disponible: mercadoPagoActivo(),
    planDebitable: esPlanDebitable(institucion.plan),
    puedeGestionar: puedeGestionarPlan(rol),
    montoActual: Number.isInteger(monto) && monto > 0 ? monto : null,
    emailSugerido: emailDeLaCuenta,
    suscripcion:
      susc && estado
        ? { estado, monto: susc.monto, proximoCobro: susc.proximoCobro ? fechaLarga(susc.proximoCobro) : null, email: susc.email }
        : null,
    rechazo: cobro && cobro.resultado === "rechazado" && estado === "autorizada" ? { periodo: cobro.periodo ?? "", detalle: cobro.detalle } : null,
  };
}
