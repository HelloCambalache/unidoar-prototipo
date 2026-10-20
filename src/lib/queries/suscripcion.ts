import "server-only";
import { and, eq } from "drizzle-orm";
import { getDb, transaccion } from "@/db";
import { cobrosMp, facturas, instituciones, suscripcionesMp, type SuscripcionMp } from "@/db/schema";
import { registrarAuditoria } from "@/lib/auditoria";
import { etiquetaPeriodo, fechaCobroDelPeriodo, hoyAR, periodoActual } from "@/lib/cobros";
import { correoDePagoRegistrado } from "@/lib/correo/eventos";
import { accionSobreLaFactura, estadoDeSuscripcion, type CobroLeido } from "@/lib/debito-automatico";
import type { SuscripcionDeMercadoPago } from "@/lib/mercadopago-cliente";
import { pesos } from "@/lib/planes";
import { avisarAAdmins, avisarAVarios } from "@/lib/queries/avisos";
import { destinatariosDeFacturacion, destinatariosDeInstitucion } from "@/lib/queries/backoffice-instituciones";

/*
 * Lo que se escribe en la base cuando Mercado Pago avisa algo de una suscripción (ver CLAUDE.md, "Mercado Pago"). Cada función corre en
 * UNA transacción, bloquea la institución para no pisarse con otro aviso y es idempotente: Mercado Pago repite avisos (hasta que
 * respondemos 200) y un mismo cobro nunca se aplica dos veces (la clave de `cobros_mp` es el número del cobro en Mercado Pago).
 */

const MEDIO = "Débito automático";

export async function suscripcionDe(institucionId: string, ejecutor: Pick<ReturnType<typeof getDb>, "select"> = getDb()): Promise<SuscripcionMp | null> {
  const [fila] = await ejecutor.select().from(suscripcionesMp).where(eq(suscripcionesMp.institucionId, institucionId)).limit(1);
  return fila ?? null;
}

/** "2026-11-20T15:00:00.000-04:00" → "2026-11-20" (el día en Argentina), o null si no es una fecha. */
function diaDeMercadoPago(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const fecha = new Date(iso);
  return Number.isNaN(fecha.getTime()) ? null : hoyAR(fecha);
}

export type ResultadoDeEstado = "actualizada" | "sin-cambios" | "adoptada" | "duplicada" | "desconocida";

