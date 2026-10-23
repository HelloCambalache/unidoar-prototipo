import "server-only";
import { and, asc, count, desc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getDb } from "@/db";
import { cobrosMp, instituciones, mesesBonificados, referidosInstituciones, suscripcionesMp } from "@/db/schema";
import { registrarAuditoria } from "@/lib/auditoria";
import { estadoDeMes, gastoDelCobro, textoDeMesBonificado, type EstadoDeMes } from "@/lib/bonificacion";
import { etiquetaPeriodo, periodoActual, type MesBonificadoYa } from "@/lib/cobros";
import { pesos } from "@/lib/planes";
import { avisarAAdmins, avisarAVarios } from "@/lib/queries/avisos";
import { destinatariosDeInstitucion, type EjecutorBo } from "@/lib/queries/backoffice-instituciones";

/*
 * Meses bonificados por recomendar (reglas y textos en src/lib/bonificacion.ts). Acá está lo que toca la base: cuántos tiene cada institución,
 * gastar uno cuando el cron no factura un mes o cuando llega el cobro del débito automático (que después se devuelve a mano), y las listas
 * para mostrar. Todo lo que cambia algo corre dentro de la transacción de quien llama (el cron, el cobro o la acción del equipo).
 */

/** Cuántos meses bonificados sin gastar tiene cada institución (las que no tienen ninguno no aparecen). */
export async function disponiblesPorInstitucion(ejecutor: EjecutorBo, ids: readonly string[]): Promise<Map<string, number>> {
  if (ids.length === 0) return new Map();
  const filas = await ejecutor
    .select({ institucionId: mesesBonificados.institucionId, n: count() })
    .from(mesesBonificados)
    .where(and(inArray(mesesBonificados.institucionId, [...ids]), isNull(mesesBonificados.periodo)))
    .groupBy(mesesBonificados.institucionId);
  return new Map(filas.map((f) => [f.institucionId, f.n]));
}

/** Los meses de `periodo` que ya quedaron bonificados, para no gastar otro ni facturarlos. */
export async function mesesYaBonificados(ejecutor: EjecutorBo, ids: readonly string[], periodo: string): Promise<MesBonificadoYa[]> {
  if (ids.length === 0) return [];
  const filas = await ejecutor
    .select({ institucionId: mesesBonificados.institucionId, periodo: mesesBonificados.periodo })
    .from(mesesBonificados)
    .where(and(inArray(mesesBonificados.institucionId, [...ids]), eq(mesesBonificados.periodo, periodo)));
  return filas.flatMap((f) => (f.periodo ? [{ institucionId: f.institucionId, periodo: f.periodo }] : []));
}

/** Las instituciones que tienen un débito automático autorizado: ahí el mes bonificado se gasta al llegar el cobro. */
export async function conDebitoAutorizado(ejecutor: EjecutorBo, ids: readonly string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const filas = await ejecutor
    .select({ institucionId: suscripcionesMp.institucionId })
    .from(suscripcionesMp)
    .where(and(inArray(suscripcionesMp.institucionId, [...ids]), eq(suscripcionesMp.estado, "autorizada")));
  return new Set(filas.map((f) => f.institucionId));
}

/** El nombre de la institución recomendada que generó un mes (para los textos), o null si esa recomendación ya no existe. */
async function nombreDeLaRecomendada(ejecutor: EjecutorBo, referidoId: string | null): Promise<string | null> {
  if (!referidoId) return null;
  const [fila] = await ejecutor
    .select({ nombre: instituciones.nombre })
    .from(referidosInstituciones)
    .innerJoin(instituciones, eq(instituciones.id, referidosInstituciones.referidoId))
    .where(eq(referidosInstituciones.id, referidoId))
    .limit(1);
  return fila?.nombre ?? null;
}

