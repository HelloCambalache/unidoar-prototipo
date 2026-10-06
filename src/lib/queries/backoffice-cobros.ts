import "server-only";
import { and, asc, desc, eq, gte, lte, ne, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { facturas, instituciones, solicitudesPlan, usuarios } from "@/db/schema";
import {
  anioActual,
  equivalenteMensual,
  estadoEfectivo,
  fechaCobroDelPeriodo,
  hoyAR,
  montoDePlan,
  periodoActual,
  sumarMeses,
  type EstadoCobro,
  type EstadoFactura,
} from "@/lib/cobros";
import type { PlanClave } from "@/lib/planes";
import type { EjecutorBo } from "@/lib/queries/backoffice-instituciones";

/*
 * Lecturas y reglas de cobros del backoffice. Todavía no hay pasarela de pago: las facturas las carga el
 * equipo a mano y el estado "vencida" se calcula por fecha al leer (ver `estadoEfectivo`).
 */

/* ───────────────────────────── Tabla general ───────────────────────────── */

export type FilaCobro = {
  institucionId: string;
  nombre: string;
  plan: string;
  suspendida: boolean;
  /** La factura impaga más cercana en el tiempo. */
  proximo: { periodo: string; monto: number; fechaCobro: string } | null;
  estado: EstadoCobro;
};

export type ResumenCobros = {
  /** Suma mensual equivalente de los planes de las instituciones no suspendidas (el anual cuenta como precio / 12). */
  mrr: number;
  suscripcionesActivas: number;
  vencidos: { cantidad: number; monto: number };
  /** Facturas que siguen "pendiente" en la base aunque su fecha ya pasó (las que alcanza "Marcar vencidas"). */
  sinMarcar: number;
};

export async function tablaDeCobros(): Promise<{ resumen: ResumenCobros; filas: FilaCobro[] }> {
  const db = getDb();
  const hoy = hoyAR();
  const [insts, impagas] = await Promise.all([
    db
      .select({ id: instituciones.id, nombre: instituciones.nombre, plan: instituciones.plan, suspendida: instituciones.suspendida })
      .from(instituciones)
      .orderBy(asc(instituciones.nombre)),
    db
      .select({
        institucionId: facturas.institucionId,
        periodo: facturas.periodo,
        monto: facturas.monto,
        fechaCobro: facturas.fechaCobro,
        estado: facturas.estado,
      })
      .from(facturas)
      .where(ne(facturas.estado, "pagada"))
      .orderBy(asc(facturas.fechaCobro)),
  ]);

  const impagasPor = new Map<string, typeof impagas>();
  for (const f of impagas) {
    const lista = impagasPor.get(f.institucionId) ?? [];
    lista.push(f);
    impagasPor.set(f.institucionId, lista);
  }

  const activas = insts.filter((i) => !i.suspendida);
  const resumen: ResumenCobros = {
    mrr: activas.reduce((suma, i) => suma + equivalenteMensual(i.plan), 0),
    suscripcionesActivas: activas.length,
    vencidos: { cantidad: 0, monto: 0 },
    sinMarcar: 0,
  };
  for (const f of impagas) {
    if (estadoEfectivo(f.estado, f.fechaCobro, hoy) === "vencida") {
      resumen.vencidos.cantidad += 1;
      resumen.vencidos.monto += f.monto;
      if (f.estado === "pendiente") resumen.sinMarcar += 1;
    }
  }

  const filas = insts.map((i): FilaCobro => {
    const propias = impagasPor.get(i.id) ?? [];
    const efectivos = propias.map((f) => estadoEfectivo(f.estado, f.fechaCobro, hoy));
    const estado: EstadoCobro = efectivos.includes("vencida") ? "vencida" : propias.length > 0 ? "pendiente" : "aldia";
    const primera = propias[0];
    return {
      institucionId: i.id,
      nombre: i.nombre,
      plan: i.plan,
      suspendida: i.suspendida,
      proximo: primera ? { periodo: primera.periodo, monto: primera.monto, fechaCobro: primera.fechaCobro } : null,
      estado,
    };
  });

  // Primero lo urgente: vencidas (la más atrasada arriba), después pendientes por fecha, al final las que están al día.
  const peso: Record<EstadoCobro, number> = { vencida: 0, pendiente: 1, aldia: 2 };
  filas.sort(
    (a, b) =>
      peso[a.estado] - peso[b.estado] ||
      (a.proximo?.fechaCobro ?? "9999").localeCompare(b.proximo?.fechaCobro ?? "9999") ||
      a.nombre.localeCompare(b.nombre, "es"),
  );
  return { resumen, filas };
}

/* ───────────────────────────── Pedidos de cambio de plan ───────────────────────────── */

export type PedidoDePlan = {
  id: string;
  institucionId: string;
  institucion: string;
  planActual: string;
  planSolicitado: string;
  /** Plan que tiene hoy la institución (puede haber cambiado desde que se hizo el pedido). */
  planVigente: string;
  nota: string | null;
  creadoEn: Date;
};

export async function pedidosDePlanPendientes(institucionId?: string): Promise<PedidoDePlan[]> {
  const filas = await getDb()
    .select({
      id: solicitudesPlan.id,
      institucionId: solicitudesPlan.institucionId,
      institucion: instituciones.nombre,
      planActual: solicitudesPlan.planActual,
      planSolicitado: solicitudesPlan.planSolicitado,
      planVigente: instituciones.plan,
      nota: solicitudesPlan.nota,
      creadoEn: solicitudesPlan.creadoEn,
    })
    .from(solicitudesPlan)
    .innerJoin(instituciones, eq(instituciones.id, solicitudesPlan.institucionId))
    .where(
      and(
        eq(solicitudesPlan.estado, "pendiente"),
        institucionId ? eq(solicitudesPlan.institucionId, institucionId) : undefined,
      ),
    )
    .orderBy(asc(solicitudesPlan.creadoEn));
  return filas;
}

/* ───────────────────────────── Detalle de una institución ───────────────────────────── */

export type FacturaBo = {
  id: string;
  periodo: string;
  plan: string;
  monto: number;
  fechaCobro: string;
  estado: EstadoFactura;
  pagadaEn: Date | null;
  medio: string | null;
};

export type DetalleCobros = {
  institucion: {
    id: string;
    nombre: string;
    slug: string;
    plan: string;
    suspendida: boolean;
    telefono: string | null;
    contactoNombre: string | null;
    cuit: string | null;
    medioPago: string | null;
    diaCobro: number | null;
    condicionFiscal: string | null;
    emailPropietario: string | null;
  };
  facturas: FacturaBo[];
  anio: number;
  pagadoEnElAnio: number;
  saldoPendiente: number;
  /** La factura impaga más cercana en el tiempo. */
  proximo: FacturaBo | null;
  vencidas: number;
  pedidosPendientes: PedidoDePlan[];
};

export async function detalleDeCobros(institucionId: string): Promise<DetalleCobros | null> {
  const db = getDb();
  const [fila] = await db
    .select({
      id: instituciones.id,
      nombre: instituciones.nombre,
      slug: instituciones.slug,
      plan: instituciones.plan,
      suspendida: instituciones.suspendida,
      telefono: instituciones.telefono,
      contactoNombre: instituciones.contactoNombre,
      cuit: instituciones.cuit,
      medioPago: instituciones.medioPago,
      diaCobro: instituciones.diaCobro,
      condicionFiscal: instituciones.condicionFiscal,
      emailPropietario: usuarios.email,
    })
    .from(instituciones)
    .leftJoin(usuarios, eq(usuarios.id, instituciones.propietarioId))
    .where(eq(instituciones.id, institucionId))
    .limit(1);
  if (!fila) return null;

  const [filas, pedidosPendientes] = await Promise.all([
    db
      .select()
      .from(facturas)
      .where(eq(facturas.institucionId, institucionId))
      .orderBy(desc(facturas.fechaCobro), desc(facturas.periodo))
      .limit(120),
    pedidosDePlanPendientes(institucionId),
  ]);

  const ahora = new Date();
  const hoy = hoyAR(ahora);
  const anio = anioActual(ahora);
  const lista = filas.map(
    (f): FacturaBo => ({
      id: f.id,
      periodo: f.periodo,
      plan: f.plan,
      monto: f.monto,
      fechaCobro: f.fechaCobro,
      estado: estadoEfectivo(f.estado, f.fechaCobro, hoy),
      pagadaEn: f.pagadaEn,
      medio: f.medio,
    }),
  );

  // "Pagado en el año": el año en que se cobró (si no hay fecha de pago, el de la fecha de cobro).
  const pagadoEnElAnio = lista
    .filter((f) => f.estado === "pagada")
    .filter((f) => (f.pagadaEn ? anioActual(f.pagadaEn) : Number(f.fechaCobro.slice(0, 4))) === anio)
    .reduce((suma, f) => suma + f.monto, 0);
  const impagas = lista.filter((f) => f.estado !== "pagada");
  const proximo = [...impagas].sort((a, b) => a.fechaCobro.localeCompare(b.fechaCobro))[0] ?? null;

  return {
    institucion: fila,
    facturas: lista,
    anio,
    pagadoEnElAnio,
    saldoPendiente: impagas.reduce((suma, f) => suma + f.monto, 0),
    proximo,
    vencidas: impagas.filter((f) => f.estado === "vencida").length,
    pedidosPendientes,
  };
}

/* ───────────────────────────── Cambio de plan y factura del período ───────────────────────────── */

export type ResultadoFacturaDelPeriodo =
  | { resultado: "creada"; periodo: string; monto: number }
  | { resultado: "actualizada"; periodo: string; monto: number }
  | { resultado: "sin_cambios"; motivo: "pagada" | "cubierta_por_anual" };

/**
 * Deja la factura del mes en curso de acuerdo con el nuevo plan:
 *  - si ya está paga, no se toca (el nuevo plan rige desde el próximo período);
 *  - si está impaga, se le cambia plan y monto;
 *  - si no existe, se crea (salvo que un plan anual pago cubra este mes).
 * Corre dentro de la transacción de la acción que aprueba el pedido.
 */
export async function aplicarPlanAlPeriodoActual(
  tx: EjecutorBo,
  institucion: { id: string; diaCobro: number | null; medioPago: string | null },
  plan: PlanClave,
  ahora = new Date(),
): Promise<ResultadoFacturaDelPeriodo> {
  const periodo = periodoActual(ahora);
  const hoy = hoyAR(ahora);
  const monto = montoDePlan(plan);

  const [existente] = await tx
    .select()
    .from(facturas)
    .where(and(eq(facturas.institucionId, institucion.id), eq(facturas.periodo, periodo)))
    .limit(1);

  if (existente) {
    if (existente.estado === "pagada") return { resultado: "sin_cambios", motivo: "pagada" };
    await tx.update(facturas).set({ plan, monto }).where(eq(facturas.id, existente.id));
    return { resultado: "actualizada", periodo, monto };
  }

  // Una factura anual paga cubre los 12 meses desde su período: no se vuelve a cobrar este mes.
  const [anual] = await tx
    .select({ id: facturas.id })
    .from(facturas)
    .where(
      and(
        eq(facturas.institucionId, institucion.id),
        eq(facturas.plan, "anual"),
        eq(facturas.estado, "pagada"),
        gte(facturas.periodo, sumarMeses(periodo, -11)),
        lte(facturas.periodo, periodo),
      ),
    )
    .limit(1);
  if (anual) return { resultado: "sin_cambios", motivo: "cubierta_por_anual" };

  // Si el día de cobro de este mes ya pasó, se cobra hoy: no nace vencida.
  const fecha = fechaCobroDelPeriodo(periodo, institucion.diaCobro);
  await tx.insert(facturas).values({
    institucionId: institucion.id,
    plan,
    monto,
    periodo,
    fechaCobro: fecha < hoy ? hoy : fecha,
    estado: "pendiente",
    medio: institucion.medioPago,
  });
  return { resultado: "creada", periodo, monto };
}

/** Facturas que siguen "pendiente" en la base aunque su fecha ya pasó (las que marca "Marcar vencidas"). */
export async function facturasPendientesVencidas(ejecutor: EjecutorBo = getDb()) {
  return ejecutor
    .select({
      id: facturas.id,
      institucionId: facturas.institucionId,
      periodo: facturas.periodo,
      monto: facturas.monto,
      fechaCobro: facturas.fechaCobro,
    })
    .from(facturas)
    .where(and(eq(facturas.estado, "pendiente"), sql`${facturas.fechaCobro} < ${hoyAR()}::date`))
    .orderBy(asc(facturas.fechaCobro));
}
