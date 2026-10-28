import "server-only";
import { and, eq, gte, lte } from "drizzle-orm";
import type { Tx } from "@/db";
import { facturas, instituciones } from "@/db/schema";
import { registrarAuditoria } from "@/lib/auditoria";
import { avisoDeCobroEnMesBonificado, mesesTexto } from "@/lib/bonificacion";
import { conflictosDeSemestre, etiquetaDeCobertura, etiquetaPeriodo, fechaCobroDelPeriodo, sumarMeses, type FacturaConCobertura } from "@/lib/cobros";
import { correoDePagoRegistrado } from "@/lib/correo/eventos";
import { esClavePlan, pesos, type Planes } from "@/lib/planes";
import { acuerdoDe } from "@/lib/queries/acuerdos";
import { avisarAVarios } from "@/lib/queries/avisos";
import { destinatariosDeFacturacion, destinatariosDeInstitucion } from "@/lib/queries/backoffice-instituciones";
import { liberarMeses, mesesBonificadosSinCobro, tomarMesParaSemestre } from "@/lib/queries/bonificaciones";
import type { Ejecutor } from "@/lib/queries/pipeline";
import { cantidadDeSedes } from "@/lib/queries/sedes";

/*
 * El registro de un semestre pagado por adelantado (pagás 5, usás 6): UNA factura paga que cubre los meses desde el de inicio. Lo usan el equipo
 * (al cargar un pago en efectivo o por transferencia, `registrarSemestreAlContado`) y Mercado Pago (cuando se aprueba el pago único, ver
 * `src/lib/queries/pago-semestre.ts`): las dos cosas pasan por acá para que las reglas sean una sola.
 */

export const INSTITUCION_NO_ENCONTRADA = "No encontramos esa institución.";

export const SIN_CONVENIO =
  "El plan Multisede se acuerda según el volumen y esta institución todavía no tiene su convenio: cargalo primero en «Precio» (Acordar un precio, convenio a medida) para poder facturar.";

/** Las facturas de la institución que importan para un semestre: las de la ventana y las anteriores que podrían llegar a cubrirla. */
export async function facturasDelSemestre(ejecutor: Ejecutor, institucionId: string, periodo: string, meses: number) {
  return ejecutor
    .select({ id: facturas.id, periodo: facturas.periodo, estado: facturas.estado, mesesCubiertos: facturas.mesesCubiertos, monto: facturas.monto })
    .from(facturas)
    .where(and(eq(facturas.institucionId, institucionId), gte(facturas.periodo, sumarMeses(periodo, -11)), lte(facturas.periodo, sumarMeses(periodo, meses - 1))));
}

/** Qué impide registrar el semestre (null si se puede): un plan que no es mensual, meses ya pagos o facturas sin pagar adentro. */
export function impedimentoDeSemestre(P: Planes, plan: string, periodo: string, meses: number, cercanas: FacturaConCobertura[]) {
  if (!esClavePlan(plan) || P.planDe(plan).periodo !== "mes") {
    return { error: "El semestre al contado es para planes con abono mensual: el plan de esta institución no lo tiene (se paga por adelantado o por búsqueda)." };
  }
  const { pagos, impagas } = conflictosDeSemestre(periodo, meses, cercanas);
  const lista = (ps: string[]) => ps.map(etiquetaPeriodo).join(", ");
  if (pagos.length > 0) {
    const error = `${lista(pagos)} ya ${pagos.length === 1 ? "figura" : "figuran"} como pago: elegí otro mes para que empiece el semestre.`;
    return { error, campos: { periodo: error } };
  }
  if (impagas.length > 0) {
    const error = `Hay facturas sin pagar dentro de esos meses (${lista(impagas)}): registrales el pago o elegí otro mes de inicio.`;
    return { error, campos: { periodo: error } };
  }
  return null;
}

