import "server-only";
import { and, asc, count, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { asignaturas, busquedas, docentes, type CategoriaDocente } from "@/db/schema";
import { CATEGORIAS } from "@/lib/catalogo";
import type { EjecutorBo } from "@/lib/queries/backoffice-instituciones";

/*
 * Catálogo de asignaturas (categoría → rubro → asignatura) para el ABM del backoffice. Las asignaturas se
 * guardan como texto en `docentes.asignaturas` y `busquedas.disciplina`: por eso renombrar o borrar una
 * pasa por acá, que sabe cuántas filas la usan y las actualiza en la misma transacción.
 */

export type UsoAsignatura = { docentes: number; busquedasActivas: number; busquedasTotal: number };

export type AsignaturaFila = { id: string; nombre: string; orden: number } & UsoAsignatura;
export type RubroGrupo = { rubro: string; asignaturas: AsignaturaFila[] };

export type ResumenCategoria = { categoria: CategoriaDocente; rubros: number; asignaturas: number };

/** Cuántas asignaturas y rubros tiene cada categoría (el menú de la izquierda). */
export async function resumenDeCategorias(): Promise<ResumenCategoria[]> {
  const filas = await getDb()
    .select({
      categoria: asignaturas.categoria,
      rubros: sql<number>`count(distinct ${asignaturas.rubro})`.mapWith(Number),
      asignaturas: count(),
    })
    .from(asignaturas)
    .groupBy(asignaturas.categoria);
  return CATEGORIAS.map((c) => filas.find((f) => f.categoria === c) ?? { categoria: c, rubros: 0, asignaturas: 0 });
}

export type CatalogoCategoria = {
  rubros: RubroGrupo[];
  /** Docentes con perfil en la categoría y búsquedas activas de la categoría. */
  docentes: number;
  busquedasActivas: number;
};

/** Todas las asignaturas de una categoría agrupadas por rubro (en el orden en que se muestran), con su uso. */
export async function catalogoDeCategoria(categoria: CategoriaDocente): Promise<CatalogoCategoria> {
  const db = getDb();
  const [filas, [[perfiles], [ofertas]]] = await Promise.all([
    db.execute<{
      id: string;
      rubro: string;
      nombre: string;
      orden: number;
      docentes: number;
      busquedas_total: number;
      busquedas_activas: number;
    }>(sql`
      select a.id, a.rubro, a.nombre, a.orden,
        (select count(*)::int from docentes d where d.categoria = a.categoria and a.nombre = any(d.asignaturas)) as docentes,
        (select count(*)::int from busquedas b where b.categoria = a.categoria and b.disciplina = a.nombre) as busquedas_total,
        (select count(*)::int from busquedas b where b.categoria = a.categoria and b.disciplina = a.nombre and b.estado = 'activa') as busquedas_activas
      from asignaturas a
      where a.categoria = ${categoria}
      order by a.orden asc, a.rubro asc, a.nombre asc`),
    Promise.all([
      db
        .select({ n: count() })
        .from(docentes)
        .where(and(eq(docentes.categoria, categoria), eq(docentes.onboardingCompleto, true))),
      db
        .select({ n: count() })
        .from(busquedas)
        .where(and(eq(busquedas.categoria, categoria), eq(busquedas.estado, "activa"))),
    ]),
  ]);

  const grupos: RubroGrupo[] = [];
  for (const f of Array.from(filas)) {
    let grupo = grupos.find((g) => g.rubro === f.rubro);
    if (!grupo) {
      grupo = { rubro: f.rubro, asignaturas: [] };
      grupos.push(grupo);
    }
    grupo.asignaturas.push({
      id: f.id,
      nombre: f.nombre,
      orden: Number(f.orden),
      docentes: Number(f.docentes),
      busquedasActivas: Number(f.busquedas_activas),
      busquedasTotal: Number(f.busquedas_total),
    });
  }
  return { rubros: grupos, docentes: perfiles?.n ?? 0, busquedasActivas: ofertas?.n ?? 0 };
}

/** Una asignatura del catálogo (el id llega del cliente: las acciones siempre pasan por acá). */
export async function asignaturaPorId(ejecutor: EjecutorBo, id: string) {
  const [fila] = await ejecutor.select().from(asignaturas).where(eq(asignaturas.id, id)).limit(1);
  return fila ?? null;
}

/** Cuántos docentes y búsquedas usan hoy el texto de esta asignatura (dentro de su categoría). */
export async function usoDeAsignatura(
  ejecutor: EjecutorBo,
  categoria: CategoriaDocente,
  nombre: string,
): Promise<UsoAsignatura> {
  const [[d], [b]] = await Promise.all([
    ejecutor
      .select({ n: count() })
      .from(docentes)
      .where(and(eq(docentes.categoria, categoria), sql`${nombre} = any(${docentes.asignaturas})`)),
    ejecutor
      .select({
        total: count(),
        activas: sql<number>`count(*) filter (where ${busquedas.estado} = 'activa')`.mapWith(Number),
      })
      .from(busquedas)
      .where(and(eq(busquedas.categoria, categoria), eq(busquedas.disciplina, nombre))),
  ]);
  return { docentes: d?.n ?? 0, busquedasActivas: b?.activas ?? 0, busquedasTotal: b?.total ?? 0 };
}

/** Todas las asignaturas de la categoría (para chequear nombres repetidos y calcular el orden). */
export async function asignaturasDeCategoria(ejecutor: EjecutorBo, categoria: CategoriaDocente) {
  return ejecutor
    .select({ id: asignaturas.id, rubro: asignaturas.rubro, nombre: asignaturas.nombre, orden: asignaturas.orden })
    .from(asignaturas)
    .where(eq(asignaturas.categoria, categoria))
    .orderBy(asc(asignaturas.orden), asc(asignaturas.nombre));
}

/**
 * Cambia el texto de una asignatura en perfiles docentes y búsquedas de su categoría, sin dejar duplicados
 * en el arreglo del docente (si ya tenía el nombre nuevo, queda una sola vez, en la primera posición).
 */
export async function propagarRenombre(
  tx: EjecutorBo,
  categoria: CategoriaDocente,
  de: string,
  a: string,
): Promise<UsoAsignatura> {
  const perfiles = await tx
    .update(docentes)
    .set({
      asignaturas: sql`(
        select coalesce(array_agg(x order by pos), '{}'::text[])
        from (
          select x, min(pos) as pos
          from unnest(array_replace(${docentes.asignaturas}, ${de}, ${a})) with ordinality as t(x, pos)
          group by x
        ) s)`,
    })
    .where(and(eq(docentes.categoria, categoria), sql`${de} = any(${docentes.asignaturas})`))
    .returning({ id: docentes.id });

  const ofertas = await tx
    .update(busquedas)
    .set({ disciplina: a })
    .where(and(eq(busquedas.categoria, categoria), eq(busquedas.disciplina, de)))
    .returning({ estado: busquedas.estado });

  return {
    docentes: perfiles.length,
    busquedasTotal: ofertas.length,
    busquedasActivas: ofertas.filter((o) => o.estado === "activa").length,
  };
}
