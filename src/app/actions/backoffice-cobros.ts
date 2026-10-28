"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { getDb, transaccion } from "@/db";
import { auditoria, facturas, instituciones, solicitudesPlan } from "@/db/schema";
import { fallo, ok, parsear, type Resultado } from "@/lib/acciones";
import { registrarAuditoria } from "@/lib/auditoria";
import { requerirUsuario } from "@/lib/auth";
import { esUuid } from "@/lib/busquedas";
import {
  anulacionSchema,
  aprobacionSchema,
  errorDeFechaDePago,
  errorDeInicioDeSemestre,
  esClavePlan,
  etiquetaPeriodo,
  facturaNuevaSchema,
  fechaCobroDelPeriodo,
  fechaDeColumna,
  hoyAR,
  pagoEfectivoSchema,
  pagoHastaDeMes,
  pagoSchema,
  periodoActual,
  rechazoSchema,
  semestreSchema,
  situacionDelMes,
  sumarMeses,
  type FacturaNueva,
  type PagoEfectivo,
  type SemestreAlContado,
} from "@/lib/cobros";
import { correoDeFacturaNueva, correoDePagoAnulado, correoDePagoRegistrado, correoDeResolucionDePlan } from "@/lib/correo/eventos";
import { avisoDeCobroEnMesBonificado } from "@/lib/bonificacion";
import { suscripcionVigente } from "@/lib/debito-automatico";
import { pesos } from "@/lib/planes";
import { liberarMeses, mesesBonificadosSinCobro } from "@/lib/queries/bonificaciones";
import type { Ejecutor } from "@/lib/queries/pipeline";
import { acuerdoDe } from "@/lib/queries/acuerdos";
import { planes, planesParaCobrarOFallar, SIN_PRECIOS } from "@/lib/queries/planes";
import { facturasDelSemestre, impedimentoDeSemestre, INSTITUCION_NO_ENCONTRADA, registrarSemestre, SIN_CONVENIO } from "@/lib/queries/semestre";
import { suscripcionDe } from "@/lib/queries/suscripcion";
import { cancelarSuscripcion } from "@/lib/queries/suscripcion-cancelar";
import { cantidadDeSedes } from "@/lib/queries/sedes";
import { avisarAVarios } from "@/lib/queries/avisos";
import { avisarReferidorDePago } from "@/lib/queries/referidos";
import {
  aplicarPlanAlPeriodoActual,
  facturasPendientesVencidas,
  type ResultadoFacturaDelPeriodo,
} from "@/lib/queries/backoffice-cobros";
import { destinatariosDeFacturacion, destinatariosDeInstitucion } from "@/lib/queries/backoffice-instituciones";
import { resumenDeError } from "@/lib/errores";

/*
 * Cobros del backoffice. Todavía no hay pasarela de pago: el equipo registra los pagos y carga las facturas
 * a mano. Cada acción exige rol admin, relee la fila dentro de la transacción y deja auditoría.
 */

const FACTURA_NO_ENCONTRADA = "No encontramos esa factura.";
const PEDIDO_NO_ENCONTRADO = "No encontramos ese pedido.";
const PEDIDO_ATENDIDO = "Ese pedido ya fue atendido por otra persona del equipo.";
const SOLO_POR_BUSQUEDA = "La búsqueda puntual no tiene factura mensual: se paga cada búsqueda desde «Registrar pago de búsqueda puntual».";

function revalidarCobros(institucionId?: string) {
  revalidatePath("/backoffice/cobros");
  if (institucionId) {
    revalidatePath(`/backoffice/cobros/${institucionId}`);
    revalidatePath(`/backoffice/cobros/${institucionId}/resumen`);
    revalidatePath(`/backoffice/instituciones/${institucionId}`);
  }
  revalidatePath("/backoffice/instituciones");
  revalidatePath("/institucion/plan");
}

/* ───────────────────────────── Facturas ───────────────────────────── */

/**
 * Registra el pago de una factura (pasa a "pagada") y le avisa a la institución. `fecha` es cuándo llegó el pago
 * ("2026-10-03"); sin ella, o si es hoy, se toma el momento del registro.
 */