export type RespuestaDeEstado = {
  resultado: ResultadoDeEstado;
  /** Si una suscripción nueva reemplazó a una que seguía pendiente: la vieja, para cancelarla en Mercado Pago (no debe poder cobrar). */
  reemplazada?: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Espeja el estado de la suscripción que informa Mercado Pago (aviso `subscription_preapproval`). Solo avisa cuando el estado cambia:
 * al pasar a "autorizada" le cuenta a la institución que el débito quedó activo; si pasa a pausada o cancelada desde Mercado Pago (la
 * persona lo hizo en su cuenta) avisa a la institución y al equipo, que tiene que saber que ese mes no se va a cobrar solo.
 *
 * Una suscripción que NO tenemos anotada se liga por su `external_reference` (el id de la institución que le pusimos al crearla). Biomea
 * vio que Mercado Pago puede crear una suscripción nueva cuando la persona reintenta con otra tarjeta en el mismo checkout: si la nuestra
 * seguía pendiente y esta quedó autorizada, esta pasa a ser la vigente ("adoptada"). Si la institución ya tenía otra activa, es una
 * duplicada (la ruta la cancela). Si no hay a quién ligarla, queda "desconocida" y se avisa al equipo SIN cancelar nada: puede ser legítima.
 */
export async function aplicarEstadoDeSuscripcion(mp: SuscripcionDeMercadoPago): Promise<RespuestaDeEstado> {
  return transaccion(async (tx) => {
    const estadoMp = estadoDeSuscripcion(mp.estado);
    let [fila] = await tx.select().from(suscripcionesMp).where(eq(suscripcionesMp.suscripcionId, mp.id)).limit(1).for("update");
    let adoptada = false;
    let reemplazada: string | undefined;

    if (!fila) {
      const institucionId = mp.referencia && UUID.test(mp.referencia) ? mp.referencia : null;
      if (!institucionId || estadoMp !== "autorizada") return { resultado: "desconocida" };
      // Bloquea la institución para no pisarse con otro aviso de la misma suscripción.
      await tx.select({ id: instituciones.id }).from(instituciones).where(eq(instituciones.id, institucionId)).limit(1).for("update");
      const [propia] = await tx.select().from(suscripcionesMp).where(eq(suscripcionesMp.institucionId, institucionId)).limit(1).for("update");
      if (!propia) return { resultado: "desconocida" };
      if (propia.estado === "autorizada" || propia.estado === "pausada") return { resultado: "duplicada" };
      reemplazada = propia.estado === "pendiente" ? propia.suscripcionId : undefined;
      await tx.update(suscripcionesMp).set({ suscripcionId: mp.id }).where(eq(suscripcionesMp.institucionId, institucionId));
      fila = { ...propia, suscripcionId: mp.id };
      adoptada = true;
    }

    const estado = estadoMp ?? fila.estado;
    const proximoCobro = diaDeMercadoPago(mp.proximoCobro) ?? fila.proximoCobro;
    const monto = mp.monto !== null && Number.isInteger(mp.monto) && mp.monto > 0 ? mp.monto : fila.monto;
    if (!adoptada && estado === fila.estado && proximoCobro === fila.proximoCobro && monto === fila.monto) return { resultado: "sin-cambios" };

    await tx
      .update(suscripcionesMp)
      .set({ estado, proximoCobro, monto, actualizadaEn: new Date() })
      .where(eq(suscripcionesMp.institucionId, fila.institucionId));
    if (estado === fila.estado) return { resultado: adoptada ? "adoptada" : "actualizada", reemplazada };

    const [inst] = await tx.select({ nombre: instituciones.nombre }).from(instituciones).where(eq(instituciones.id, fila.institucionId)).limit(1);
    const nombre = inst?.nombre ?? "una institución";
    await registrarAuditoria(
      {
        usuarioId: null,
        accion: `suscripcion.${estado}`,
        entidad: "institucion",
        entidadId: fila.institucionId,
        detalle: { origen: "mercadopago", antes: fila.estado, despues: estado, monto, ...(adoptada ? { adoptada: true } : {}) },
      },
      tx,
    );

    const destinatarios = await destinatariosDeInstitucion(tx, fila.institucionId);
    if (estado === "autorizada") {
      await avisarAVarios(tx, destinatarios, {
        tipo: "sistema",
        titulo: "UNIDOAR",
        texto: `activaste el débito automático: Mercado Pago cobra ${pesos(monto)} cada mes.`,
        enlace: "/institucion/plan",
      });
    } else if (estado === "cancelada" || estado === "pausada") {
      const que = estado === "cancelada" ? "quedó cancelado" : "quedó en pausa";
      await avisarAVarios(tx, destinatarios, {
        tipo: "sistema",
        titulo: "UNIDOAR",
        texto: `el débito automático ${que}. Mientras tanto los pagos del plan se hacen por otro medio.`,
        enlace: "/institucion/plan",
      });
      await avisarAAdmins(tx, {
        titulo: "Débito automático",
        texto: `${nombre}: el débito automático ${que} desde Mercado Pago. Los cobros de los próximos meses ya no salen solos.`,
        enlace: `/backoffice/cobros/${fila.institucionId}`,
      });
    }
    return { resultado: adoptada ? "adoptada" : "actualizada", reemplazada };
  });
}

export type ResultadoDeCobro = "aprobado" | "repetido" | "rechazado" | "registrado" | "sin-suscripcion";

/**
 * Aplica un cobro de la suscripción (aviso `subscription_authorized_payment`). Solo un cobro APROBADO mueve plata: marca paga la factura del
 * mes (la crea si todavía no existía) con el medio "Débito automático" y le avisa a la institución. Un cobro rechazado se anota y se avisa
 * (Mercado Pago lo reintenta solo). Si el mes ya figuraba pago por otro medio, no se pisa nada y se le avisa al equipo: puede haber un doble
 * cobro para devolver.
 */
export async function aplicarCobro(cobro: CobroLeido): Promise<ResultadoDeCobro> {
  return transaccion(async (tx) => {
    const [susc] = await tx.select().from(suscripcionesMp).where(eq(suscripcionesMp.suscripcionId, cobro.suscripcionId)).limit(1);
    if (!susc) return "sin-suscripcion";

    const [inst] = await tx
      .select({ id: instituciones.id, nombre: instituciones.nombre, plan: instituciones.plan, diaCobro: instituciones.diaCobro })
      .from(instituciones)
      .where(eq(instituciones.id, susc.institucionId))
      .limit(1)
      .for("update");
    if (!inst) return "sin-suscripcion";

    const [previo] = await tx.select().from(cobrosMp).where(eq(cobrosMp.id, cobro.id)).limit(1);
    if (previo?.resultado === "aprobado") return "repetido";

    const periodo = cobro.periodo ?? periodoActual();
    const monto = cobro.monto ?? susc.monto;
    const base = {
      institucionId: inst.id,
      suscripcionId: cobro.suscripcionId,
      periodo,
      monto,
      resultado: cobro.resultado,
      pagoId: cobro.pagoId,
      detalle: cobro.detalle,
      intento: cobro.intento,
      debitoEn: cobro.debitoEn,
    };

    if (cobro.resultado !== "aprobado") {
      await tx
        .insert(cobrosMp)
        .values({ id: cobro.id, ...base })
        .onConflictDoUpdate({ target: cobrosMp.id, set: { ...base, actualizadoEn: new Date() } });
      // Se avisa la primera vez que vemos el rechazo y en cada reintento nuevo; un aviso repetido del mismo intento no vuelve a avisar.
      const esNuevo = !previo || previo.resultado !== "rechazado" || cobro.intento > previo.intento;
      if (cobro.resultado === "rechazado" && esNuevo) {
        await avisarAVarios(tx, await destinatariosDeInstitucion(tx, inst.id), {
          tipo: "sistema",
          titulo: "UNIDOAR",
          texto: `no pudimos cobrar el débito automático de ${etiquetaPeriodo(periodo)}. Mercado Pago lo vuelve a intentar: revisá el medio de pago en tu cuenta de Mercado Pago.`,
          enlace: "/institucion/plan",
        });
        if (!previo) {
          await avisarAAdmins(tx, {
            titulo: "Débito automático rechazado",
            texto: `${inst.nombre}: Mercado Pago no pudo cobrar ${etiquetaPeriodo(periodo)}${cobro.detalle ? ` (${cobro.detalle})` : ""}.`,
            enlace: `/backoffice/cobros/${inst.id}`,
          });
        }
      }
      return cobro.resultado === "rechazado" ? "rechazado" : "registrado";
    }

    // Aprobado: la factura del mes. Si el cron la creó a la vez, el índice único (institución, período) nos manda a la rama de "marcar".
    const buscarFactura = async () =>
      (await tx.select().from(facturas).where(and(eq(facturas.institucionId, inst.id), eq(facturas.periodo, periodo))).limit(1).for("update"))[0];
    let factura = await buscarFactura();
    let accion = accionSobreLaFactura(factura);
    const pagadaEn = cobro.debitoEn && cobro.debitoEn !== hoyAR() ? new Date(`${cobro.debitoEn}T12:00:00Z`) : new Date();

    if (accion === "crear-paga") {
      const [nueva] = await tx
        .insert(facturas)
        .values({ institucionId: inst.id, plan: inst.plan, monto, periodo, fechaCobro: fechaCobroDelPeriodo(periodo, inst.diaCobro), estado: "pagada", pagadaEn, medio: MEDIO })
        .onConflictDoNothing()
        .returning();
      if (nueva) factura = nueva;
      else {
        factura = await buscarFactura();
        accion = accionSobreLaFactura(factura);
      }
    }
    if (accion === "marcar-paga" && factura) {
      await tx.update(facturas).set({ estado: "pagada", pagadaEn, medio: MEDIO }).where(eq(facturas.id, factura.id));
    }

    await tx
      .insert(cobrosMp)
      .values({ id: cobro.id, ...base, facturaId: factura?.id ?? null })
      .onConflictDoUpdate({ target: cobrosMp.id, set: { ...base, facturaId: factura?.id ?? null, actualizadoEn: new Date() } });

    await registrarAuditoria(
      {
        usuarioId: null,
        accion: "factura.pagar",
        entidad: "factura",
        entidadId: factura?.id ?? inst.id,
        detalle: { institucionId: inst.id, periodo, monto, medio: MEDIO, origen: "mercadopago", cobroId: cobro.id, pagoId: cobro.pagoId, accion },
      },
      tx,
    );

    if (accion === "ya-estaba-paga") {
      await avisarAAdmins(tx, {
        titulo: "Posible doble cobro",
        texto: `${inst.nombre}: Mercado Pago cobró ${pesos(monto)} de ${etiquetaPeriodo(periodo)}, un mes que ya figuraba pago. Revisar si hay que devolverlo.`,
        enlace: `/backoffice/cobros/${inst.id}`,
      });
      return "aprobado";
    }
    if (factura && factura.monto !== monto && accion === "marcar-paga") {
      await avisarAAdmins(tx, {
        titulo: "Monto distinto al facturado",
        texto: `${inst.nombre}: la factura de ${etiquetaPeriodo(periodo)} era de ${pesos(factura.monto)} y Mercado Pago cobró ${pesos(monto)}.`,
        enlace: `/backoffice/cobros/${inst.id}`,
      });
    }

    await avisarAVarios(tx, await destinatariosDeInstitucion(tx, inst.id), {
      tipo: "sistema",
      titulo: "UNIDOAR",
      texto: `recibimos tu débito automático de ${etiquetaPeriodo(periodo)} (${pesos(monto)}). ¡Gracias!`,
      enlace: "/institucion/plan",
    });
    await correoDePagoRegistrado(tx, {
      usuarioIds: await destinatariosDeFacturacion(tx, inst.id),
      institucion: inst.nombre,
      periodo,
      monto,
    });
    return "aprobado";
  });
}
