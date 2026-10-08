import "server-only";
import { and, asc, count, desc, eq, gte, inArray, ne, or, sql, type SQL } from "drizzle-orm";
import { getDb } from "@/db";
import {
  asignaturas,
  busquedas,
  docentes,
  institucionMiembros,
  postulaciones,
  type CategoriaDocente,
} from "@/db/schema";
import { metaDeBusqueda, type EstadoFiltro } from "@/lib/busquedas";
import { diasEntre, duracionLegible, haceTiempo, inicioDeAnio, MS, plazoLegible } from "@/lib/fechas";
import { contiene } from "@/lib/sql-texto";

/** Una búsqueda con el resumen de su pipeline, lista para tablas y tarjetas. */
export type BusquedaItem = {
  id: string;
  puesto: string;
  categoria: CategoriaDocente;
  disciplina: string;
  rapida: boolean;
  estado: "activa" | "pausada" | "cerrada";
  zona: string | null;
  /** "Titular · 18 hs semanales · turno mañana" */
  meta: string;
  /** "hace 2 días" */
  publicada: string;
  edadDias: number;
  creadoEn: Date;
  cerradaEn: Date | null;
  /** Postulantes vigentes (sin descartados). */
  postulantes: number;
  nuevos: number;
  enEntrevista: number;
  contratados: number;
  /** Solo rápidas: "Vence en 18 hs". */
  plazo: { texto: string; vencida: boolean } | null;
  /** Solo cerradas: nombre de quien se contrató y cuánto tardó. */
  docenteContratado: string | null;
  duracion: string | null;
};

const conteos = {
  postulantes: sql<number>`count(${postulaciones.id}) filter (where ${postulaciones.etapa} <> 'descartado')`.mapWith(Number),
  nuevos: sql<number>`count(${postulaciones.id}) filter (where ${postulaciones.etapa} = 'nuevos')`.mapWith(Number),
  enEntrevista: sql<number>`count(${postulaciones.id}) filter (where ${postulaciones.etapa} = 'entrevista')`.mapWith(Number),
  contratados: sql<number>`count(${postulaciones.id}) filter (where ${postulaciones.etapa} = 'contratado')`.mapWith(Number),
};

/** Búsquedas de la institución con sus conteos, para la lista de Publicaciones y el dashboard. */
export async function listarBusquedas(
  institucionId: string,
  { pestana, q, estado = "todos", limite }: { pestana: "activas" | "cerradas"; q?: string; estado?: EstadoFiltro; limite?: number },
): Promise<BusquedaItem[]> {
  const db = getDb();
  const ahora = new Date();
  const cond: (SQL | undefined)[] = [
    eq(busquedas.institucionId, institucionId),
    pestana === "activas" ? ne(busquedas.estado, "cerrada") : eq(busquedas.estado, "cerrada"),
  ];
  if (pestana === "activas") {
    if (estado === "activa") cond.push(eq(busquedas.estado, "activa"), eq(busquedas.rapida, false));
    if (estado === "rapida") cond.push(eq(busquedas.rapida, true));
    if (estado === "pausada") cond.push(eq(busquedas.estado, "pausada"));
  }
  const texto = q?.trim();
  if (texto) {
    cond.push(
      or(
        contiene(busquedas.puesto, texto),
        contiene(busquedas.disciplina, texto),
        sql`exists (
          select 1 from postulaciones pq join docentes dq on dq.id = pq.docente_id
          where pq.busqueda_id = ${busquedas.id} and ${contiene(sql`(dq.nombre || ' ' || dq.apellido)`, texto)}
        )`,
      ),
    );
  }

  const consulta = db
    .select({ b: busquedas, ...conteos })
    .from(busquedas)
    .leftJoin(postulaciones, eq(postulaciones.busquedaId, busquedas.id))
    .where(and(...cond))
    .groupBy(busquedas.id)
    .orderBy(pestana === "activas" ? desc(busquedas.creadoEn) : sql`${busquedas.cerradaEn} desc nulls last`);
  const filas = await (limite ? consulta.limit(limite) : consulta);

  const nombres = new Map<string, string>();
  if (pestana === "cerradas" && filas.length) {
    const contratados = await db
      .select({
        busquedaId: postulaciones.busquedaId,
        nombres: sql<string>`string_agg(${docentes.nombre} || ' ' || ${docentes.apellido}, ', ' order by ${postulaciones.etapaDesde})`,
      })
      .from(postulaciones)
      .innerJoin(docentes, eq(docentes.id, postulaciones.docenteId))
      .where(and(inArray(postulaciones.busquedaId, filas.map((f) => f.b.id)), eq(postulaciones.etapa, "contratado")))
      .groupBy(postulaciones.busquedaId);
    for (const c of contratados) nombres.set(c.busquedaId, c.nombres.trim());
  }

  return filas.map(({ b, ...n }) => ({
    id: b.id,
    puesto: b.puesto,
    categoria: b.categoria,
    disciplina: b.disciplina,
    rapida: b.rapida,
    estado: b.estado,
    zona: b.zona,
    meta: metaDeBusqueda(b),
    publicada: haceTiempo(b.creadoEn, ahora),
    edadDias: diasEntre(b.creadoEn, ahora),
    creadoEn: b.creadoEn,
    cerradaEn: b.cerradaEn,
    ...n,
    plazo: b.rapida && b.venceEn && b.estado !== "cerrada" ? plazoLegible(b.venceEn, ahora) : null,
    docenteContratado: nombres.get(b.id) ?? null,
    duracion: b.cerradaEn ? duracionLegible(b.creadoEn, b.cerradaEn) : null,
  }));
}