export async function registrarPago(facturaId: string, medio: string, fecha?: string): Promise<Resultado> {
  const admin = await requerirUsuario("admin");
  if (!esUuid(facturaId)) return fallo(FACTURA_NO_ENCONTRADA);
  const datos = parsear(pagoSchema, { medio, fecha });
  if (!datos.ok) return fallo(datos.campos?.medio ?? datos.campos?.fecha ?? datos.error, datos.campos);

  const hoy = hoyAR();
  const errorFecha = datos.data.fecha ? errorDeFechaDePago(datos.data.fecha, hoy) : null;
  if (errorFecha) return fallo(errorFecha, { fecha: errorFecha });
  // Un pago de otro día se guarda al mediodía UTC de ese día (la misma fecha en Argentina); el de hoy, con su hora real.
  const diaDelPago = datos.data.fecha ?? hoy;
  const pagadaEn = diaDelPago === hoy ? new Date() : new Date(`${diaDelPago}T12:00:00Z`);

  let institucionId: string | undefined;
  const resultado = await transaccion(async (tx) => {
    const [factura] = await tx.select().from(facturas).where(eq(facturas.id, facturaId)).limit(1).for("update");
    if (!factura) return fallo(FACTURA_NO_ENCONTRADA);
    institucionId = factura.institucionId;
    if (factura.estado === "pagada") return fallo("Esa factura ya figura como paga.");

    await tx
      .update(facturas)
      .set({ estado: "pagada", pagadaEn, medio: datos.data.medio })
      .where(eq(facturas.id, factura.id));
    await registrarAuditoria(
      {
        usuarioId: admin.id,
        accion: "factura.pagar",
        entidad: "factura",
        entidadId: factura.id,
        detalle: {
          institucionId: factura.institucionId,
          periodo: factura.periodo,
          monto: factura.monto,
          medio: datos.data.medio,
          fechaPago: diaDelPago,
          // Para poder dejar la factura como estaba si después se anula el pago.
          medioAnterior: factura.medio,
          estadoAnterior: factura.estado,
        },
      },
      tx,
    );
    await avisarAVarios(tx, await destinatariosDeInstitucion(tx, factura.institucionId), {
      tipo: "sistema",
      titulo: "UNIDOAR",
      texto:
        diaDelPago === hoy
          ? `registró tu pago de ${etiquetaPeriodo(factura.periodo)} (${pesos(factura.monto)}). ¡Gracias!`
          : `registró tu pago de ${etiquetaPeriodo(factura.periodo)} (${pesos(factura.monto)}), recibido el ${fechaDeColumna(diaDelPago)}. ¡Gracias!`,
      enlace: "/institucion/plan",
    });
    const [dueña] = await tx.select({ nombre: instituciones.nombre }).from(instituciones).where(eq(instituciones.id, factura.institucionId)).limit(1);
    await correoDePagoRegistrado(tx, {
      usuarioIds: await destinatariosDeFacturacion(tx, factura.institucionId),
      institucion: dueña?.nombre ?? "tu institución",
      periodo: factura.periodo,
      monto: factura.monto,
      // El mail lleva el comprobante de esta factura (ya marcada paga en esta misma transacción).
      facturaId: factura.id,
    });
    return ok();
  });

  if (resultado.ok) {
    revalidarCobros(institucionId);
    // Si la institución fue recomendada por otra y esta es su primera factura paga, se avisa (nunca frena el pago).
    if (institucionId) await avisarReferidorDePago(institucionId);
  }
  return resultado;
}

/**
 * Registra un pago en efectivo en un solo paso. Si el mes ya tiene una factura impaga, el pago se registra sobre ella (con su
 * monto); si no la tiene, se crea la factura ya paga con el monto del plan elegido (nunca uno que mande el cliente). Un mes
 * que ya figura como pago se rechaza. Queda en la auditoría como `factura.pagar` (con la nota, si hay), así "Anular pago" funciona igual,
 * y puede avisarle a la institución como cualquier otro pago registrado.
 */