export type RegistroDeSemestre = {
  P: Planes;
  institucionId: string;
  /** El mes en que empieza el semestre ("AAAA-MM"). */
  periodo: string;
  /** "Transferencia", "Efectivo", "Mercado Pago"… */
  medio: string;
  pagadaEn: Date;
  /** El día del pago ("AAAA-MM-DD"), para la auditoría. */
  fechaDelPago: string;
  /** Quién lo registra; null cuando lo registra el sistema (el pago que avisó Mercado Pago). */
  usuarioId: string | null;
  nota?: string | null;
  /** Se le avisa a la institución (campanita y mail con el comprobante). */
  avisar: boolean;
  /** El equipo confirmó cobrar igual los meses bonificados por recomendar que caen adentro del semestre. */
  cobrarMesesBonificados: boolean;
  /** Se canceló el débito automático junto con este registro (lo dice el aviso a la institución). */
  debitoCancelado: boolean;
  /**
   * El monto ya está acordado (el pago único por Mercado Pago: la persona pagó el que se calculó al crear el link): se registra ese y no se vuelve
   * a calcular. `usaMesBonificado` dice si el link ya descontaba un mes bonificado por recomendar.
   */
  acordado?: { monto: number; mesesAPagar: number; usaMesBonificado: boolean };
  /** Lo que se suma al detalle de la auditoría (el origen, el número del pago…). */
  extraAuditoria?: Record<string, unknown>;
};

export type ResultadoDelRegistro =
  | { ok: false; error: string; campos?: Record<string, string> }
  | {
      ok: true;
      facturaId: string;
      monto: number;
      mesesAPagar: number;
      /** Se gastó un mes bonificado por recomendar en este semestre. */
      mesBonificado: boolean;
      /** El link ya descontaba un mes bonificado y a la hora de registrar ya no había (o el tope no lo permitía): el equipo tiene que mirarlo. */
      mesBonificadoNoDisponible: boolean;
    };

/**
 * Registra el semestre dentro de la transacción de quien llama. Bloquea la institución, vuelve a mirar que se pueda (meses ya pagos o facturas
 * impagas adentro, plan sin precio definido, meses bonificados que haya que confirmar) y, si el mes de inicio ya tenía una factura impaga, la
 * convierte en la del semestre. El monto sale del plan, las sedes, el precio acordado y el pack del catálogo; solo cuando el pago ya se hizo
 * (`acordado`) se registra el monto que se pagó. Deja la auditoría `factura.pagar` y, con `avisar`, la campanita y el mail del comprobante.
 */
