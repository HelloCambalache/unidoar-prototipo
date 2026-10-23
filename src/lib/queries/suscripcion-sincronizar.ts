import "server-only";
import { inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { instituciones, suscripcionesMp } from "@/db/schema";
import { registrarAuditoria } from "@/lib/auditoria";
import { decidirSincronizacion } from "@/lib/debito-automatico";
import { resumenDeError } from "@/lib/errores";
import { cambiarMontoMp } from "@/lib/mercadopago-cliente";
import { mercadoPagoActivo } from "@/lib/mercadopago-config";
import { pesos } from "@/lib/planes";
import { avisarAAdmins, avisarAVarios } from "@/lib/queries/avisos";
import { acuerdosDePrecio } from "@/lib/queries/acuerdos";
import { destinatariosDeInstitucion } from "@/lib/queries/backoffice-instituciones";
import { planes } from "@/lib/queries/planes";
import { cantidadDeSedes } from "@/lib/queries/sedes";
import { cancelarSuscripcion } from "@/lib/queries/suscripcion-cancelar";

export type ResultadoDeSincronizacion = { revisadas: number; montosActualizados: number; canceladas: number; fallidas: number };

/**
 * Pone al día las suscripciones de débito automático con lo que hoy cuesta el plan (precio de lista o acordado, y sedes): si cambió el precio, las
 * sedes o el plan de la institución, el monto que cobra Mercado Pago cada mes cambia desde el próximo cobro; si el plan pasó a Anual (que
 * no se debita), la suscripción se cancela. Es UNA sola revisión que cubre todos los caminos por los que puede cambiar un monto (el equipo
 * edita Planes, aprueba un cambio de plan, la institución suma una sede…), a costa de que el cambio llegue a Mercado Pago en el cron del
 * día siguiente. La corre el cron diario de facturas. Nunca lanza: cada suscripción se revisa por separado y lo que falle se reintenta mañana.
 */
export async function sincronizarSuscripciones(): Promise<ResultadoDeSincronizacion> {
  const resultado: ResultadoDeSincronizacion = { revisadas: 0, montosActualizados: 0, canceladas: 0, fallidas: 0 };
  if (!mercadoPagoActivo()) return resultado;

  try {
    const db = getDb();
    // Pendientes no: todavía no cobran, y el monto que se autoriza es el que se le mostró a la persona.
    const filas = await db.select().from(suscripcionesMp).where(inArray(suscripcionesMp.estado, ["autorizada", "pausada"]));
    if (filas.length === 0) return resultado;

    const ids = filas.map((f) => f.institucionId);
    const [P, sedes, acuerdos, insts] = await Promise.all([
      planes(),
      cantidadDeSedes(db, ids),
      acuerdosDePrecio(db, ids),
      db.select({ id: instituciones.id, nombre: instituciones.nombre, plan: instituciones.plan }).from(instituciones).where(inArray(instituciones.id, ids)),
    ]);
    const porId = new Map(insts.map((i) => [i.id, i]));

    for (const susc of filas) {
      resultado.revisadas++;
      const inst = porId.get(susc.institucionId);
      if (!inst) continue;
      try {
        const esperado = P.montoDePlan(inst.plan, sedes.get(inst.id) ?? 1, acuerdos.get(inst.id) ?? null);
        const decision = decidirSincronizacion({ plan: inst.plan, monto: susc.monto, esperado });

        if (decision.accion === "cancelar") {
          const cancelada = await cancelarSuscripcion(inst.id, { usuarioId: null, motivo: "plan-anual" });
          if (!cancelada.ok) throw new Error(cancelada.error);
          resultado.canceladas++;
          await avisarAVarios(db, await destinatariosDeInstitucion(db, inst.id), {
            tipo: "sistema",
            titulo: "UNIDOAR",
            texto: "tu plan pasó a ser anual y se paga por adelantado, así que cancelamos el débito automático mensual.",
            enlace: "/institucion/plan",
          });
          await avisarAAdmins(db, {
            titulo: "Débito automático cancelado",
            texto: `${inst.nombre} pasó al plan Anual: se canceló su débito automático mensual.`,
            enlace: `/backoffice/cobros/${inst.id}`,
          });
        } else if (decision.accion === "cambiar-monto") {
          const { estado: estadoTrasElCambio } = await cambiarMontoMp(susc.suscripcionId, decision.monto);
          await db.update(suscripcionesMp).set({ monto: decision.monto, actualizadaEn: new Date() }).where(inArray(suscripcionesMp.institucionId, [inst.id]));
          resultado.montosActualizados++;
          await registrarAuditoria({
            usuarioId: null,
            accion: "suscripcion.monto",
            entidad: "institucion",
            entidadId: inst.id,
            detalle: { origen: "automatica", antes: susc.monto, despues: decision.monto },
          });
          await avisarAVarios(db, await destinatariosDeInstitucion(db, inst.id), {
            tipo: "sistema",
            titulo: "UNIDOAR",
            texto: `el débito automático pasa de ${pesos(susc.monto)} a ${pesos(decision.monto)} por mes desde el próximo cobro, por el cambio en tu plan.`,
            enlace: "/institucion/plan",
          });
          // Un aumento puede sacar la suscripción de "autorizada" hasta que la persona apruebe el monto nuevo en Mercado Pago: no se da por
          // hecho que siga cobrando. Si quedó en otro estado, lo ve el equipo (el aviso de cambio de estado de Mercado Pago actualiza el resto).
          if (estadoTrasElCambio && estadoTrasElCambio !== "authorized" && estadoTrasElCambio !== "paused") {
            await avisarAAdmins(db, {
              titulo: "Débito automático: monto por aprobar",
              texto: `${inst.nombre}: se actualizó el monto a ${pesos(decision.monto)} y Mercado Pago dejó la suscripción en estado «${estadoTrasElCambio}». Puede estar esperando que la institución apruebe el monto nuevo: revisala en Mercado Pago.`,
              enlace: `/backoffice/cobros/${inst.id}`,
            });
          }
        }
      } catch (e) {
        resultado.fallidas++;
        console.error("No se pudo poner al día una suscripción de Mercado Pago", resumenDeError(e));
      }
    }
  } catch (e) {
    console.error("No se pudieron revisar las suscripciones de Mercado Pago", resumenDeError(e));
    resultado.fallidas++;
  }
  return resultado;
}