export async function registrarPagoEnEfectivo(institucionId: string, entrada: PagoEfectivo): Promise<Resultado<{ id: string }>> {
  const admin = await requerirUsuario("admin");
  if (!esUuid(institucionId)) return fallo(INSTITUCION_NO_ENCONTRADA);
  const datos = parsear(pagoEfectivoSchema, typeof entrada === "object" && entrada !== null ? entrada : {});
  if (!datos.ok) return fallo(Object.values(datos.campos ?? {})[0] ?? datos.error, datos.campos);
  const { periodo, plan, fecha, nota, avisar, cobrarMesBonificado } = datos.data;
  const P = await planesParaCobrarOFallar();
  if (!P) return fallo(SIN_PRECIOS);
  if (P.esPuntual(plan)) return fallo(SOLO_POR_BUSQUEDA, { plan: SOLO_POR_BUSQUEDA });

  const hoy = hoyAR();
  const errorFecha = errorDeFechaDePago(fecha, hoy);
  if (errorFecha) return fallo(errorFecha, { fecha: errorFecha });
  // Un pago de otro día se guarda al mediodía UTC de ese día (la misma fecha en Argentina); el de hoy, con su hora real.
  const pagadaEn = fecha === hoy ? new Date() : new Date(`${fecha}T12:00:00Z`);
  const MEDIO = "Efectivo";

  try {
    const resultado = await transaccion(async (tx) => {
      const [inst] = await tx
        .select({ id: instituciones.id, nombre: instituciones.nombre, diaCobro: instituciones.diaCobro })
        .from(instituciones)
        .where(eq(instituciones.id, institucionId))
        .limit(1)
        .for("update");
      if (!inst) return fallo(INSTITUCION_NO_ENCONTRADA);

      const [existente] = await tx
        .select()
        .from(facturas)
        .where(and(eq(facturas.institucionId, institucionId), eq(facturas.periodo, periodo)))
        .limit(1)
        .for("update");
      if (situacionDelMes(existente) === "pagada") {
        return fallo(`${etiquetaPeriodo(periodo)} ya figura como pago.`, { periodo: "Ese mes ya está pago" });
      }
      // Un mes cubierto por un semestre pago no tiene factura propia: registrarle otro pago sería cobrarlo dos veces.
      const cubierto = existente ? null : await mensajeSiCubiertoPorSemestre(tx, institucionId, periodo);
      if (cubierto) return fallo(cubierto, { periodo: cubierto });
      // Un mes bonificado por recomendar no se paga: cobrarlo exige confirmarlo, y el mes bonificado vuelve a quedar disponible (se libera abajo).
      const bonificados = await mesesBonificadosSinCobro(tx, institucionId, [periodo]);
      if (bonificados.length > 0 && !cobrarMesBonificado) {
        const aviso = avisoDeCobroEnMesBonificado(bonificados.map(etiquetaPeriodo), "pago");
        return fallo(aviso, { periodo: aviso });
      }

      let facturaId: string;
      let monto: number;
      if (existente) {
        facturaId = existente.id;
        monto = existente.monto;
        await tx.update(facturas).set({ estado: "pagada", pagadaEn, medio: MEDIO }).where(eq(facturas.id, existente.id));
      } else {
        const acuerdoDelPlan = await acuerdoParaPlan(tx, institucionId, plan);
        if (!P.precioDefinido(plan, acuerdoDelPlan)) return fallo(SIN_CONVENIO, { plan: SIN_CONVENIO });
        monto = P.montoDePlan(plan, (await cantidadDeSedes(tx, [institucionId])).get(institucionId) ?? 1, acuerdoDelPlan);
        const [nueva] = await tx
          .insert(facturas)
          .values({ institucionId, plan, monto, periodo, fechaCobro: fechaCobroDelPeriodo(periodo, inst.diaCobro), estado: "pagada", pagadaEn, medio: MEDIO })
          .returning({ id: facturas.id });
        facturaId = nueva!.id;
      }
      const liberados = await liberarMeses(tx, institucionId, bonificados);

      await registrarAuditoria(
        {
          usuarioId: admin.id,
          accion: "factura.pagar",
          entidad: "factura",
          entidadId: facturaId,
          detalle: {
            institucionId,
            periodo,
            monto,
            ...(liberados > 0 ? { mesBonificadoLiberado: true } : {}),
            medio: MEDIO,
            fechaPago: fecha,
            ...(nota ? { nota } : {}),
            // Para poder dejar la factura como estaba si después se anula el pago (una factura creada con el pago no tenía medio ni estado).
            medioAnterior: existente?.medio ?? null,
            estadoAnterior: existente?.estado ?? null,
            facturaCreadaConElPago: !existente,
            avisoALaInstitucion: avisar,
          },
        },
        tx,
      );
      if (avisar) {
        await avisarAVarios(tx, await destinatariosDeInstitucion(tx, institucionId), {
          tipo: "sistema",
          titulo: "UNIDOAR",
          texto:
            fecha === hoy
              ? `registró tu pago de ${etiquetaPeriodo(periodo)} (${pesos(monto)}). ¡Gracias!`
              : `registró tu pago de ${etiquetaPeriodo(periodo)} (${pesos(monto)}), recibido el ${fechaDeColumna(fecha)}. ¡Gracias!`,
          enlace: "/institucion/plan",
        });
        await correoDePagoRegistrado(tx, {
          usuarioIds: await destinatariosDeFacturacion(tx, institucionId),
          institucion: inst.nombre,
          periodo,
          monto,
          facturaId,
        });
      }
      return ok({ id: facturaId });
    });
    if (resultado.ok) {
      revalidarCobros(institucionId);
      await avisarReferidorDePago(institucionId);
    }
    return resultado;
  } catch (e) {
    // El índice único (institución, período) es la red de seguridad si dos personas cargan el mismo mes a la vez.
    const codigo = (e as { code?: string; cause?: { code?: string } }).code ?? (e as { cause?: { code?: string } }).cause?.code;
    if (codigo === "23505") return fallo(`Ya hay una factura de ${etiquetaPeriodo(periodo)} para esta institución.`, { periodo: "Ese mes ya tiene factura" });
    console.error("No se pudo registrar el pago en efectivo", resumenDeError(e));
    return fallo("No pudimos registrar el pago. Probá de nuevo.");
  }
}

/**
 * El precio acordado de la institución, SOLO si se factura con su plan: un abono acordado es sobre su plan, y aplicado a otro (por ejemplo la
 * búsqueda puntual) daría un monto sin sentido. Con otro plan, ese plan va a su precio de lista.
 */
async function acuerdoParaPlan(ejecutor: Ejecutor, institucionId: string, plan: string) {
  const [inst] = await ejecutor.select({ plan: instituciones.plan }).from(instituciones).where(eq(instituciones.id, institucionId)).limit(1);
  return inst && inst.plan === plan ? acuerdoDe(ejecutor, institucionId) : null;
}

