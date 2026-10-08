"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq, inArray } from "drizzle-orm";
import { transaccion } from "@/db";
import { auditoria, facturas, instituciones, solicitudesPlan } from "@/db/schema";
import { fallo, ok, parsear, type Resultado } from "@/lib/acciones";
import { registrarAuditoria } from "@/lib/auditoria";
import { requerirUsuario } from "@/lib/auth";
import { esUuid } from "@/lib/busquedas";
import {
  anulacionSchema,
  aprobacionSchema,
  errorDeFechaDePago,
  esClavePlan,
  etiquetaPeriodo,
  facturaNuevaSchema,
  fechaDeColumna,
  hoyAR,
  montoDePlan,
  pagoSchema,
  precioDePlan,
  rechazoSchema,
  type FacturaNueva,
} from "@/lib/cobros";
import { correoDeFacturaNueva, correoDePagoAnulado, correoDePagoRegistrado, correoDeResolucionDePlan } from "@/lib/correo/eventos";
import { pesos, planDe } from "@/lib/planes";
import { avisarAVarios } from "@/lib/queries/avisos";
import {
  aplicarPlanAlPeriodoActual,
  facturasPendientesVencidas,
  type ResultadoFacturaDelPeriodo,
} from "@/lib/queries/backoffice-cobros";
import { destinatariosDeFacturacion, destinatariosDeInstitucion } from "@/lib/queries/backoffice-instituciones";

/*
 * Cobros del backoffice. Todavía no hay pasarela de pago: el equipo registra los pagos y carga las facturas
 * a mano. Cada acción exige rol admin, relee la fila dentro de la transacción y deja auditoría.
 */

const FACTURA_NO_ENCONTRADA = "No encontramos esa factura.";
const INSTITUCION_NO_ENCONTRADA = "No encontramos esa institución.";
const PEDIDO_NO_ENCONTRADO = "No encontramos ese pedido.";
const PEDIDO_ATENDIDO = "Ese pedido ya fue atendido por otra persona del equipo.";

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
    });
    return ok();
  });

  if (resultado.ok) revalidarCobros(institucionId);
  return resultado;
}

/**
 * Anula el registro de un pago: la factura vuelve a figurar como impaga (vencida si ya pasó su fecha) y se borran la
 * fecha y el medio con los que se había registrado. Pide un motivo, que queda en la auditoría, y puede avisarle a la
 * institución, que había recibido "registró tu pago".
 */
export async function anularPago(facturaId: string, entrada: { motivo: string; avisar: boolean }): Promise<Resultado> {
  const admin = await requerirUsuario("admin");
  if (!esUuid(facturaId)) return fallo(FACTURA_NO_ENCONTRADA);
  const datos = parsear(anulacionSchema, entrada);
  if (!datos.ok) return fallo(datos.campos?.motivo ?? datos.error, datos.campos);

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
    const anterior = (registro?.detalle as { medioAnterior?: unknown } | null | undefined)?.medioAnterior;
    const [institucion] = await tx
      .select({ medioPago: instituciones.medioPago })
      .from(instituciones)
      .where(eq(instituciones.id, factura.institucionId))
      .limit(1);
    const medio = typeof anterior === "string" ? anterior : (institucion?.medioPago ?? null);

    await tx.update(facturas).set({ estado: "pendiente", pagadaEn: null, medio }).where(eq(facturas.id, factura.id));
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
        },
      },
      tx,
    );
    if (datos.data.avisar) {
      await avisarAVarios(tx, await destinatariosDeInstitucion(tx, factura.institucionId), {
        tipo: "sistema",
        titulo: "UNIDOAR",
        texto: `corrigió el registro de tu pago de ${etiquetaPeriodo(factura.periodo)}: figura otra vez como pendiente.`,
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
    return ok();
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
  const monto = montoDePlan(plan);

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
    console.error("No se pudo cargar la factura", e);
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
  return r.motivo === "pagada"
    ? " Tu factura de este mes ya estaba paga: el nuevo plan se cobra desde el próximo período."
    : " Tu plan anual ya cubre este mes: no hay nada para pagar ahora.";
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
    const factura = await aplicarPlanAlPeriodoActual(tx, inst, plan);
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
      texto: `aprobó tu cambio al ${planDe(plan).label} (${precioDePlan(plan)}).${textoDeFactura(factura)}`,
      enlace: "/institucion/plan",
    });
    await correoDeResolucionDePlan(tx, {
      usuarioIds: await destinatariosDeFacturacion(tx, inst.id),
      institucion: inst.nombre,
      plan,
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
    const solicitado = esClavePlan(pedido.planSolicitado) ? planDe(pedido.planSolicitado).label : "otro plan";
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
        plan: pedido.planSolicitado,
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
