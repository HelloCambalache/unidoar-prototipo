import "server-only";
import { cache } from "react";
import { and, count, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { instituciones } from "@/db/schema";
import type { EjecutorBo } from "@/lib/queries/backoffice-instituciones";
import { catalogoDePlanes } from "@/lib/queries/planes";
import { hoyAR } from "@/lib/cobros";
import { crearPlanes } from "@/lib/planes";

/*
 * Instituciones fundadoras: las primeras N (`planes_condiciones.cupos_fundador`, 50 de lanzamiento) que se suman reciben el Plan Fundador en lugar del
 * arancel de su tipo. Acá está lo que toca la base; las reglas puras (`cuposDeFundador`, `planDelAlta`) están en src/lib/planes.ts.
 */

/**
 * Cuántas instituciones ocupan hoy un lugar de fundadora: las que tienen el Plan Fundador, sin contar las de ejemplo ni las dadas de baja
 * (que dejan el lugar libre).
 */
export async function fundadorasActuales(ejecutor: Pick<EjecutorBo, "select"> = getDb()): Promise<number> {
  const [{ n } = { n: 0 }] = await ejecutor
    .select({ n: count() })
    .from(instituciones)
    .where(and(eq(instituciones.plan, "fundador"), eq(instituciones.esDemo, false), isNull(instituciones.bajaEn)));
  return n;
}

/**
 * Pide el turno para repartir los lugares de fundadora: dos altas (o una asignación del equipo) a la vez se esperan una a la otra y no se pasan
 * del cupo. Dura hasta que termina la transacción de quien llama; hay que llamarla ANTES de contar con `fundadorasActuales`.
 */
export async function bloquearCuposDeFundadoras(tx: Pick<EjecutorBo, "execute">) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext('unidoar.fundadoras'))`);
}

/**
 * Lo que la parte pública y el alta saben de las fundadoras. **No lleva cuántos lugares quedan**: esa cifra viajaría al navegador (en el código de la
 * página) y se vería cuántas instituciones ya se sumaron; lo que se muestra es el plazo (`dias`). Para el equipo, la cuenta está en Planes.
 */
export type CuposDeFundadoras = {
  /** El cupo total que fijó el equipo («las primeras N»). */
  total: number;
  /** Se ofrece ahora: el plan está prendido, no cerró la fecha y queda al menos un lugar. */
  hay: boolean;
  /** Días que faltan para el cierre (0 = hoy es el último día), o null si el equipo no cargó una fecha de cierre. */
  dias: number | null;
};

/**
 * Las fundadoras para mostrar en la parte pública y en el alta, leídas una vez por pedido. Si la base falla, no se ofrece nada (mejor que
 * prometer un lugar que no sabemos si queda).
 */
export const cuposDeFundadoras = cache(async (): Promise<CuposDeFundadoras> => {
  try {
    const catalogo = await catalogoDePlanes();
    const P = crearPlanes(catalogo);
    const hoy = hoyAR();
    const hay = P.cuposDeFundador(await fundadorasActuales(), hoy) > 0;
    return { total: catalogo.condiciones.cuposFundador, hay, dias: hay ? P.diasParaCerrarFundadoras(hoy) : null };
  } catch {
    return { total: 0, hay: false, dias: null };
  }
});
