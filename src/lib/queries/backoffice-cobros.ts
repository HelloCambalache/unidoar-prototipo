import "server-only";
import { and, asc, desc, eq, gte, inArray, lte, ne, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { facturas, instituciones, solicitudesPlan, usuarios } from "@/db/schema";
import {
  anioActual,
  estadoEfectivo,
  fechaCobroDelPeriodo,
  hoyAR,
  pagoHastaDeMes,
  periodoActual,
  planificarFacturas,
  sumarMeses,
  type EstadoCobro,
  type EstadoFactura,
  type MotivoOmision,
} from "@/lib/cobros";
import { registrarAuditoria } from "@/lib/auditoria";
import { correoDeFacturaNueva } from "@/lib/correo/eventos";
import type { PlanClave, Planes } from "@/lib/planes";
import { acuerdoDe, acuerdosDePrecio } from "@/lib/queries/acuerdos";
import { conDebitoAutorizado, disponiblesPorInstitucion, gastarMesSinCobro, mesesYaBonificados } from "@/lib/queries/bonificaciones";
import { planes as cargarPlanes, planesParaCobrar } from "@/lib/queries/planes";
import { cantidadDeSedes } from "@/lib/queries/sedes";
import { destinatariosDeFacturacion, type EjecutorBo } from "@/lib/queries/backoffice-instituciones";

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
  /** Suma mensual equivalente de los planes de las instituciones no suspendidas (la búsqueda puntual no cuenta: no es recurrente). */
  mrr: number;
  suscripcionesActivas: number;
  vencidos: { cantidad: number; monto: number };
  /** Facturas que siguen "pendiente" en la base aunque su fecha ya pasó (las que alcanza "Marcar vencidas"). */
  sinMarcar: number;
};

