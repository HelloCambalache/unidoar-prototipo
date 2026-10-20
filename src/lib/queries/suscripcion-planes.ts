import "server-only";
import { and, desc, eq, gt } from "drizzle-orm";
import { getDb } from "@/db";
import { facturas, planesMp, type PlanMp } from "@/db/schema";
import { periodoActual } from "@/lib/cobros";
import { cuerpoDePlan, puedeReutilizarPlan } from "@/lib/debito-automatico";
import { crearPlanMp, ErrorDeMercadoPago, obtenerPlanMp, type PlanDeMercadoPago } from "@/lib/mercadopago-cliente";

/*
 * El plan de Mercado Pago de cada institución (ver CLAUDE.md, "Mercado Pago"). La persona se suscribe entrando al enlace de ese plan, y como
 * Mercado Pago no dice quién se suscribió (descarta la referencia y deja vacío el mail), lo único que ata una suscripción a una institución
 * es el número del plan: esta tabla (`planes_mp`) es esa atadura. Nunca se borran filas al crear un plan nuevo.
 */

type Lector = Pick<ReturnType<typeof getDb>, "select">;

/** El último plan de Mercado Pago que se creó para la institución, o null si nunca se creó uno. */
export async function ultimoPlanDe(institucionId: string, ejecutor: Lector = getDb()): Promise<PlanMp | null> {
  const [fila] = await ejecutor.select().from(planesMp).where(eq(planesMp.institucionId, institucionId)).orderBy(desc(planesMp.creadoEn)).limit(1);
  return fila ?? null;
}

/** De qué institución es un plan de Mercado Pago, o null si no lo conocemos. */
export async function institucionDelPlan(mpPlanId: string, ejecutor: Lector = getDb()): Promise<PlanMp | null> {
  const [fila] = await ejecutor.select().from(planesMp).where(eq(planesMp.mpPlanId, mpPlanId)).limit(1);
  return fila ?? null;
}

/** Los planes creados desde una fecha: se les pregunta a Mercado Pago por suscripciones cuyo aviso no llegó. */
export async function planesCreadosDesde(desde: Date): Promise<PlanMp[]> {
  return getDb().select().from(planesMp).where(gt(planesMp.creadoEn, desde));
}

/** Los planes de una institución, del más nuevo al más viejo (para confirmar una suscripción que acaba de nacer). */
export async function planesDe(institucionId: string, limite = 5): Promise<PlanMp[]> {
  return getDb().select().from(planesMp).where(eq(planesMp.institucionId, institucionId)).orderBy(desc(planesMp.creadoEn)).limit(limite);
}

/** ¿La factura del mes en curso de la institución ya está paga? (por el débito, a mano o como sea). Define si el primer cobro se difiere. */
export async function mesActualPago(institucionId: string, ejecutor: Lector = getDb()): Promise<boolean> {
  const [f] = await ejecutor
    .select({ estado: facturas.estado })
    .from(facturas)
    .where(and(eq(facturas.institucionId, institucionId), eq(facturas.periodo, periodoActual())))
    .limit(1);
  return f?.estado === "pagada";
}

export type DatosParaSuscribirse = {
  institucionId: string;
  institucion: string;
  /** La clave del plan de UNIDOAR (colegio, deportiva…). */
  clavePlan: string;
  planLabel: string;
  /** Pesos por mes: plan × sedes. */
  monto: number;
  volverA: string;
  /** Días sin cobro antes del primer cobro (0: sale al suscribirse). Ver `primerCobroDiferido`. */
  diasDePrueba: number;
};

/**
 * El plan al que se manda a la persona para que se suscriba. Se reutiliza el último de la institución mientras sea el mismo plan y el mismo
 * monto (y Mercado Pago lo siga teniendo activo); si no, se crea uno nuevo y se anota de quién es **antes** de devolver el enlace, para que
 * una suscripción que nazca de ahí siempre se pueda atribuir. Devuelve también si se creó uno (para la auditoría).
 */
export async function planParaSuscribirse(d: DatosParaSuscribirse): Promise<{ plan: PlanDeMercadoPago; creado: boolean }> {
  const guardado = await ultimoPlanDe(d.institucionId);
  if (guardado && puedeReutilizarPlan(guardado, { plan: d.clavePlan, monto: d.monto, diasDePrueba: d.diasDePrueba })) {
    try {
      const actual = await obtenerPlanMp(guardado.mpPlanId);
      if (actual.enlace && (actual.estado === undefined || actual.estado === "active")) return { plan: actual, creado: false };
    } catch (e) {
      // Si Mercado Pago ya no conoce ese plan, se crea otro; cualquier otro error se muestra.
      if (!(e instanceof ErrorDeMercadoPago && e.tipo === "no-existe")) throw e;
    }
  }

  const creado = await crearPlanMp(
    cuerpoDePlan({ institucion: d.institucion, planLabel: d.planLabel, monto: d.monto, volverA: d.volverA, diasDePrueba: d.diasDePrueba }),
  );
  await getDb()
    .insert(planesMp)
    .values({ mpPlanId: creado.id, institucionId: d.institucionId, plan: d.clavePlan, monto: d.monto, diasDePrueba: d.diasDePrueba })
    .onConflictDoNothing();
  return { plan: creado, creado: true };
}