export type EstadisticasInstitucion = {
  totalBusquedas: number;
  activas: number;
  cerradas: number;
  rapidas: number;
  pausadas: number;
  /** Búsquedas abiertas publicadas en los últimos 7 días. */
  nuevasEstaSemana: number;
  /** Postulantes de las búsquedas abiertas, por etapa. */
  nuevos: number;
  enProceso: number;
  entrevistas: number;
  ofertas: number;
  entrevistasAgendadas: number;
  proximaEntrevista: Date | null;
  contratadosAnio: number;
  /** "4 titulares, 3 suplencias" */
  contratadosDetalle: string;
  /** Cerradas en las que hubo al menos una contratación. */
  cerradasConContratacion: number;
};

const PLURAL_TIPO: Record<string, string> = {
  Titular: "titulares",
  Suplencia: "suplencias",
  Temporada: "de temporada",
  Freelance: "freelance",
};

/** Los COUNTs del dashboard y de las métricas de Publicaciones. */
export async function estadisticasInstitucion(institucionId: string): Promise<EstadisticasInstitucion> {
  const db = getDb();
  const ahora = new Date();
  const haceSemana = new Date(ahora.getTime() - 7 * MS.DIA);
  const abierta = and(eq(busquedas.institucionId, institucionId), ne(busquedas.estado, "cerrada"));

  const [[b], [p], tipos, [cc]] = await Promise.all([
    db
      .select({
        total: count(),
        activas: sql<number>`count(*) filter (where ${busquedas.estado} <> 'cerrada')`.mapWith(Number),
        cerradas: sql<number>`count(*) filter (where ${busquedas.estado} = 'cerrada')`.mapWith(Number),
        rapidas: sql<number>`count(*) filter (where ${busquedas.estado} <> 'cerrada' and ${busquedas.rapida})`.mapWith(Number),
        pausadas: sql<number>`count(*) filter (where ${busquedas.estado} = 'pausada')`.mapWith(Number),
        semana: sql<number>`count(*) filter (where ${busquedas.estado} <> 'cerrada' and ${gte(busquedas.creadoEn, haceSemana)})`.mapWith(Number),
      })
      .from(busquedas)
      .where(eq(busquedas.institucionId, institucionId)),
    db
      .select({
        nuevos: sql<number>`count(*) filter (where ${postulaciones.etapa} = 'nuevos')`.mapWith(Number),
        enProceso: sql<number>`count(*) filter (where ${postulaciones.etapa} in ('nuevos', 'preseleccionados', 'entrevista', 'oferta', 'examen_preocupacional'))`.mapWith(Number),
        entrevistas: sql<number>`count(*) filter (where ${postulaciones.etapa} = 'entrevista')`.mapWith(Number),
        ofertas: sql<number>`count(*) filter (where ${postulaciones.etapa} = 'oferta')`.mapWith(Number),
        agendadas: sql<number>`count(*) filter (where ${postulaciones.etapa} = 'entrevista' and ${postulaciones.entrevistaEn} >= now())`.mapWith(Number),
        proxima: sql<Date | null>`min(${postulaciones.entrevistaEn}) filter (where ${postulaciones.etapa} = 'entrevista' and ${postulaciones.entrevistaEn} >= now())`.mapWith(
          postulaciones.entrevistaEn,
        ),
      })
      .from(postulaciones)
      .innerJoin(busquedas, eq(busquedas.id, postulaciones.busquedaId))
      .where(abierta),
    db
      .select({ tipo: busquedas.tipo, n: count() })
      .from(postulaciones)
      .innerJoin(busquedas, eq(busquedas.id, postulaciones.busquedaId))
      .where(
        and(
          eq(busquedas.institucionId, institucionId),
          eq(postulaciones.etapa, "contratado"),
          gte(postulaciones.etapaDesde, inicioDeAnio(ahora)),
        ),
      )
      .groupBy(busquedas.tipo)
      .orderBy(desc(count())),
    db
      .select({ n: sql<number>`count(distinct ${busquedas.id})`.mapWith(Number) })
      .from(busquedas)
      .innerJoin(postulaciones, eq(postulaciones.busquedaId, busquedas.id))
      .where(
        and(eq(busquedas.institucionId, institucionId), eq(busquedas.estado, "cerrada"), eq(postulaciones.etapa, "contratado")),
      ),
  ]);

  const contratadosAnio = tipos.reduce((suma, t) => suma + t.n, 0);
  return {
    totalBusquedas: b?.total ?? 0,
    activas: b?.activas ?? 0,
    cerradas: b?.cerradas ?? 0,
    rapidas: b?.rapidas ?? 0,
    pausadas: b?.pausadas ?? 0,
    nuevasEstaSemana: b?.semana ?? 0,
    nuevos: p?.nuevos ?? 0,
    enProceso: p?.enProceso ?? 0,
    entrevistas: p?.entrevistas ?? 0,
    ofertas: p?.ofertas ?? 0,
    entrevistasAgendadas: p?.agendadas ?? 0,
    proximaEntrevista: p?.proxima ?? null,
    contratadosAnio,
    contratadosDetalle: tipos.map((t) => `${t.n} ${PLURAL_TIPO[t.tipo] ?? t.tipo.toLowerCase()}`).join(", "),
    cerradasConContratacion: cc?.n ?? 0,
  };
}