/** Si un semestre pago ya cubre el mes (que por eso no tiene factura propia), el mensaje para no cobrarlo dos veces; null si no. */
async function mensajeSiCubiertoPorSemestre(ejecutor: Ejecutor, institucionId: string, periodo: string) {
  const semestres = await ejecutor
    .select({ periodo: facturas.periodo, estado: facturas.estado, mesesCubiertos: facturas.mesesCubiertos })
    .from(facturas)
    .where(and(eq(facturas.institucionId, institucionId), gte(facturas.mesesCubiertos, 2), gte(facturas.periodo, sumarMeses(periodo, -11)), lte(facturas.periodo, periodo)));
  const hasta = pagoHastaDeMes(periodo, semestres);
  return hasta ? `${etiquetaPeriodo(periodo)} ya está cubierto por un semestre pago hasta ${etiquetaPeriodo(hasta).toLowerCase()}.` : null;
}

/**
 * Registra un semestre pagado al contado, en efectivo o por transferencia: la institución abona por adelantado los meses del pack (pagás 5,
 * usás 6) y queda UNA factura paga que los cubre desde el mes de inicio (`facturas.meses_cubiertos`): el cron no genera las de los meses
 * siguientes y el débito automático no se puede activar hasta que termine. El monto sale del plan, las sedes y el pack del catálogo (nunca del
 * cliente). Si el mes de inicio ya tenía una factura impaga, se convierte en la del semestre. Si la institución tiene un débito automático vivo,
 * se cancela ANTES (Mercado Pago primero: si no responde, no se registra nada): si no, le cobraría meses que ya pagó.
 */
export async function registrarSemestreAlContado(institucionId: string, entrada: SemestreAlContado): Promise<Resultado<{ id: string }>> {
  const admin = await requerirUsuario("admin");
  if (!esUuid(institucionId)) return fallo(INSTITUCION_NO_ENCONTRADA);
  const datos = parsear(semestreSchema, typeof entrada === "object" && entrada !== null ? entrada : {});
  if (!datos.ok) return fallo(Object.values(datos.campos ?? {})[0] ?? datos.error, datos.campos);
  const { periodo, medio, fecha, nota, avisar, cancelarDebito, cobrarMesesBonificados } = datos.data;

  const hoy = hoyAR();
  const errorFecha = errorDeFechaDePago(fecha, hoy);
  if (errorFecha) return fallo(errorFecha, { fecha: errorFecha });
  const errorInicio = errorDeInicioDeSemestre(periodo, periodoActual());
  if (errorInicio) return fallo(errorInicio, { periodo: errorInicio });
  // Un pago de otro día se guarda al mediodía UTC de ese día (la misma fecha en Argentina); el de hoy, con su hora real.
  const pagadaEn = fecha === hoy ? new Date() : new Date(`${fecha}T12:00:00Z`);
  const P = await planesParaCobrarOFallar();
  if (!P) return fallo(SIN_PRECIOS);
  const { meses } = P.condiciones.pack;
  // Los meses que cubre el semestre: si alguno es un mes bonificado por recomendar (la institución no lo paga), hay que confirmarlo.
  const ventana = Array.from({ length: meses }, (_, k) => sumarMeses(periodo, k));

  // Antes de tocar nada (ni cancelar un débito) se mira que el semestre se pueda registrar; la transacción lo vuelve a mirar.
  const [previa] = await getDb().select({ plan: instituciones.plan }).from(instituciones).where(eq(instituciones.id, institucionId)).limit(1);
  if (!previa) return fallo(INSTITUCION_NO_ENCONTRADA);
  const impedimento = impedimentoDeSemestre(P, previa.plan, periodo, meses, await facturasDelSemestre(getDb(), institucionId, periodo, meses));
  if (impedimento) return fallo(impedimento.error, impedimento.campos);
  if (!P.precioDefinido(previa.plan, await acuerdoDe(getDb(), institucionId))) return fallo(SIN_CONVENIO);
  const bonificadosAntes = await mesesBonificadosSinCobro(getDb(), institucionId, ventana);
  if (bonificadosAntes.length > 0 && !cobrarMesesBonificados) {
    const aviso = avisoDeCobroEnMesBonificado(bonificadosAntes.map(etiquetaPeriodo), "semestre");
    return fallo(aviso, { periodo: aviso });
  }

  const susc = await suscripcionDe(institucionId);
  const debitoVivo = !!susc && suscripcionVigente(susc.estado);
  if (debitoVivo && !cancelarDebito) {
    const error = "Tiene el débito automático activo: cancelalo junto con el registro (casilla de abajo) para que Mercado Pago no le cobre meses que ya pagó.";
    return fallo(error, { cancelarDebito: error });
  }
  if (debitoVivo) {
    const cancelacion = await cancelarSuscripcion(institucionId, { usuarioId: admin.id, motivo: "semestre" });
    if (!cancelacion.ok) return fallo(cancelacion.error);
  }

  try {
    const resultado = await transaccion(async (tx) => {
      // Las reglas del registro (meses ya pagos, facturas impagas, meses bonificados, monto, factura, auditoría y avisos) viven en `registrarSemestre`:
      // las comparte con el pago único por Mercado Pago.
      const r = await registrarSemestre(tx, {
        P,
        institucionId,
        periodo,
        medio,
        pagadaEn,
        fechaDelPago: fecha,
        usuarioId: admin.id,
        nota,
        avisar,
        cobrarMesesBonificados: !!cobrarMesesBonificados,
        debitoCancelado: debitoVivo,
      });
      return r.ok ? ok({ id: r.facturaId }) : fallo(r.error, r.campos);
    });
    if (resultado.ok) {
      revalidarCobros(institucionId);
      await avisarReferidorDePago(institucionId);
    }
    return resultado;
  } catch (e) {
    // El índice único (institución, período) es la red de seguridad si dos personas cargan el mismo mes a la vez.
    const codigo = (e as { code?: string; cause?: { code?: string } }).code ?? (e as { cause?: { code?: string } }).cause?.code;
    if (codigo === "23505") return fallo(`Ya hay una factura de ${etiquetaPeriodo(periodo)} para esta institución.`, { periodo: "Ese mes ya tiene factura" });
    console.error("No se pudo registrar el semestre al contado", resumenDeError(e));
    return fallo("No pudimos registrar el pago. Probá de nuevo.");
  }
}

