import "server-only";
import { and, asc, eq, gt, isNull, lte, ne, or, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { busquedas, docentes, instituciones, postulaciones, zonas } from "@/db/schema";
import {
  DOCENTES_POR_BUSQUEDA_MINIMO,
  DOCENTES_POR_BUSQUEDA_OK,
  MINIMO_POSTULANTES,
  rangoDelPeriodo,
  type PeriodoClave,
  type RangoPeriodo,
} from "@/lib/backoffice-operacion";
import { MS } from "@/lib/fechas";
import { normalizarTexto } from "@/lib/onboarding";
import { topDocentesPorScoring, type FilaDocenteBo } from "@/lib/queries/backoffice-docentes";

/*
 * "Cómo viene la operación": indicadores del marketplace con consultas reales. Lo que no se puede medir
 * de forma honesta con los datos que hay llega como null y la pantalla muestra "—" con una nota.
 */

/** Una búsqueda sin movimiento después de este tiempo se considera "floja". */
const DIAS_PARA_EMPUJAR = 7;
const ts = (d: Date) => sql`${d.toISOString()}::timestamptz`;
// Calificada: dentro de una subconsulta correlacionada, `id` a secas apuntaría a la tabla de adentro.
const INSTITUCION_ID = sql.raw('"instituciones"."id"');

export type BusquedaFloja = {
  id: string;
  puesto: string;
  institucionId: string;
  institucion: string;
  telefono: string | null;
  zona: string | null;
  dias: number;
  postulantes: number;
};

export type InstitucionEnRiesgo = { id: string; nombre: string };

export type NivelZona = "ok" | "justo" | "falta";
export type ZonaOperacion = { zona: string; docentes: number; busquedas: number; nivel: NivelZona };

export type MetricasOperacion = {
  periodo: RangoPeriodo;
  docentesActivos: { total: number; nuevosEnPeriodo: number; nuevosEnPeriodoAnterior: number };
  /** Promedio entre que se publica una búsqueda y llega su primera postulación; null si ninguna recibió una en el período. */
  primeraPostulacion: { horas: number | null; busquedasMedidas: number };
  busquedasFlojas: BusquedaFloja[];
  institucionesEnRiesgo: InstitucionEnRiesgo[];
  zonas: ZonaOperacion[];
  /** Los partidos del catálogo de zonas: el alcance geográfico que cubre el marketplace. */
  partidos: string[];
  /** Búsquedas abiertas que no se pudieron ubicar en ninguna zona del catálogo. */
  busquedasSinZona: number;
  docentesPorScoring: FilaDocenteBo[];
};

/** Qué partidos del catálogo menciona el texto de zona de una búsqueda ("Villa Adelina, Vicente López"). */
function clavesDeZona(texto: string, catalogo: { nombre: string; partido: string | null }[]) {
  const t = ` ${normalizarTexto(texto)} `;
  const claves = new Set<string>();
  for (const z of catalogo) {
    const clave = z.partido ?? z.nombre;
    if (t.includes(` ${normalizarTexto(z.nombre)} `) || (z.partido && t.includes(` ${normalizarTexto(z.partido)} `))) claves.add(clave);
  }
  return claves;
}

function nivelDeZona(docentesN: number, busquedasN: number): NivelZona {
  if (busquedasN === 0) return "ok";
  const porBusqueda = docentesN / busquedasN;
  if (porBusqueda < DOCENTES_POR_BUSQUEDA_MINIMO) return "falta";
  return porBusqueda < DOCENTES_POR_BUSQUEDA_OK ? "justo" : "ok";
}

export async function metricasOperacion(clave: PeriodoClave): Promise<MetricasOperacion> {
  const db = getDb();
  const ahora = new Date();
  const periodo = rangoDelPeriodo(clave, ahora);
  const { desde, hasta, anteriorDesde } = periodo;
  const haceUnaSemana = new Date(ahora.getTime() - DIAS_PARA_EMPUJAR * MS.DIA);

  const conPostulantes = sql`count(${postulaciones.id}) filter (where ${postulaciones.origen} = 'postulacion')`;

  const [[activos], [primera], flojas, riesgo, docentesPorZona, abiertas, catalogo, top] = await Promise.all([
    db
      .select({
        total: sql<number>`count(*)`.mapWith(Number),
        nuevos: sql<number>`count(*) filter (where ${docentes.creadoEn} >= ${ts(desde)})`.mapWith(Number),
        anterior: sql<number>`count(*) filter (where ${docentes.creadoEn} >= ${ts(anteriorDesde)} and ${docentes.creadoEn} < ${ts(desde)})`.mapWith(Number),
      })
      .from(docentes)
      .where(and(eq(docentes.onboardingCompleto, true), eq(docentes.suspendido, false), ne(docentes.verificacion, "rechazado"))),

    // Si la primera postulación es anterior a la publicación el dato es inconsistente y la búsqueda no entra al promedio.
    db.execute<{ horas: string | null; n: number }>(sql`
      select avg(extract(epoch from (x.primera - x.publicada)) / 3600.0) as horas, count(*)::int as n
      from (
        select b.creado_en as publicada, min(p.creado_en) as primera
        from busquedas b
        join postulaciones p on p.busqueda_id = b.id and p.origen = 'postulacion'
        where b.creado_en >= ${ts(desde)} and b.creado_en < ${ts(hasta)}
        group by b.id
      ) x
      where x.primera >= x.publicada`),

    // Las suplencias rápidas quedan afuera: duran horas o pocos días, el umbral de una semana no les cabe.
    db
      .select({
        id: busquedas.id,
        puesto: busquedas.puesto,
        institucionId: instituciones.id,
        institucion: instituciones.nombre,
        telefono: instituciones.telefono,
        zona: busquedas.zona,
        creadoEn: busquedas.creadoEn,
        postulantes: conPostulantes.mapWith(Number),
      })
      .from(busquedas)
      .innerJoin(instituciones, eq(instituciones.id, busquedas.institucionId))
      .leftJoin(postulaciones, eq(postulaciones.busquedaId, busquedas.id))
      .where(
        and(
          eq(busquedas.estado, "activa"),
          eq(busquedas.rapida, false),
          eq(instituciones.suspendida, false),
          lte(busquedas.creadoEn, haceUnaSemana),
        ),
      )
      .groupBy(busquedas.id, instituciones.id)
      .having(sql`${conPostulantes} < ${MINIMO_POSTULANTES}`)
      .orderBy(asc(busquedas.creadoEn)),

    // Sin actividad = no publicó ninguna búsqueda ni tuvo postulaciones o movimientos de postulantes en el período.
    db
      .select({ id: instituciones.id, nombre: instituciones.nombre })
      .from(instituciones)
      .where(
        and(
          eq(instituciones.suspendida, false),
          sql`not exists (select 1 from busquedas b where b.institucion_id = ${INSTITUCION_ID} and b.creado_en >= ${ts(desde)})`,
          sql`not exists (
            select 1 from busquedas b join postulaciones p on p.busqueda_id = b.id
            where b.institucion_id = ${INSTITUCION_ID} and (p.creado_en >= ${ts(desde)} or p.etapa_desde >= ${ts(desde)}))`,
        ),
      )
      .orderBy(asc(instituciones.nombre)),

    // Un docente cuenta una vez en cada partido donde trabaja.
    db.execute<{ clave: string; n: number }>(sql`
      select coalesce(z.partido, z.nombre) as clave, count(distinct d.id)::int as n
      from docentes d
      join zonas z on z.nombre = any(d.zonas)
      where d.onboarding_completo and not d.suspendido and d.verificacion <> 'rechazado'
      group by 1`),

    db
      .select({ zona: busquedas.zona })
      .from(busquedas)
      .where(
        and(
          eq(busquedas.estado, "activa"),
          or(eq(busquedas.rapida, false), isNull(busquedas.venceEn), gt(busquedas.venceEn, ahora)),
        ),
      ),

    db.select({ nombre: zonas.nombre, partido: zonas.partido }).from(zonas).orderBy(asc(zonas.orden)),

    topDocentesPorScoring(10),
  ]);

  /* Docentes por zona vs búsquedas abiertas: se agrupa por partido, que es como se lee la oferta del mercado. */
  const claves = [...new Set(catalogo.map((z) => z.partido ?? z.nombre))];
  const docentesPor = new Map(Array.from(docentesPorZona).map((r) => [r.clave, Number(r.n)]));
  const busquedasPor = new Map<string, number>();
  let busquedasSinZona = 0;
  for (const b of abiertas) {
    const encontradas = b.zona ? clavesDeZona(b.zona, catalogo) : new Set<string>();
    if (encontradas.size === 0) busquedasSinZona += 1;
    for (const c of encontradas) busquedasPor.set(c, (busquedasPor.get(c) ?? 0) + 1);
  }
  const zonasOperacion = claves
    .map((zona): ZonaOperacion => {
      const d = docentesPor.get(zona) ?? 0;
      const b = busquedasPor.get(zona) ?? 0;
      return { zona, docentes: d, busquedas: b, nivel: nivelDeZona(d, b) };
    })
    .sort((a, b) => b.docentes - a.docentes || a.zona.localeCompare(b.zona, "es"));

  const horas = primera?.horas == null ? null : Number(primera.horas);

  return {
    periodo,
    docentesActivos: {
      total: activos?.total ?? 0,
      nuevosEnPeriodo: activos?.nuevos ?? 0,
      nuevosEnPeriodoAnterior: activos?.anterior ?? 0,
    },
    primeraPostulacion: { horas: horas != null && Number.isFinite(horas) ? horas : null, busquedasMedidas: Number(primera?.n ?? 0) },
    busquedasFlojas: flojas.map((b) => ({
      id: b.id,
      puesto: b.puesto,
      institucionId: b.institucionId,
      institucion: b.institucion,
      telefono: b.telefono,
      zona: b.zona,
      dias: Math.floor((ahora.getTime() - b.creadoEn.getTime()) / MS.DIA),
      postulantes: b.postulantes,
    })),
    institucionesEnRiesgo: riesgo,
    zonas: zonasOperacion,
    partidos: claves,
    busquedasSinZona,
    docentesPorScoring: top,
  };
}