/** La búsqueda, solo si es de la institución. Es la verificación de propiedad de todas las acciones. */
export async function busquedaPropia(institucionId: string, busquedaId: string) {
  const [fila] = await getDb()
    .select()
    .from(busquedas)
    .where(and(eq(busquedas.id, busquedaId), eq(busquedas.institucionId, institucionId)))
    .limit(1);
  return fila ?? null;
}

/** Catálogo de disciplinas para el formulario de publicar: categoría → rubros → asignaturas. */
export async function asignaturasPorCategoria() {
  const filas = await getDb().select().from(asignaturas).orderBy(asc(asignaturas.categoria), asc(asignaturas.orden));
  const out: Record<CategoriaDocente, { rubro: string; items: string[] }[]> = {
    educador: [],
    entrenador: [],
    guardavidas: [],
  };
  for (const f of filas) {
    const grupos = out[f.categoria];
    const grupo = grupos.find((g) => g.rubro === f.rubro);
    if (grupo) grupo.items.push(f.nombre);
    else grupos.push({ rubro: f.rubro, items: [f.nombre] });
  }
  return out;
}

/** Cuántas personas del equipo, además de quien creó la cuenta, tienen acceso o fueron invitadas. */
export async function integrantesDeEquipo(institucionId: string) {
  const [fila] = await getDb()
    .select({ n: count() })
    .from(institucionMiembros)
    .where(and(eq(institucionMiembros.institucionId, institucionId), ne(institucionMiembros.rol, "dueno")));
  return fila?.n ?? 0;
}