/**
 * Anula el registro de un pago y deja la factura como estaba ANTES de ese pago:
 *  - si el pago creó la factura (no existía), la factura se elimina, así no queda una impaga de un mes que nunca se facturó;
 *  - si era un semestre que convirtió una factura impaga, vuelve a ser la de un solo mes, con su monto de antes;
 *  - si no, la factura vuelve a figurar como impaga (vencida si ya pasó su fecha) y se borran la fecha y el medio del pago.
 * Pide un motivo, que queda en la auditoría, y puede avisarle a la institución, que había recibido "registró tu pago".
 */
export async function anularPago(facturaId: string, entrada: { motivo: string; avisar: boolean }): Promise<Resultado<{ eliminada: boolean }>> {
  const admin = await requerirUsuario("admin");
  if (!esUuid(facturaId)) return fallo(FACTURA_NO_ENCONTRADA);
  const datos = parsear(anulacionSchema, entrada);
  if (!datos.ok) return fallo(datos.campos?.motivo ?? datos.error, datos.campos);
  // Con los precios vigentes: un pago de semestre anulado en una impaga de antes sin su monto guardado se recalcula con ellos.
  const P = await planesParaCobrarOFallar();
  if (!P) return fallo(SIN_PRECIOS);

  let institucionId: string | undefined;
  const resultado = await transaccion(async (tx) => {
    const [factura] = await tx.select().from(facturas).where(eq(facturas.id, facturaId)).limit(1).for("update");
    if (!factura) return fallo(FACTURA_NO_ENCONTRADA);
    institucionId = factura.institucionId;
    if (factura.estado !== "pagada") return fallo("Esa factura no figura como paga.");

    // El medio que tenía antes del pago está en la auditoría; si no (factura cargada ya paga), el habitual de la institución.
    const [registro] = await tx
      .select({ detalle: auditoria.detalle })
      .from(auditoria)
      .where(and(eq(auditoria.entidad, "factura"), eq(auditoria.entidadId, factura.id), eq(auditoria.accion, "factura.pagar")))
      .orderBy(desc(auditoria.creadoEn))
      .limit(1);
    const previo = (registro?.detalle ?? null) as { medioAnterior?: unknown; facturaCreadaConElPago?: unknown; montoAnterior?: unknown; periodoBonificado?: unknown } | null;
    const [institucion] = await tx
      .select({ medioPago: instituciones.medioPago })
      .from(instituciones)
      .where(eq(instituciones.id, factura.institucionId))
      .limit(1);
    const medio = typeof previo?.medioAnterior === "string" ? previo.medioAnterior : (institucion?.medioPago ?? null);

    // Dejar la factura como estaba antes del pago: si el pago la creó, se elimina; si era un semestre sobre una impaga, vuelve a ser la de un mes.
    const eliminada = previo?.facturaCreadaConElPago === true;
    const volvioAUnMes = !eliminada && factura.mesesCubiertos > 1;
    if (eliminada) {
      await tx.delete(facturas).where(eq(facturas.id, factura.id));
    } else if (volvioAUnMes) {
      const sedes = (await cantidadDeSedes(tx, [factura.institucionId])).get(factura.institucionId) ?? 1;
      const mensual =
        typeof previo?.montoAnterior === "number"
          ? previo.montoAnterior
          : P.montoDePlan(factura.plan, sedes, await acuerdoParaPlan(tx, factura.institucionId, factura.plan));
      await tx.update(facturas).set({ estado: "pendiente", pagadaEn: null, medio, mesesCubiertos: 1, monto: mensual }).where(eq(facturas.id, factura.id));
    } else {
      await tx.update(facturas).set({ estado: "pendiente", pagadaEn: null, medio }).where(eq(facturas.id, factura.id));
    }
    // Si ese pago era un semestre que gastó un mes bonificado por recomendar, el mes vuelve a quedar disponible: la institución no lo pierde.
    const mesBonificadoLiberado =
      typeof previo?.periodoBonificado === "string" && (await liberarMeses(tx, factura.institucionId, [previo.periodoBonificado])) > 0;
    await registrarAuditoria(
      {
        usuarioId: admin.id,
        accion: "factura.anular_pago",
        entidad: "factura",
        entidadId: factura.id,
        detalle: {
          institucionId: factura.institucionId,
          periodo: factura.periodo,
          monto: factura.monto,
          motivo: datos.data.motivo,
          medioDelPago: factura.medio,
          pagadaEn: factura.pagadaEn?.toISOString() ?? null,
          avisoALaInstitucion: datos.data.avisar,
          ...(eliminada ? { facturaEliminada: true } : {}),
          ...(volvioAUnMes ? { volvioAUnMes: true, mesesCubiertos: factura.mesesCubiertos } : {}),
          ...(mesBonificadoLiberado ? { mesBonificadoLiberado: true } : {}),
        },
      },
      tx,
    );
    if (datos.data.avisar) {
      await avisarAVarios(tx, await destinatariosDeInstitucion(tx, factura.institucionId), {
        tipo: "sistema",
        titulo: "UNIDOAR",
        texto: eliminada
          ? `corrigió el registro de tu pago de ${etiquetaPeriodo(factura.periodo)}: quedó sin efecto.`
          : `corrigió el registro de tu pago de ${etiquetaPeriodo(factura.periodo)}: figura otra vez como pendiente.`,
        enlace: "/institucion/plan",
      });
      const [dueña] = await tx.select({ nombre: instituciones.nombre }).from(instituciones).where(eq(instituciones.id, factura.institucionId)).limit(1);
      await correoDePagoAnulado(tx, {
        usuarioIds: await destinatariosDeFacturacion(tx, factura.institucionId),
        institucion: dueña?.nombre ?? "tu institución",
        periodo: factura.periodo,
        monto: factura.monto,
      });
    }
    return ok({ eliminada });
  });

  if (resultado.ok) revalidarCobros(institucionId);
  return resultado;
}

