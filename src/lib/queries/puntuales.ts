import "server-only";
import { and, asc, desc, eq, isNotNull, isNull, lte, ne, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb, transaccion } from "@/db";
import { busquedas, creditosBusqueda, instituciones } from "@/db/schema";
import { resumenDeError } from "@/lib/errores";
import { estadoDeCredito, type EstadoDeCredito } from "@/lib/puntual";
import { avisarAVarios, avisarCierreDeBusqueda } from "@/lib/queries/avisos";
import { destinatariosDeInstitucion } from "@/lib/queries/backoffice-instituciones";
import type { Ejecutor } from "@/lib/queries/pipeline";
import { planes } from "@/lib/queries/planes";

/** Lo que una búsqueda puntual puede no incluir (lo decide el equipo en Planes): la difusión de cursos y el buscador y la base de profesionales. */
export type Beneficio = "cursos" | "buscador";

/**
 * Para las páginas de un beneficio que el plan de la institución puede no incluir: si no lo incluye (la búsqueda puntual sin ese beneficio), la lleva
 * a Plan y facturación, que le explica por qué. Con un plan con abono nunca hace nada.
 */
export async function exigirBeneficio(plan: string, beneficio: Beneficio): Promise<void> {
  const P = await planes();
  if (!P.incluye(plan, beneficio)) redirect(`/institucion/plan?sin=${beneficio}`);
}

/**
 * Lo mismo para una ACCIÓN (invitar, guardar un favorito): no alcanza con esconder el botón, la acción se puede llamar directo. Devuelve el
 * motivo para mostrarle (null si el plan incluye el beneficio, que es siempre el caso con un abono).
 */
export async function motivoSinBeneficio(plan: string, beneficio: Beneficio): Promise<string | null> {
  const P = await planes();
  if (P.incluye(plan, beneficio)) return null;
  return beneficio === "buscador"
    ? "Tu plan de búsqueda puntual no incluye el buscador ni la base de profesionales: son parte del abono mensual."
    : "Tu plan de búsqueda puntual no incluye la difusión de cursos: es parte del abono mensual.";
}

/*
 * Búsquedas puntuales pagadas (tabla `creditos_busqueda`, ver src/db/schema.ts y las reglas puras en src/lib/puntual.ts). Una fila es UNA
 * búsqueda pagada: disponible mientras `usado_en` es null, consumida al publicar, y su búsqueda se cierra sola al vencer (`cerrarPuntualesVencidas`,
 * en el cron diario: la vigencia de una búsqueda está repartida en muchas consultas, así que no se toca; se cierra y listo).
 */

/** Cuántas búsquedas pagadas tiene disponibles una institución y cuántas búsquedas puntuales tiene abiertas hoy. */
export async function saldoDeBusquedas(ejecutor: Ejecutor, institucionId: string): Promise<{ disponibles: number; abiertas: number }> {
  const [fila] = await ejecutor
    .select({
      disponibles: sql<number>`count(*) filter (where ${creditosBusqueda.usadoEn} is null)`.mapWith(Number),
      abiertas: sql<number>`count(*) filter (where ${creditosBusqueda.usadoEn} is not null and ${creditosBusqueda.venceEn} > now() and ${busquedas.id} is not null and ${busquedas.estado} <> 'cerrada')`.mapWith(
        Number,
      ),
    })
    .from(creditosBusqueda)
    .leftJoin(busquedas, eq(busquedas.id, creditosBusqueda.busquedaId))
    .where(eq(creditosBusqueda.institucionId, institucionId));
  return { disponibles: fila?.disponibles ?? 0, abiertas: fila?.abiertas ?? 0 };
}

export type CreditoVista = {
  id: string;
  monto: number;
  medio: string;
  pagadoEn: Date;
  nota: string | null;
  usadoEn: Date | null;
  venceEn: Date | null;
  estado: EstadoDeCredito;
  /** La búsqueda que la consumió, si sigue existiendo. */
  busqueda: { id: string; puesto: string } | null;
};

/** Las búsquedas que pagó una institución, de la más nueva a la más vieja, con en qué está cada una. */
export async function creditosDe(ejecutor: Ejecutor, institucionId: string, ahora = new Date()): Promise<CreditoVista[]> {
  const filas = await ejecutor
    .select({
      id: creditosBusqueda.id,
      monto: creditosBusqueda.monto,
      medio: creditosBusqueda.medio,
      pagadoEn: creditosBusqueda.pagadoEn,
      nota: creditosBusqueda.nota,
      usadoEn: creditosBusqueda.usadoEn,
      venceEn: creditosBusqueda.venceEn,
      busquedaId: busquedas.id,
      puesto: busquedas.puesto,
      busquedaEstado: busquedas.estado,
    })
    .from(creditosBusqueda)
    .leftJoin(busquedas, eq(busquedas.id, creditosBusqueda.busquedaId))
    .where(eq(creditosBusqueda.institucionId, institucionId))
    .orderBy(desc(creditosBusqueda.pagadoEn), desc(creditosBusqueda.creadoEn));
  return filas.map((f) => ({
    id: f.id,
    monto: f.monto,
    medio: f.medio,
    pagadoEn: f.pagadoEn,
    nota: f.nota,
    usadoEn: f.usadoEn,
    venceEn: f.venceEn,
    estado: estadoDeCredito({ usadoEn: f.usadoEn, venceEn: f.venceEn, busquedaEstado: f.busquedaEstado }, ahora),
    busqueda: f.busquedaId && f.puesto ? { id: f.busquedaId, puesto: f.puesto } : null,
  }));
}