export async function registrarSemestre(tx: Tx, e: RegistroDeSemestre): Promise<ResultadoDelRegistro> {
  const { P, institucionId, periodo, medio } = e;
  const { meses, mesesQueSePagan, mesesConReferido } = P.condiciones.pack;
  // Los meses que cubre el semestre: si alguno es un mes bonificado por recomendar (la institución no lo paga), hay que confirmarlo.
  const ventana = Array.from({ length: meses }, (_, k) => sumarMeses(periodo, k));

  const [inst] = await tx
    .select({ id: instituciones.id, nombre: instituciones.nombre, plan: instituciones.plan, diaCobro: instituciones.diaCobro })
    .from(instituciones)
    .where(eq(instituciones.id, institucionId))
    .limit(1)
    .for("update");
  if (!inst) return { ok: false, error: INSTITUCION_NO_ENCONTRADA };

  const cercanas = await facturasDelSemestre(tx, institucionId, periodo, meses);
  const impedido = impedimentoDeSemestre(P, inst.plan, periodo, meses, cercanas);
  if (impedido) return { ok: false, error: impedido.error, campos: impedido.campos };
  if (!P.precioDefinido(inst.plan, await acuerdoDe(tx, institucionId))) return { ok: false, error: SIN_CONVENIO };
  const bonificados = await mesesBonificadosSinCobro(tx, institucionId, ventana);
  if (bonificados.length > 0 && !e.cobrarMesesBonificados) {
    const aviso = avisoDeCobroEnMesBonificado(bonificados.map(etiquetaPeriodo), "semestre");
    return { ok: false, error: aviso, campos: { periodo: aviso } };
  }

  // Los meses bonificados que el equipo confirmó cobrar igual vuelven a quedar disponibles (antes de ver si el semestre usa uno).
  const liberados = await liberarMeses(tx, institucionId, bonificados);

  let mesBonificado: Awaited<ReturnType<typeof tomarMesParaSemestre>> = null;
  let mesesAPagar: number;
  let monto: number;
  if (e.acordado) {
    // El pago ya se hizo por lo acordado: se registra eso. Si el link descontaba un mes bonificado, se gasta ahora (queda anotado como el último
    // mes que cubre el semestre); si ya no se puede, la institución igual pagó lo acordado y el equipo lo mira.
    if (e.acordado.usaMesBonificado) mesBonificado = await tomarMesParaSemestre(tx, institucionId, sumarMeses(periodo, meses - 1));
    mesesAPagar = e.acordado.mesesAPagar;
    monto = e.acordado.monto;
  } else {
    // Un mes bonificado por recomendar (si tiene uno y el tope de 1 por semestre lo permite) se gasta acá: queda anotado como el último mes que
    // cubre el semestre y el semestre se paga un mes menos (`mesesConReferido` en lugar de `mesesQueSePagan`).
    mesBonificado = await tomarMesParaSemestre(tx, institucionId, sumarMeses(periodo, meses - 1));
    mesesAPagar = mesBonificado ? Math.min(mesesConReferido, mesesQueSePagan) : mesesQueSePagan;
    const sedes = (await cantidadDeSedes(tx, [institucionId])).get(institucionId) ?? 1;
    monto = P.montoDePlan(inst.plan, sedes, await acuerdoDe(tx, institucionId)) * mesesAPagar;
  }

  const existente = cercanas.find((f) => f.periodo === periodo);
  let facturaId: string;
  if (existente) {
    facturaId = existente.id;
    await tx.update(facturas).set({ plan: inst.plan, monto, estado: "pagada", pagadaEn: e.pagadaEn, medio, mesesCubiertos: meses }).where(eq(facturas.id, existente.id));
  } else {
    const [nueva] = await tx
      .insert(facturas)
      .values({
        institucionId,
        plan: inst.plan,
        monto,
        periodo,
        fechaCobro: fechaCobroDelPeriodo(periodo, inst.diaCobro),
        estado: "pagada",
        pagadaEn: e.pagadaEn,
        medio,
        mesesCubiertos: meses,
      })
      .returning({ id: facturas.id });
    facturaId = nueva!.id;
  }

  await registrarAuditoria(
    {
      usuarioId: e.usuarioId,
      accion: "factura.pagar",
      entidad: "factura",
      entidadId: facturaId,
      detalle: {
        institucionId,
        periodo,
        monto,
        medio,
        fechaPago: e.fechaDelPago,
        ...(e.nota ? { nota: e.nota } : {}),
        ...(liberados > 0 ? { mesesBonificadosLiberados: liberados } : {}),
        semestre: true,
        mesesCubiertos: meses,
        hasta: sumarMeses(periodo, meses - 1),
        mesesQueSePagan: mesesAPagar,
        // El mes bonificado que gastó el semestre: «Anular pago» lo suelta para que la institución no lo pierda.
        ...(mesBonificado ? { periodoBonificado: sumarMeses(periodo, meses - 1) } : {}),
        debitoCancelado: e.debitoCancelado,
        // Para poder dejar la factura como estaba si después se anula el pago (si era una impaga que se convirtió en la del semestre, con su monto de antes).
        medioAnterior: null,
        estadoAnterior: existente?.estado ?? null,
        montoAnterior: existente?.monto ?? null,
        facturaCreadaConElPago: !existente,
        avisoALaInstitucion: e.avisar,
        ...e.extraAuditoria,
      },
    },
    tx,
  );
  if (e.avisar) {
    const hasta = etiquetaPeriodo(sumarMeses(periodo, meses - 1)).toLowerCase();
    await avisarAVarios(tx, await destinatariosDeInstitucion(tx, institucionId), {
      tipo: "sistema",
      titulo: "UNIDOAR",
      texto: `registró tu pago de ${etiquetaDeCobertura(periodo, meses)} (${pesos(monto)}${mesBonificado ? `: usamos 1 mes bonificado por recomendar y pagaste ${mesesTexto(mesesAPagar)}` : ""}). Quedás cubierto hasta ${hasta}${e.debitoCancelado ? " y cancelamos tu débito automático" : ""}. ¡Gracias!`,
      enlace: "/institucion/plan",
    });
    await correoDePagoRegistrado(tx, {
      usuarioIds: await destinatariosDeFacturacion(tx, institucionId),
      institucion: inst.nombre,
      periodo,
      mesesCubiertos: meses,
      monto,
      facturaId,
    });
  }
  return {
    ok: true,
    facturaId,
    monto,
    mesesAPagar,
    mesBonificado: !!mesBonificado,
    mesBonificadoNoDisponible: !!e.acordado?.usaMesBonificado && !mesBonificado,
  };
}