/**
 * Carga la factura de un mes. El monto sale del plan elegido (no se acepta uno del cliente) y queda pendiente:
 * si la fecha de cobro ya pasó, se ve como vencida.
 */
export async function cargarFactura(institucionId: string, entrada: FacturaNueva): Promise<Resultado<{ id: string }>> {
  const admin = await requerirUsuario("admin");
  if (!esUuid(institucionId)) return fallo(INSTITUCION_NO_ENCONTRADA);
  const datos = parsear(facturaNuevaSchema, entrada);
  if (!datos.ok) return fallo(Object.values(datos.campos ?? {})[0] ?? datos.error, datos.campos);
  const { periodo, plan, fechaCobro, medio } = datos.data;
  // En un plan por sede (Multisede) el monto es el precio de una sede por las sedes que tiene la institución.
  const P = await planesParaCobrarOFallar();
  if (!P) return fallo(SIN_PRECIOS);
  if (P.esPuntual(plan)) return fallo(SOLO_POR_BUSQUEDA, { plan: SOLO_POR_BUSQUEDA });
  const acuerdoDelPlan = await acuerdoParaPlan(getDb(), institucionId, plan);
  if (!P.precioDefinido(plan, acuerdoDelPlan)) return fallo(SIN_CONVENIO, { plan: SIN_CONVENIO });
  const monto = P.montoDePlan(plan, (await cantidadDeSedes(getDb(), [institucionId])).get(institucionId) ?? 1, acuerdoDelPlan);

  try {
    const resultado = await transaccion(async (tx) => {
      const [inst] = await tx
        .select({ id: instituciones.id, nombre: instituciones.nombre, medioPago: instituciones.medioPago })
        .from(instituciones)
        .where(eq(instituciones.id, institucionId))
        .limit(1)
        .for("update");
      if (!inst) return fallo(INSTITUCION_NO_ENCONTRADA);

      const [repetida] = await tx
        .select({ id: facturas.id })
        .from(facturas)
        .where(and(eq(facturas.institucionId, institucionId), eq(facturas.periodo, periodo)))
        .limit(1);
      if (repetida) {
        return fallo(`Ya hay una factura de ${etiquetaPeriodo(periodo)} para esta institución.`, {
          periodo: "Ese mes ya tiene factura",
        });
      }
      const cubierto = await mensajeSiCubiertoPorSemestre(tx, institucionId, periodo);
      if (cubierto) return fallo(cubierto, { periodo: cubierto });

      const [nueva] = await tx
        .insert(facturas)
        .values({
          institucionId,
          plan,
          monto,
          periodo,
          fechaCobro,
          estado: "pendiente",
          medio: medio ?? inst.medioPago,
        })
        .returning({ id: facturas.id });
      await registrarAuditoria(
        {
          usuarioId: admin.id,
          accion: "factura.crear",
          entidad: "factura",
          entidadId: nueva!.id,
          detalle: { institucionId, periodo, plan, monto, fechaCobro },
        },
        tx,
      );
      await correoDeFacturaNueva(tx, {
        usuarioIds: await destinatariosDeFacturacion(tx, institucionId),
        facturaId: nueva!.id,
        institucion: inst.nombre,
        periodo,
        monto,
        fechaCobro,
      });
      return ok({ id: nueva!.id });
    });
    if (resultado.ok) revalidarCobros(institucionId);
    return resultado;
  } catch (e) {
    // El índice único (institución, período) es la red de seguridad si dos personas cargan el mismo mes a la vez.
    const codigo = (e as { code?: string; cause?: { code?: string } }).code ?? (e as { cause?: { code?: string } }).cause?.code;
    if (codigo === "23505") return fallo(`Ya hay una factura de ${etiquetaPeriodo(periodo)} para esta institución.`, { periodo: "Ese mes ya tiene factura" });
    console.error("No se pudo cargar la factura", resumenDeError(e));
    return fallo("No pudimos cargar la factura. Probá de nuevo.");
  }
}

