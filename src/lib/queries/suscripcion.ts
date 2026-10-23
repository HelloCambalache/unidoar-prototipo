import "server-only";
import { and, eq } from "drizzle-orm";
import { getDb, transaccion, type Tx } from "@/db";
import { cobrosMp, facturas, instituciones, suscripcionesMp, type SuscripcionMp } from "@/db/schema";
import { registrarAuditoria } from "@/lib/auditoria";
import { etiquetaPeriodo, fechaCobroDelPeriodo, hoyAR, periodoActual } from "@/lib/cobros";
import { correoDeCobroRechazado, correoDePagoRegistrado } from "@/lib/correo/eventos";
import {
  accionSobreLaFactura,
  decidirAltaDeSuscripcion,
  diaDeCobroDelDebito,
  estadoDeSuscripcion,
  montoCobrable,
  type CobroLeido,
  type EstadoSuscripcion,
} from "@/lib/debito-automatico";
import type { SuscripcionDeMercadoPago } from "@/lib/mercadopago-cliente";
import { pesos } from "@/lib/planes";
import { resumenDeError } from "@/lib/errores";
import { avisarAAdmins, avisarAVarios } from "@/lib/queries/avisos";
import { destinatariosDeFacturacion, destinatariosDeInstitucion } from "@/lib/queries/backoffice-instituciones";
import { gastarMesEnCobro } from "@/lib/queries/bonificaciones";
import { avisarReferidorDePago } from "@/lib/queries/referidos";
import { institucionDelPlan } from "@/lib/queries/suscripcion-planes";

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

export type ResultadoDeEstado = "actualizada" | "sin-cambios" | "creada" | "adoptada" | "duplicada" | "desconocida";

export type RespuestaDeEstado = {
  resultado: ResultadoDeEstado;
  /** Si una suscripción nueva reemplazó a una que seguía pendiente: la vieja, para cancelarla en Mercado Pago (no debe poder cobrar). */
  reemplazada?: string;
};

/**
 * Avisa de un cambio de estado de la suscripción y lo deja en la auditoría. Solo se llama cuando el estado cambió de verdad: al pasar a
 * "autorizada" le cuenta a la institución que el débito quedó activo; si pasa a pausada o cancelada desde Mercado Pago (la persona lo hizo
 * en su cuenta) avisa a la institución y al equipo, que tiene que saber que ese mes no se va a cobrar solo. `antes` es null cuando la
 * suscripción recién nace.
 */
async function avisarCambioDeEstado(tx: Tx, institucionId: string, antes: string | null, estado: EstadoSuscripcion, monto: number, extra: Record<string, unknown> = {}) {
  const [inst] = await tx.select({ nombre: instituciones.nombre }).from(instituciones).where(eq(instituciones.id, institucionId)).limit(1);
  const nombre = inst?.nombre ?? "una institución";
  await registrarAuditoria(
    {
      usuarioId: null,
      accion: `suscripcion.${estado}`,
      entidad: "institucion",
      entidadId: institucionId,
      detalle: { origen: "mercadopago", antes, despues: estado, monto, ...extra },
    },
    tx,
  );

  const destinatarios = await destinatariosDeInstitucion(tx, institucionId);
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
      enlace: `/backoffice/cobros/${institucionId}`,
    });
  }
}

/**
 * Alinea el día de cobro de la institución con el día en que Mercado Pago le va a cobrar (el de la suscripción): las facturas vencen el día
 * de cobro de la institución (por defecto el 10) y el débito sale otro día; sin esto, la factura del mes se vería "vencida" (y saldrían los
 * recordatorios) hasta que el débito la cobre. Se hace una sola vez, cuando la suscripción pasa a autorizada: después el equipo puede
 * cambiarlo a mano. Devuelve el cambio (para la auditoría) o null si no hubo nada que cambiar.
 */