export async function tablaDeCobros(): Promise<{ resumen: ResumenCobros; filas: FilaCobro[] }> {
  const db = getDb();
  const P = await cargarPlanes();
  const hoy = hoyAR();
  const [insts, conFacturas, impagas] = await Promise.all([
    db
      .select({ id: instituciones.id, nombre: instituciones.nombre, plan: instituciones.plan, suspendida: instituciones.suspendida, esDemo: instituciones.esDemo })
      .from(instituciones)
      .orderBy(asc(instituciones.nombre)),
    // Quiénes ya tienen alguna factura: la primera la carga el equipo a mano, y hasta entonces la institución todavía no empezó a pagar.
    db.select({ institucionId: facturas.institucionId }).from(facturas).groupBy(facturas.institucionId),
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

  // El MRR y las suscripciones activas cuentan a quienes pagan: ni las de ejemplo, ni las suspendidas, ni las que todavía no tienen una primera factura.
  const conHistorial = new Set(conFacturas.map((f) => f.institucionId));
  const activas = insts.filter((i) => !i.suspendida && !i.esDemo && conHistorial.has(i.id));
  const [sedesPor, acuerdosPor] = await Promise.all([
    cantidadDeSedes(db, activas.map((i) => i.id)),
    acuerdosDePrecio(db, activas.map((i) => i.id)),
  ]);
  const resumen: ResumenCobros = {
    mrr: activas.reduce((suma, i) => suma + P.equivalenteMensual(i.plan, sedesPor.get(i.id) ?? 1, acuerdosPor.get(i.id) ?? null), 0),
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
  /** Meses que cubre (1 las mensuales; 6 un semestre pagado al contado). */
  mesesCubiertos: number;
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
      mesesCubiertos: f.mesesCubiertos,
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
  | { resultado: "sin_cambios"; motivo: "pagada" | "cubierta_por_semestre" | "sin_abono" | "bonificada" };

/**
 * Deja la factura del mes en curso de acuerdo con el nuevo plan:
 *  - si ya está paga, no se toca (el nuevo plan rige desde el próximo período);
 *  - si está impaga, se le cambia plan y monto;
 *  - si no existe, se crea (salvo que un semestre pago cubra este mes).
 * Corre dentro de la transacción de la acción que aprueba el pedido.
 */
export async function aplicarPlanAlPeriodoActual(
  tx: EjecutorBo,
  institucion: { id: string; diaCobro: number | null; medioPago: string | null },
  plan: PlanClave,
  /** Los planes vigentes: de ahí sale el monto. */
  P: Planes,
  ahora = new Date(),
): Promise<ResultadoFacturaDelPeriodo> {
  // La búsqueda puntual no tiene abono mensual: no hay factura del mes (se paga cada búsqueda).
  if (P.esPuntual(plan)) return { resultado: "sin_cambios", motivo: "sin_abono" };
  const periodo = periodoActual(ahora);
  const hoy = hoyAR(ahora);
  const monto = P.montoDePlan(plan, (await cantidadDeSedes(tx, [institucion.id])).get(institucion.id) ?? 1, await acuerdoDe(tx, institucion.id));

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

  // Un semestre pagado al contado (una factura paga que cubre varios meses) tampoco se vuelve a cobrar mes a mes.
  const semestres = await tx
    .select({ periodo: facturas.periodo, estado: facturas.estado, mesesCubiertos: facturas.mesesCubiertos })
    .from(facturas)
    .where(and(eq(facturas.institucionId, institucion.id), eq(facturas.estado, "pagada"), gte(facturas.mesesCubiertos, 2), gte(facturas.periodo, sumarMeses(periodo, -11)), lte(facturas.periodo, periodo)));
  if (pagoHastaDeMes(periodo, semestres)) return { resultado: "sin_cambios", motivo: "cubierta_por_semestre" };

  // Un mes bonificado por recomendar tampoco se factura (el cron lo respeta): no se le crea una factura que la institución no tiene que pagar.
  if ((await mesesYaBonificados(tx, [institucion.id], periodo)).length > 0) return { resultado: "sin_cambios", motivo: "bonificada" };

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

export type ResultadoGeneracion = {
  periodo: string;
  creadas: { id: string; institucionId: string }[];
  /** Instituciones a las que no hacía falta crearles nada, por motivo. */
  omitidas: Partial<Record<MotivoOmision, number>>;
  /** Cuentas activas sin ninguna factura: la primera la carga el equipo a mano, no se cobra sola. */
  sinFacturaPrevia: number;
  /** Instituciones a las que este mes no se les facturó porque gastaron un mes bonificado por recomendar (ver src/lib/bonificacion.ts). */
  bonificadas: string[];
};

/**
 * Crea las facturas del mes en curso (hora argentina) de las suscripciones que ya andan: instituciones no suspendidas,
 * que no son de demostración y que ya tienen al menos una factura (la primera la carga el equipo a mano, porque
 * una cuenta nueva todavía no aceptó pagar nada). Se puede correr todas las veces que haga falta: lo que ya existe no
 * se duplica (índice único por institución y período). Deja una entrada de auditoría por factura, sin usuario.
 * Las reglas de qué se factura están en `planificarFacturas`.
 */
export async function generarFacturasDelPeriodo(ejecutor: EjecutorBo, ahora = new Date()): Promise<ResultadoGeneracion> {
  const periodo = periodoActual(ahora);
  const hoy = hoyAR(ahora);
  // Los precios vigentes o nada: con los de lanzamiento (si la base no respondió) las facturas del mes saldrían con un monto equivocado y, como
  // se crean una vez por mes, quedarían así. Si falla, el cron responde error y se reintenta mañana (es idempotente).
  const P = await planesParaCobrar();

  const activas = await ejecutor
    .select({ id: instituciones.id, nombre: instituciones.nombre, plan: instituciones.plan, diaCobro: instituciones.diaCobro, medioPago: instituciones.medioPago })
    .from(instituciones)
    .where(and(eq(instituciones.suspendida, false), eq(instituciones.esDemo, false)));
  if (activas.length === 0) return { periodo, creadas: [], omitidas: {}, sinFacturaPrevia: 0, bonificadas: [] };

  const ids = activas.map((i) => i.id);
  const [sedesPor, acuerdosPor, disponiblesPor, bonificadosYa, conDebito] = await Promise.all([
    cantidadDeSedes(ejecutor, ids),
    acuerdosDePrecio(ejecutor, ids),
    disponiblesPorInstitucion(ejecutor, ids),
    mesesYaBonificados(ejecutor, ids, periodo),
    conDebitoAutorizado(ejecutor, ids),
  ]);
  const [conFacturas, recientes] = await Promise.all([
    ejecutor.select({ institucionId: facturas.institucionId }).from(facturas).where(inArray(facturas.institucionId, ids)).groupBy(facturas.institucionId),
    ejecutor
      .select({ institucionId: facturas.institucionId, periodo: facturas.periodo, plan: facturas.plan, estado: facturas.estado, mesesCubiertos: facturas.mesesCubiertos })
      .from(facturas)
      .where(and(inArray(facturas.institucionId, ids), gte(facturas.periodo, sumarMeses(periodo, -11)), lte(facturas.periodo, periodo))),
  ]);

  const conHistorial = new Set(conFacturas.map((f) => f.institucionId));
  const { crear, omitidas, bonificar } = planificarFacturas(
    activas.filter((i) => conHistorial.has(i.id)).map((i) => ({
      ...i,
      sedes: sedesPor.get(i.id) ?? 1,
      acuerdo: acuerdosPor.get(i.id) ?? null,
      mesesBonificados: disponiblesPor.get(i.id) ?? 0,
      conDebitoActivo: conDebito.has(i.id),
    })),
    recientes,
    periodo,
    hoy,
    P,
    bonificadosYa,
  );

  // Los meses bonificados por recomendar: este mes no se factura y se anota cuál fue (ver src/lib/bonificacion.ts).
  const bonificadas: string[] = [];
  for (const b of bonificar) {
    if (await gastarMesSinCobro(ejecutor, b.institucionId, b.periodo)) bonificadas.push(b.institucionId);
  }

  const creadas = crear.length
    ? await ejecutor
        .insert(facturas)
        .values(crear.map((f) => ({ ...f, estado: "pendiente" })))
        .onConflictDoNothing({ target: [facturas.institucionId, facturas.periodo] })
        .returning({
          id: facturas.id,
          institucionId: facturas.institucionId,
          plan: facturas.plan,
          monto: facturas.monto,
          periodo: facturas.periodo,
          fechaCobro: facturas.fechaCobro,
        })
    : [];
  for (const f of creadas) {
    await registrarAuditoria(
      {
        usuarioId: null,
        accion: "factura.crear",
        entidad: "factura",
        entidadId: f.id,
        detalle: {
          institucionId: f.institucionId,
          periodo: f.periodo,
          plan: f.plan,
          monto: f.monto,
          fechaCobro: f.fechaCobro,
          origen: "automatica",
        },
      },
      ejecutor,
    );
  }

  // Aviso por mail a quienes administran cada institución (si el envío está apagado, no se anota nada).
  for (const f of creadas) {
    const usuarioIds = await destinatariosDeFacturacion(ejecutor, f.institucionId);
    await correoDeFacturaNueva(ejecutor, {
      usuarioIds,
      facturaId: f.id,
      institucion: activas.find((i) => i.id === f.institucionId)?.nombre ?? "tu institución",
      periodo: f.periodo,
      monto: f.monto,
      fechaCobro: f.fechaCobro,
    });
  }

  const porMotivo: ResultadoGeneracion["omitidas"] = {};
  for (const o of omitidas) porMotivo[o.motivo] = (porMotivo[o.motivo] ?? 0) + 1;
  return {
    periodo,
    creadas: creadas.map((f) => ({ id: f.id, institucionId: f.institucionId })),
    omitidas: porMotivo,
    sinFacturaPrevia: activas.length - conHistorial.size,
    bonificadas,
  };
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