/**
 * Guarda como "vencida" toda factura pendiente cuya fecha ya pasó. La pantalla de cobros ya las muestra como
 * vencidas al leer; esto alinea el dato guardado, que es el que ve la institución en su plan.
 */
export async function marcarFacturasVencidas(): Promise<Resultado<{ cantidad: number }>> {
  const admin = await requerirUsuario("admin");

  const resultado = await transaccion(async (tx) => {
    const vencidas = await facturasPendientesVencidas(tx);
    if (vencidas.length === 0) return ok({ cantidad: 0, institucionIds: [] as string[] });
    await tx
      .update(facturas)
      .set({ estado: "vencida" })
      .where(
        and(
          eq(facturas.estado, "pendiente"),
          inArray(
            facturas.id,
            vencidas.map((f) => f.id),
          ),
        ),
      );
    for (const f of vencidas) {
      await registrarAuditoria(
        {
          usuarioId: admin.id,
          accion: "factura.marcar_vencida",
          entidad: "factura",
          entidadId: f.id,
          detalle: { institucionId: f.institucionId, periodo: f.periodo, monto: f.monto, fechaCobro: f.fechaCobro },
        },
        tx,
      );
    }
    return ok({ cantidad: vencidas.length, institucionIds: [...new Set(vencidas.map((f) => f.institucionId))] });
  });

  if (resultado.ok) {
    revalidarCobros();
    for (const id of resultado.data.institucionIds) revalidarCobros(id);
  }
  return resultado.ok ? ok({ cantidad: resultado.data.cantidad }) : resultado;
}

/* ───────────────────────────── Pedidos de cambio de plan ───────────────────────────── */

type DataAprobacion = { factura: ResultadoFacturaDelPeriodo };

function textoDeFactura(r: ResultadoFacturaDelPeriodo) {
  if (r.resultado === "creada") return ` Cargamos tu factura de ${etiquetaPeriodo(r.periodo).toLowerCase()} (${pesos(r.monto)}).`;
  if (r.resultado === "actualizada") {
    return ` Actualizamos tu factura de ${etiquetaPeriodo(r.periodo).toLowerCase()} al nuevo plan (${pesos(r.monto)}).`;
  }
  if (r.motivo === "pagada") return " Tu factura de este mes ya estaba paga: el nuevo plan se cobra desde el próximo período.";
  if (r.motivo === "cubierta_por_semestre") return " Tu semestre pago ya cubre este mes: no hay nada para pagar ahora.";
  if (r.motivo === "bonificada") return " Este mes es un mes bonificado por recomendar a otra institución: no se te factura.";
  if (r.motivo === "sin_convenio") return " El valor de tu plan lo acordamos según el volumen: el equipo te pasa la propuesta antes de facturar nada.";
  return " Tu plan es de búsqueda puntual: no tiene abono mensual, se paga cada búsqueda.";
}

/**
 * Aprueba un pedido: actualiza `instituciones.plan`, deja la factura del mes en curso con el nuevo plan
 * (la crea o ajusta la impaga; ver `aplicarPlanAlPeriodoActual`) y avisa. Todo en una transacción.
 */