/** Toma el mes disponible más viejo de la institución (`skip locked`: dos gastos a la vez no toman el mismo) y lo gasta en `periodo`. */
async function tomarDisponible(ejecutor: EjecutorBo, institucionId: string, periodo: string, cobroId: string | null) {
  const [libre] = await ejecutor
    .select({ id: mesesBonificados.id, referidoId: mesesBonificados.referidoId })
    .from(mesesBonificados)
    .where(and(eq(mesesBonificados.institucionId, institucionId), isNull(mesesBonificados.periodo)))
    .orderBy(asc(mesesBonificados.creadoEn), asc(mesesBonificados.id))
    .limit(1)
    .for("update", { skipLocked: true });
  if (!libre) return null;
  await ejecutor.update(mesesBonificados).set({ periodo, usadoEn: new Date(), cobroId }).where(eq(mesesBonificados.id, libre.id));
  return libre;
}

/**
 * El cron no factura `periodo` a una institución sin débito automático: se gasta uno de sus meses bonificados, se anota cuál mes fue y se le
 * avisa en la campanita. Devuelve false si no había ninguno o ese mes ya estaba bonificado (otra pasada se le adelantó): no hace nada.
 */
export async function gastarMesSinCobro(ejecutor: EjecutorBo, institucionId: string, periodo: string): Promise<boolean> {
  const [ya] = await ejecutor
    .select({ id: mesesBonificados.id })
    .from(mesesBonificados)
    .where(and(eq(mesesBonificados.institucionId, institucionId), eq(mesesBonificados.periodo, periodo)))
    .limit(1);
  if (ya) return false;
  const mes = await tomarDisponible(ejecutor, institucionId, periodo, null);
  if (!mes) return false;

  const recomendada = await nombreDeLaRecomendada(ejecutor, mes.referidoId);
  await registrarAuditoria(
    { usuarioId: null, accion: "referido.mes_bonificado", entidad: "institucion", entidadId: institucionId, detalle: { periodo, origen: "automatica", conDebito: false } },
    ejecutor,
  );
  await avisarAVarios(ejecutor, await destinatariosDeInstitucion(ejecutor, institucionId), {
    tipo: "sistema",
    titulo: "UNIDOAR",
    texto: textoDeMesBonificado({ periodo: etiquetaPeriodo(periodo), recomendada, conDebito: false }),
    enlace: "/institucion/plan",
  });
  return true;
}

/**
 * Llegó el cobro del débito automático de `periodo` (ya anotado como pago). Si la institución tiene meses bonificados, ese mes se bonifica:
 * Mercado Pago ya cobró, así que se anota el cobro para que el equipo lo devuelva a mano desde Mercado Pago y se le avisa a él (y a la
 * institución, que sabe que le devolvemos lo cobrado). Si el mes ya estaba bonificado sin cobro (el cron lo bonificó antes de que se activara
 * el débito), solo se le agrega el cobro. Devuelve true si el mes quedó bonificado: el cobro que llama deja de decir «recibimos tu débito».
 */
