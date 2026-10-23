import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { facturas, institucionMiembros, solicitudesPlan, type Institucion } from "@/db/schema";
import { etiquetaDeCobertura, etiquetaPeriodo, pagoHastaDeMes, periodoActual } from "@/lib/cobros";
import { estadoDeFactura, periodoLegible, type EstadoFactura } from "@/lib/facturacion";
import { fechaDeInput, haceTiempo } from "@/lib/fechas";
import { fechaLarga } from "@/lib/fechas-curso";
import { esClavePlan, type AcuerdoDePrecio, type PlanClave } from "@/lib/planes";
import { acuerdoDe } from "@/lib/queries/acuerdos";
import { planes } from "@/lib/queries/planes";
import type { Ejecutor } from "@/lib/queries/pipeline";
import { cantidadDeSedes } from "@/lib/queries/sedes";

/*
 * Plan y facturación de la institución. Todavía no hay pasarela de pago: el plan sale de
 * `instituciones.plan`, las facturas las carga el backoffice y "Cambiar de plan" solo deja un
 * pedido en `solicitudes_plan` que atiende el equipo.
 */

export type RolEnEquipo = "dueno" | "administrador" | "colaborador";

/** Rol de la cuenta en la institución: quien creó la cuenta es dueño; el resto, según su membresía activa. */
export async function rolEnInstitucion(
  institucion: Pick<Institucion, "id" | "propietarioId">,
  usuarioId: string,
  ejecutor: Ejecutor = getDb(),
): Promise<RolEnEquipo | null> {
  if (institucion.propietarioId === usuarioId) return "dueno";
  const [miembro] = await ejecutor
    .select({ rol: institucionMiembros.rol })
    .from(institucionMiembros)
    .where(
      and(
        eq(institucionMiembros.institucionId, institucion.id),
        eq(institucionMiembros.usuarioId, usuarioId),
        eq(institucionMiembros.estado, "activo"),
      ),
    )
    .limit(1);
  if (!miembro) return null;
  if (/^due[nñ]o/i.test(miembro.rol)) return "dueno";
  if (/^admin/i.test(miembro.rol)) return "administrador";
  return "colaborador";
}

/** Solo el dueño y los administradores del equipo pueden pedir cambios de plan. */
export const puedeGestionarPlan = (rol: RolEnEquipo | null) => rol === "dueno" || rol === "administrador";

/** El pedido de cambio que todavía no atendió el equipo (a lo sumo uno por institución). */
export async function solicitudPendiente(institucionId: string, ejecutor: Ejecutor = getDb()) {
  const [fila] = await ejecutor
    .select()
    .from(solicitudesPlan)
    .where(and(eq(solicitudesPlan.institucionId, institucionId), eq(solicitudesPlan.estado, "pendiente")))
    .orderBy(desc(solicitudesPlan.creadoEn))
    .limit(1);
  return fila ?? null;
}

/** La factura, solo si es de la institución (la hoja imprimible y cualquier descarga pasan por acá). */
export async function facturaPropia(institucionId: string, facturaId: string) {
  const [fila] = await getDb()
    .select()
    .from(facturas)
    .where(and(eq(facturas.id, facturaId), eq(facturas.institucionId, institucionId)))
    .limit(1);
  return fila ?? null;
}

export type FacturaVista = {
  id: string;
  /** Nombre del plan al momento del cobro. */
  planLabel: string;
  /** "Octubre de 2026" */
  periodo: string;
  /** "10/10/2026" */
  fechaCobro: string;
  /** "10 de octubre de 2026" */
  fechaCobroLarga: string;
  monto: number;
  estado: EstadoFactura;
  medio: string | null;
};

export type SolicitudVista = {
  id: string;
  planSolicitado: PlanClave;
  /** "hace 2 días" */
  cuando: string;
};

export type DatosDePlan = {
  plan: PlanClave;
  /** Cuántas sedes tiene la institución: el monto del plan suma las adicionales. */
  sedes: number;
  /** El precio acordado con la institución (abono o convenio), o null si paga el de lista. */
  acuerdo: AcuerdoDePrecio | null;
  /** Si un semestre pagado al contado cubre el mes en curso, hasta qué mes ("marzo 2027"); null si no. */
  semestrePagoHasta: string | null;
  puedeCambiar: boolean;
  facturas: FacturaVista[];
  /** La factura pendiente más próxima. */
  proxima: FacturaVista | null;
  vencidas: number;
  solicitud: SolicitudVista | null;
};

/** Todo lo que muestra /institucion/plan, en una sola lectura. */
export async function datosDePlan(institucion: Institucion, usuarioId: string): Promise<DatosDePlan> {
  const db = getDb();
  const ahora = new Date();
  const [P, rol, filas, pendiente, sedes, acuerdo] = await Promise.all([
    planes(),
    rolEnInstitucion(institucion, usuarioId),
    db
      .select()
      .from(facturas)
      .where(eq(facturas.institucionId, institucion.id))
      .orderBy(desc(facturas.fechaCobro))
      .limit(60),
    solicitudPendiente(institucion.id),
    cantidadDeSedes(db, [institucion.id]),
    acuerdoDe(db, institucion.id),
  ]);

  const lista = filas.map(
    (f): FacturaVista => ({
      id: f.id,
      planLabel: P.planDe(f.plan).label,
      // Un semestre pagado al contado cubre varios meses con una sola factura: "6 meses (octubre 2026 a marzo 2027)".
      periodo: f.mesesCubiertos > 1 ? etiquetaDeCobertura(f.periodo, f.mesesCubiertos) : periodoLegible(f.periodo),
      fechaCobro: fechaDeInput(f.fechaCobro),
      fechaCobroLarga: fechaLarga(f.fechaCobro),
      monto: f.monto,
      estado: estadoDeFactura(f.estado),
      medio: f.medio,
    }),
  );
  const semestreHasta = pagoHastaDeMes(periodoActual(ahora), filas.filter((f) => f.mesesCubiertos > 1));
  // Las pendientes se cobran de la más próxima a la más lejana; `filas` viene de la más nueva a la más vieja.
  const proxima = [...filas]
    .reverse()
    .find((f) => estadoDeFactura(f.estado) === "pendiente");

  return {
    plan: esClavePlan(institucion.plan) ? institucion.plan : "colegio",
    sedes: sedes.get(institucion.id) ?? 1,
    acuerdo,
    semestrePagoHasta: semestreHasta ? etiquetaPeriodo(semestreHasta).toLowerCase() : null,
    puedeCambiar: puedeGestionarPlan(rol),
    facturas: lista,
    proxima: proxima ? (lista.find((f) => f.id === proxima.id) ?? null) : null,
    vencidas: lista.filter((f) => f.estado === "vencida").length,
    solicitud:
      pendiente && esClavePlan(pendiente.planSolicitado)
        ? { id: pendiente.id, planSolicitado: pendiente.planSolicitado, cuando: haceTiempo(pendiente.creadoEn, ahora) }
        : null,
  };
}