export async function aprobarPedidoDePlan(pedidoId: string, nota?: string): Promise<Resultado<DataAprobacion>> {
  const admin = await requerirUsuario("admin");
  if (!esUuid(pedidoId)) return fallo(PEDIDO_NO_ENCONTRADO);
  const datos = parsear(aprobacionSchema, { nota });
  if (!datos.ok) return fallo(datos.campos?.nota ?? datos.error, datos.campos);

  const P = await planesParaCobrarOFallar();
  if (!P) return fallo(SIN_PRECIOS);
  let institucionId: string | undefined;
  const resultado = await transaccion(async (tx) => {
    const [pedido] = await tx.select().from(solicitudesPlan).where(eq(solicitudesPlan.id, pedidoId)).limit(1).for("update");
    if (!pedido) return fallo(PEDIDO_NO_ENCONTRADO);
    if (pedido.estado !== "pendiente") return fallo(PEDIDO_ATENDIDO);
    if (!esClavePlan(pedido.planSolicitado)) return fallo("El plan que pidió ya no existe. Rechazá el pedido.");

    const [inst] = await tx
      .select({
        id: instituciones.id,
        nombre: instituciones.nombre,
        plan: instituciones.plan,
        diaCobro: instituciones.diaCobro,
        medioPago: instituciones.medioPago,
      })
      .from(instituciones)
      .where(eq(instituciones.id, pedido.institucionId))
      .limit(1)
      .for("update");
    if (!inst) return fallo(INSTITUCION_NO_ENCONTRADA);
    institucionId = inst.id;
    const plan = pedido.planSolicitado;

    await tx.update(instituciones).set({ plan }).where(eq(instituciones.id, inst.id));
    const factura = await aplicarPlanAlPeriodoActual(tx, inst, plan, P);
    await tx
      .update(solicitudesPlan)
      .set({ estado: "aprobada", atendidaEn: new Date(), nota: datos.data.nota ?? pedido.nota })
      .where(eq(solicitudesPlan.id, pedido.id));
    await registrarAuditoria(
      {
        usuarioId: admin.id,
        accion: "plan.aprobar",
        entidad: "institucion",
        entidadId: inst.id,
        detalle: {
          institucionId: inst.id,
          nombre: inst.nombre,
          pedidoId: pedido.id,
          de: inst.plan,
          a: plan,
          factura,
          nota: datos.data.nota ?? null,
        },
      },
      tx,
    );
    await avisarAVarios(tx, await destinatariosDeInstitucion(tx, inst.id), {
      tipo: "sistema",
      titulo: "UNIDOAR",
      texto: `aprobó tu cambio al ${P.planDe(plan).label} (${P.precioParaLaInstitucion(plan)}).${textoDeFactura(factura)}`,
      enlace: "/institucion/plan",
    });
    await correoDeResolucionDePlan(tx, {
      usuarioIds: await destinatariosDeFacturacion(tx, inst.id),
      institucion: inst.nombre,
      plan: P.nombreDePlan(plan),
      aprobado: true,
      nota: datos.data.nota ?? null,
      detalle: textoDeFactura(factura).trim() || null,
    });
    return ok({ factura });
  });

  if (resultado.ok) revalidarCobros(institucionId);
  return resultado;
}

/** Rechaza un pedido con una nota que ve la institución; el plan no cambia. */
export async function rechazarPedidoDePlan(pedidoId: string, nota: string): Promise<Resultado> {
  const admin = await requerirUsuario("admin");
  if (!esUuid(pedidoId)) return fallo(PEDIDO_NO_ENCONTRADO);
  const datos = parsear(rechazoSchema, { nota });
  if (!datos.ok) return fallo(datos.campos?.nota ?? datos.error, datos.campos);

  const P = await planes();
  let institucionId: string | undefined;
  const resultado = await transaccion(async (tx) => {
    const [pedido] = await tx.select().from(solicitudesPlan).where(eq(solicitudesPlan.id, pedidoId)).limit(1).for("update");
    if (!pedido) return fallo(PEDIDO_NO_ENCONTRADO);
    if (pedido.estado !== "pendiente") return fallo(PEDIDO_ATENDIDO);
    institucionId = pedido.institucionId;

    await tx
      .update(solicitudesPlan)
      .set({ estado: "rechazada", atendidaEn: new Date(), nota: datos.data.nota })
      .where(eq(solicitudesPlan.id, pedido.id));
    await registrarAuditoria(
      {
        usuarioId: admin.id,
        accion: "plan.rechazar",
        entidad: "institucion",
        entidadId: pedido.institucionId,
        detalle: {
          institucionId: pedido.institucionId,
          pedidoId: pedido.id,
          planSolicitado: pedido.planSolicitado,
          nota: datos.data.nota,
          notaDelPedido: pedido.nota,
        },
      },
      tx,
    );
    const solicitado = esClavePlan(pedido.planSolicitado) ? P.planDe(pedido.planSolicitado).label : "otro plan";
    await avisarAVarios(tx, await destinatariosDeInstitucion(tx, pedido.institucionId), {
      tipo: "sistema",
      titulo: "UNIDOAR",
      texto: `no pudo aprobar tu cambio al ${solicitado}. Nota del equipo: ${datos.data.nota}`,
      enlace: "/institucion/plan",
    });
    if (esClavePlan(pedido.planSolicitado)) {
      const [dueña] = await tx.select({ nombre: instituciones.nombre }).from(instituciones).where(eq(instituciones.id, pedido.institucionId)).limit(1);
      await correoDeResolucionDePlan(tx, {
        usuarioIds: await destinatariosDeFacturacion(tx, pedido.institucionId),
        institucion: dueña?.nombre ?? "tu institución",
        plan: P.nombreDePlan(pedido.planSolicitado),
        aprobado: false,
        nota: datos.data.nota,
        detalle: null,
      });
    }
    return ok();
  });

  if (resultado.ok) revalidarCobros(institucionId);
  return resultado;
}