export async function gastarMesEnCobro(
  ejecutor: EjecutorBo,
  e: { institucionId: string; institucion: string; periodo: string; cobroId: string; monto: number; pagoId: string | null },
): Promise<boolean> {
  const [anotado] = await ejecutor
    .select({ id: mesesBonificados.id, cobroId: mesesBonificados.cobroId, referidoId: mesesBonificados.referidoId })
    .from(mesesBonificados)
    .where(and(eq(mesesBonificados.institucionId, e.institucionId), eq(mesesBonificados.periodo, e.periodo)))
    .limit(1);
  const [{ disponibles } = { disponibles: 0 }] = anotado
    ? [{ disponibles: 0 }]
    : await ejecutor
        .select({ disponibles: count() })
        .from(mesesBonificados)
        .where(and(eq(mesesBonificados.institucionId, e.institucionId), isNull(mesesBonificados.periodo)));

  const gasto = gastoDelCobro({ mesAnotado: anotado ?? null, disponibles });
  if (gasto === "ya-estaba" || gasto === "ninguno") return gasto === "ya-estaba";
  // Un cobro de un mes que ya pasó (lo recuperó la revisión diaria o el aviso llegó tarde) no gasta un mes bonificado que se ganó después:
  // el mes sigue disponible para el próximo cobro. Solo se agrega el cobro a un mes que ya estaba anotado.
  if (gasto === "tomar-disponible" && e.periodo < periodoActual()) return false;

  let referidoId: string | null;
  if (gasto === "agregar-cobro" && anotado) {
    await ejecutor.update(mesesBonificados).set({ cobroId: e.cobroId }).where(eq(mesesBonificados.id, anotado.id));
    referidoId = anotado.referidoId;
  } else {
    const mes = await tomarDisponible(ejecutor, e.institucionId, e.periodo, e.cobroId);
    if (!mes) return false;
    referidoId = mes.referidoId;
  }

  const recomendada = await nombreDeLaRecomendada(ejecutor, referidoId);
  await registrarAuditoria(
    {
      usuarioId: null,
      accion: "referido.mes_bonificado",
      entidad: "institucion",
      entidadId: e.institucionId,
      detalle: { periodo: e.periodo, origen: "mercadopago", conDebito: true, cobroId: e.cobroId, monto: e.monto },
    },
    ejecutor,
  );
  await avisarAVarios(ejecutor, await destinatariosDeInstitucion(ejecutor, e.institucionId), {
    tipo: "sistema",
    titulo: "UNIDOAR",
    texto: textoDeMesBonificado({ periodo: etiquetaPeriodo(e.periodo), recomendada, conDebito: true, montoTexto: pesos(e.monto) }),
    enlace: "/institucion/plan",
  });
  await avisarAAdmins(ejecutor, {
    titulo: "Devolver un débito bonificado",
    texto: `${e.institucion}: ${etiquetaPeriodo(e.periodo)} es un mes bonificado por recomendar${recomendada ? ` a ${recomendada}` : ""} y Mercado Pago ya cobró ${pesos(e.monto)}${e.pagoId ? ` (pago ${e.pagoId})` : ""}. Hay que devolverlo desde Mercado Pago y marcarlo.`,
    enlace: "/backoffice/referidos?estado=devoluciones",
  });
  return true;
}

/** ¿El mes en curso de la institución está bonificado? Cuenta como «ya pago» para activar el débito (no se lo cobraría para devolverlo). */
export async function mesBonificado(ejecutor: Pick<EjecutorBo, "select">, institucionId: string, periodo: string): Promise<boolean> {
  const [fila] = await ejecutor
    .select({ id: mesesBonificados.id })
    .from(mesesBonificados)
    .where(and(eq(mesesBonificados.institucionId, institucionId), eq(mesesBonificados.periodo, periodo)))
    .limit(1);
  return !!fila;
}

/** Crea `cantidad` meses bonificados disponibles para quien recomendó (al aplicar el beneficio como «meses»). */
export async function crearMeses(ejecutor: EjecutorBo, institucionId: string, referidoId: string, cantidad: number) {
  if (cantidad < 1) return;
  await ejecutor.insert(mesesBonificados).values(Array.from({ length: cantidad }, () => ({ institucionId, referidoId })));
}

/** Cuántos de los meses de una recomendación ya se gastaron (con eso no se puede deshacer el beneficio). */
export async function mesesUsadosDeReferido(ejecutor: EjecutorBo, referidoId: string): Promise<number> {
  const [{ n } = { n: 0 }] = await ejecutor
    .select({ n: count() })
    .from(mesesBonificados)
    .where(and(eq(mesesBonificados.referidoId, referidoId), isNotNull(mesesBonificados.periodo)));
  return n;
}

/** Borra los meses (todos sin gastar) de una recomendación: al deshacer el beneficio. */
export async function borrarMesesDeReferido(ejecutor: EjecutorBo, referidoId: string) {
  await ejecutor.delete(mesesBonificados).where(and(eq(mesesBonificados.referidoId, referidoId), isNull(mesesBonificados.periodo)));
}

export type ResumenDeMesesDeReferido = { total: number; usados: number };

/** Cuántos meses generó cada recomendación y cuántos ya se gastaron. */
export async function resumenDeMesesPorReferido(ejecutor: EjecutorBo, referidoIds: readonly string[]): Promise<Map<string, ResumenDeMesesDeReferido>> {
  if (referidoIds.length === 0) return new Map();
  const filas = await ejecutor
    .select({
      referidoId: mesesBonificados.referidoId,
      total: count(),
      usados: sql<number>`count(*) filter (where ${mesesBonificados.periodo} is not null)`.mapWith(Number),
    })
    .from(mesesBonificados)
    .where(inArray(mesesBonificados.referidoId, [...referidoIds]))
    .groupBy(mesesBonificados.referidoId);
  return new Map(filas.flatMap((f) => (f.referidoId ? [[f.referidoId, { total: f.total, usados: f.usados }] as const] : [])));
}