async function alinearDiaDeCobro(tx: Tx, institucionId: string, mp: SuscripcionDeMercadoPago): Promise<{ antes: number | null; despues: number } | null> {
  // Con una prueba, el primer cobro todavía no salió: el día del débito es el del próximo cobro, no el del alta.
  const mapeo = mp.planId ? await institucionDelPlan(mp.planId, tx) : null;
  const conPrueba = (mapeo?.diasDePrueba ?? 0) > 0;
  const dia = diaDeCobroDelDebito({ creada: conPrueba ? null : mp.creadaEn, proximoCobro: mp.proximoCobro });
  if (dia === null) return null;
  const [inst] = await tx.select({ dia: instituciones.diaCobro }).from(instituciones).where(eq(instituciones.id, institucionId)).limit(1);
  if (!inst || inst.dia === dia) return null;
  await tx.update(instituciones).set({ diaCobro: dia }).where(eq(instituciones.id, institucionId));
  return { antes: inst.dia, despues: dia };
}

/**
 * Espeja el estado de la suscripción que informa Mercado Pago (aviso `subscription_preapproval`).
 *
 * Una suscripción que NO tenemos anotada se atribuye por su **plan** (`preapproval_plan_id`): cuando la persona se suscribe por el enlace del
 * plan de su institución, Mercado Pago deja vacíos la referencia y el mail, y el plan es lo único que dice de quién es (tabla `planes_mp`).
 * Sin plan conocido queda "desconocida" y la ruta avisa al equipo SIN cancelar nada (puede ser legítima). Si la institución ya tenía otra
 * activa, es "duplicada" (la ruta la cancela: Mercado Pago cobraría las dos); si tenía una pendiente y esta quedó autorizada, esta la
 * reemplaza ("adoptada"). Ver `decidirAltaDeSuscripcion`.
 */