/**
 * Consume la búsqueda pagada disponible más vieja de la institución con la búsqueda que se acaba de publicar (dentro de la misma transacción).
 * Devuelve false si no había ninguna: la publicación se tiene que deshacer. `skip locked` evita que dos publicaciones a la vez usen la misma.
 */
export async function consumirCredito(tx: Ejecutor, institucionId: string, busquedaId: string, venceEn: Date): Promise<boolean> {
  const [libre] = await tx
    .select({ id: creditosBusqueda.id })
    .from(creditosBusqueda)
    .where(and(eq(creditosBusqueda.institucionId, institucionId), isNull(creditosBusqueda.usadoEn)))
    .orderBy(asc(creditosBusqueda.pagadoEn), asc(creditosBusqueda.creadoEn))
    .limit(1)
    .for("update", { skipLocked: true });
  if (!libre) return false;
  await tx.update(creditosBusqueda).set({ busquedaId, usadoEn: new Date(), venceEn }).where(eq(creditosBusqueda.id, libre.id));
  return true;
}

/** Cuándo vence la búsqueda puntual con ese id, o null si no es una (o no existe). Lo usa «Reabrir» para no regalar una búsqueda ya vencida. */
export async function vencimientoDePuntual(ejecutor: Ejecutor, busquedaId: string): Promise<{ esPuntual: boolean; venceEn: Date | null }> {
  const [fila] = await ejecutor
    .select({ venceEn: creditosBusqueda.venceEn })
    .from(creditosBusqueda)
    .where(and(eq(creditosBusqueda.busquedaId, busquedaId), isNotNull(creditosBusqueda.usadoEn)))
    .limit(1);
  return { esPuntual: !!fila, venceEn: fila?.venceEn ?? null };
}

export type ResultadoDeCierre = { cerradas: number; fallidas: number };

/**
 * Cierra las búsquedas puntuales cuyo plazo ya pasó (las publicadas con una búsqueda pagada) y les avisa: a quienes se habían postulado (el mismo
 * aviso de cualquier cierre, en la campanita) y a la institución. Corre en el cron diario; cada búsqueda va en su transacción y nunca lanza: lo que
 * falle queda en el log y se reintenta mañana. Idempotente: una ya cerrada no se vuelve a tocar.
 */
export async function cerrarPuntualesVencidas(ahora = new Date()): Promise<ResultadoDeCierre> {
  const resultado: ResultadoDeCierre = { cerradas: 0, fallidas: 0 };
  try {
    const vencidas = await getDb()
      .select({
        busquedaId: busquedas.id,
        puesto: busquedas.puesto,
        institucionId: instituciones.id,
        institucionNombre: instituciones.nombre,
      })
      .from(creditosBusqueda)
      .innerJoin(busquedas, eq(busquedas.id, creditosBusqueda.busquedaId))
      .innerJoin(instituciones, eq(instituciones.id, busquedas.institucionId))
      .where(and(isNotNull(creditosBusqueda.usadoEn), lte(creditosBusqueda.venceEn, ahora), ne(busquedas.estado, "cerrada")));

    for (const v of vencidas) {
      try {
        await transaccion(async (tx) => {
          const cerrada = await tx
            .update(busquedas)
            .set({ estado: "cerrada", cerradaEn: ahora })
            .where(and(eq(busquedas.id, v.busquedaId), ne(busquedas.estado, "cerrada")))
            .returning({ id: busquedas.id });
          if (cerrada.length === 0) return;
          await avisarCierreDeBusqueda(tx, { busquedaId: v.busquedaId, puesto: v.puesto, institucionNombre: v.institucionNombre });
          await avisarAVarios(tx, await destinatariosDeInstitucion(tx, v.institucionId), {
            tipo: "sistema",
            titulo: "UNIDOAR",
            texto: `tu búsqueda puntual «${v.puesto}» cumplió su plazo y se cerró. Si necesitás otra, abonala y publicala.`,
            enlace: "/institucion/plan",
          });
          resultado.cerradas++;
        });
      } catch (e) {
        resultado.fallidas++;
        console.error("No se pudo cerrar una búsqueda puntual vencida", resumenDeError(e));
      }
    }
  } catch (e) {
    console.error("No se pudieron revisar las búsquedas puntuales vencidas", resumenDeError(e));
  }
  return resultado;
}