export type MesVista = {
  id: string;
  estado: EstadoDeMes;
  /** El mes que se bonificó; null mientras está disponible. */
  periodo: string | null;
  /** La institución cuya recomendación lo generó (null si esa recomendación ya no existe). */
  recomendada: string | null;
  /** Lo que cobró el débito de ese mes, si se gastó sobre un cobro. */
  monto: number | null;
  devueltoEn: Date | null;
  creadoEn: Date;
};

/** Los meses bonificados de una institución: primero los disponibles y después los gastados por mes. */
export async function mesesDe(institucionId: string, ejecutor: EjecutorBo = getDb()): Promise<MesVista[]> {
  const recomendada = alias(instituciones, "recomendada");
  const filas = await ejecutor
    .select({
      id: mesesBonificados.id,
      periodo: mesesBonificados.periodo,
      cobroId: mesesBonificados.cobroId,
      devueltoEn: mesesBonificados.devueltoEn,
      creadoEn: mesesBonificados.creadoEn,
      recomendada: recomendada.nombre,
      monto: cobrosMp.monto,
    })
    .from(mesesBonificados)
    .leftJoin(referidosInstituciones, eq(referidosInstituciones.id, mesesBonificados.referidoId))
    .leftJoin(recomendada, eq(recomendada.id, referidosInstituciones.referidoId))
    .leftJoin(cobrosMp, eq(cobrosMp.id, mesesBonificados.cobroId))
    .where(eq(mesesBonificados.institucionId, institucionId))
    .orderBy(sql`${mesesBonificados.periodo} asc nulls first`, asc(mesesBonificados.creadoEn));
  return filas.map((f) => ({
    id: f.id,
    estado: estadoDeMes(f),
    periodo: f.periodo,
    recomendada: f.recomendada,
    monto: f.cobroId ? f.monto : null,
    devueltoEn: f.devueltoEn,
    creadoEn: f.creadoEn,
  }));
}

export type DevolucionBackoffice = {
  id: string;
  institucion: { id: string; nombre: string };
  periodo: string;
  monto: number | null;
  /** El número del pago en Mercado Pago, para encontrarlo al devolver. */
  pagoId: string | null;
  recomendada: string | null;
  devueltoEn: Date | null;
};

/** Los débitos bonificados que hay que devolver desde Mercado Pago (sin devolver primero) y los que ya se devolvieron. */
export async function listarDevoluciones(ejecutor: EjecutorBo = getDb()): Promise<DevolucionBackoffice[]> {
  const recomendada = alias(instituciones, "recomendada");
  const filas = await ejecutor
    .select({
      id: mesesBonificados.id,
      institucionId: instituciones.id,
      institucion: instituciones.nombre,
      periodo: mesesBonificados.periodo,
      monto: cobrosMp.monto,
      pagoId: cobrosMp.pagoId,
      devueltoEn: mesesBonificados.devueltoEn,
      recomendada: recomendada.nombre,
    })
    .from(mesesBonificados)
    .innerJoin(instituciones, eq(instituciones.id, mesesBonificados.institucionId))
    .leftJoin(cobrosMp, eq(cobrosMp.id, mesesBonificados.cobroId))
    .leftJoin(referidosInstituciones, eq(referidosInstituciones.id, mesesBonificados.referidoId))
    .leftJoin(recomendada, eq(recomendada.id, referidosInstituciones.referidoId))
    .where(isNotNull(mesesBonificados.cobroId))
    .orderBy(sql`${mesesBonificados.devueltoEn} asc nulls first`, desc(mesesBonificados.periodo));
  return filas.flatMap((f) =>
    f.periodo
      ? [
          {
            id: f.id,
            institucion: { id: f.institucionId, nombre: f.institucion },
            periodo: f.periodo,
            monto: f.monto,
            pagoId: f.pagoId,
            recomendada: f.recomendada,
            devueltoEn: f.devueltoEn,
          },
        ]
      : [],
  );
}