export async function aplicarEstadoDeSuscripcion(mp: SuscripcionDeMercadoPago): Promise<RespuestaDeEstado> {
  return transaccion(async (tx) => {
    const estadoMp = estadoDeSuscripcion(mp.estado);

    // Pone al día la fila de una suscripción que ya tenemos anotada.
    const ponerAlDia = async (fila: SuscripcionMp): Promise<RespuestaDeEstado> => {
      const estado = estadoMp ?? fila.estado;
      const proximoCobro = diaDeMercadoPago(mp.proximoCobro) ?? fila.proximoCobro;
      const monto = montoCobrable(mp.monto) ? mp.monto : fila.monto;
      if (estado === fila.estado && proximoCobro === fila.proximoCobro && monto === fila.monto) return { resultado: "sin-cambios" };

      await tx
        .update(suscripcionesMp)
        .set({ estado, proximoCobro, monto, actualizadaEn: new Date() })
        .where(eq(suscripcionesMp.institucionId, fila.institucionId));
      const dia = estado === "autorizada" && fila.estado !== "autorizada" ? await alinearDiaDeCobro(tx, fila.institucionId, mp) : null;
      if (estado !== fila.estado) await avisarCambioDeEstado(tx, fila.institucionId, fila.estado, estado as EstadoSuscripcion, monto, dia ? { diaDeCobro: dia } : {});
      return { resultado: "actualizada" };
    };

    const [fila] = await tx.select().from(suscripcionesMp).where(eq(suscripcionesMp.suscripcionId, mp.id)).limit(1).for("update");
    if (fila) return ponerAlDia(fila);

    // Una suscripción que todavía no tenemos anotada: ¿de qué institución es? Por su plan.
    const mapeo = mp.planId ? await institucionDelPlan(mp.planId, tx) : null;
    if (!mapeo) return { resultado: "desconocida" };
    // Bloquea la institución para no pisarse con otro aviso de la misma suscripción.
    const [inst] = await tx.select({ id: instituciones.id }).from(instituciones).where(eq(instituciones.id, mapeo.institucionId)).limit(1).for("update");
    if (!inst) return { resultado: "desconocida" };
    const [propia] = await tx.select().from(suscripcionesMp).where(eq(suscripcionesMp.institucionId, inst.id)).limit(1).for("update");

    const decision = decidirAltaDeSuscripcion({ idNuevo: mp.id, estadoNuevo: estadoMp, propia: propia ?? null });
    // Otro camino (el aviso de Mercado Pago o la vuelta de la persona) la anotó mientras esperábamos el bloqueo: es la misma, no un duplicado.
    if (decision === "misma" && propia) return ponerAlDia(propia);
    if (!estadoMp || decision === "ignorar" || decision === "misma") return { resultado: "sin-cambios" };
    if (decision === "duplicada") return { resultado: "duplicada" };

    const monto = montoCobrable(mp.monto) ? mp.monto : mapeo.monto;
    const valores = { suscripcionId: mp.id, estado: estadoMp, plan: mapeo.plan, monto, email: mp.email, proximoCobro: diaDeMercadoPago(mp.proximoCobro) };
    if (propia) {
      await tx.update(suscripcionesMp).set({ ...valores, creadaEn: new Date(), actualizadaEn: new Date() }).where(eq(suscripcionesMp.institucionId, inst.id));
    } else {
      await tx.insert(suscripcionesMp).values({ institucionId: inst.id, ...valores });
    }
    const dia = estadoMp === "autorizada" ? await alinearDiaDeCobro(tx, inst.id, mp) : null;
    await avisarCambioDeEstado(tx, inst.id, propia?.estado ?? null, estadoMp, monto, { plan: mapeo.plan, ...(dia ? { diaDeCobro: dia } : {}) });
    return decision === "reemplazar" ? { resultado: "adoptada", reemplazada: propia?.suscripcionId } : { resultado: "creada" };
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
  const resultado = await aplicarCobroEnLaBase(cobro);
  if (resultado === "aprobado") {
    // Si la institución fue recomendada por otra y este es su primer cobro, se le avisa a quien la recomendó. Después de confirmar y sin
    // frenar nada: el paso del referido se calcula de las facturas, no depende de que este aviso salga.
    try {
      const [susc] = await getDb()
        .select({ institucionId: suscripcionesMp.institucionId })
        .from(suscripcionesMp)
        .where(eq(suscripcionesMp.suscripcionId, cobro.suscripcionId))
        .limit(1);
      if (susc) await avisarReferidorDePago(susc.institucionId);
    } catch (e) {
      console.error("No se pudo avisar el cobro a quien recomendó", resumenDeError(e));
    }
  }
  return resultado;
}

async function aplicarCobroEnLaBase(cobro: CobroLeido): Promise<ResultadoDeCobro> {
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
        // El mail sale una sola vez por cobro (la clave lleva su número): los reintentos avisan en la campanita.
        await correoDeCobroRechazado(tx, {
          usuarioIds: await destinatariosDeFacturacion(tx, inst.id),
          institucion: inst.nombre,
          periodo,
          monto,
          cobroId: cobro.id,
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

    // Si ese mes está bonificado por recomendar, se anota para devolverlo a mano y el aviso es otro (ver src/lib/bonificacion.ts).
    const bonificado = await gastarMesEnCobro(tx, { institucionId: inst.id, institucion: inst.nombre, periodo, cobroId: cobro.id, monto, pagoId: cobro.pagoId });
    if (!bonificado) {
      await avisarAVarios(tx, await destinatariosDeInstitucion(tx, inst.id), {
        tipo: "sistema",
        titulo: "UNIDOAR",
        texto: `recibimos tu débito automático de ${etiquetaPeriodo(periodo)} (${pesos(monto)}). ¡Gracias!`,
        enlace: "/institucion/plan",
      });
    }
    await correoDePagoRegistrado(tx, {
      usuarioIds: await destinatariosDeFacturacion(tx, inst.id),
      institucion: inst.nombre,
      periodo,
      monto,
    });
    return "aprobado";
  });
}
