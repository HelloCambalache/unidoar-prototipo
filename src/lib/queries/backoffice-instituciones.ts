import "server-only";
import { and, asc, count, desc, eq, isNotNull, isNull, or, sql, type SQL } from "drizzle-orm";
import { getDb } from "@/db";
import { auditoria, busquedas, facturas, institucionMiembros, instituciones, usuarios } from "@/db/schema";
import {
  POR_PAGINA_INSTITUCIONES,
  type FiltrosInstituciones,
} from "@/lib/backoffice-instituciones";
import { estadoEfectivo, hoyAR } from "@/lib/cobros";
import { bajaSolicitadaEn } from "@/lib/queries/cuenta";
import { sedesDeInstitucion } from "@/lib/queries/sedes";
import type { SedeVista } from "@/lib/sedes";
import { contiene } from "@/lib/sql-texto";

/*
 * Lecturas del backoffice de instituciones. Traen datos de contacto y de facturación: solo se llaman
 * desde páginas bajo /backoffice (el layout exige rol admin) y nunca se cachean.
 */

type Db = ReturnType<typeof getDb>;
/** La base o una transacción: las acciones pasan `tx` para que el cambio, la auditoría y los avisos sean atómicos. */
export type EjecutorBo = Pick<Db, "select" | "insert" | "update" | "delete" | "execute">;

/* Las subconsultas necesitan la columna calificada: Drizzle la deja sin calificar en un select de una sola tabla. */
const INST_ID = sql.raw('"instituciones"."id"');

const cuenta = (consulta: SQL) => sql<number>`(${consulta})`.mapWith(Number);

/** Instituciones con al menos una factura vencida (guardada como tal o pendiente con la fecha ya pasada). */
const conPagoVencido = (hoy: string) => sql`exists (
  select 1 from facturas f
  where f.institucion_id = ${INST_ID}
    and (f.estado = 'vencida' or (f.estado = 'pendiente' and f.fecha_cobro < ${hoy}::date)))`;

/* ───────────────────────────── Listado ───────────────────────────── */

export type FilaInstitucion = {
  id: string;
  nombre: string;
  tipo: string;
  zona: string | null;
  /** Cuántas sedes tiene. */
  sedes: number;
  plan: string;
  verificada: boolean;
  suspendida: boolean;
  /** Se procesó su baja: queda solo el registro fiscal. */
  deBaja: boolean;
  pagoVencido: boolean;
  busquedasTotal: number;
  busquedasActivas: number;
  postulaciones: number;
  contrataciones: number;
};

export type ListadoInstituciones = { filas: FilaInstitucion[]; total: number; pagina: number; paginas: number };

export async function listarInstituciones(f: FiltrosInstituciones): Promise<ListadoInstituciones> {
  const db = getDb();
  const hoy = hoyAR();

  const condiciones: SQL[] = [];
  for (const palabra of f.q.split(/\s+/).filter(Boolean).slice(0, 6)) {
    condiciones.push(
      or(
        contiene(instituciones.nombre, palabra),
        contiene(instituciones.tipo, palabra),
        contiene(sql`coalesce(${instituciones.zona}, '')`, palabra),
        contiene(sql`coalesce(${instituciones.partido}, '')`, palabra),
        // La zona o el partido de cualquiera de sus sedes (la ficha refleja solo a la principal).
        sql`exists (select 1 from institucion_sedes s where s.institucion_id = ${instituciones.id} and (${contiene(sql`coalesce(s.zona, '')`, palabra)} or ${contiene(sql`coalesce(s.partido, '')`, palabra)}))`,
        contiene(sql`coalesce(${instituciones.cuit}, '')`, palabra),
      )!,
    );
  }
  if (f.tipo) condiciones.push(eq(instituciones.tipo, f.tipo));
  if (f.plan) condiciones.push(eq(instituciones.plan, f.plan));
  if (f.verificacion) condiciones.push(eq(instituciones.verificada, f.verificacion === "si"));
  if (f.estado === "activa") condiciones.push(eq(instituciones.suspendida, false));
  // Una dada de baja siempre está suspendida, pero no es lo mismo: tiene su propio estado.
  if (f.estado === "suspendida") condiciones.push(eq(instituciones.suspendida, true), isNull(instituciones.bajaEn));
  if (f.estado === "baja") condiciones.push(isNotNull(instituciones.bajaEn));
  if (f.estado === "vencida") condiciones.push(conPagoVencido(hoy));
  const donde = condiciones.length ? and(...condiciones) : undefined;

  const [{ n: total }] = await db.select({ n: count() }).from(instituciones).where(donde);
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA_INSTITUCIONES));
  const pagina = Math.min(f.pagina, paginas);

  const busquedasActivas = cuenta(
    sql`select count(*) from busquedas b where b.institucion_id = ${INST_ID} and b.estado = 'activa'`,
  ).as("busquedas_activas");
  const orden =
    f.orden === "busquedas"
      ? [desc(busquedasActivas), asc(instituciones.nombre)]
      : f.orden === "recientes"
        ? [desc(instituciones.creadoEn), asc(instituciones.nombre)]
        : [asc(instituciones.nombre)];

  const filas = await db
    .select({
      id: instituciones.id,
      nombre: instituciones.nombre,
      tipo: instituciones.tipo,
      zona: instituciones.zona,
      sedes: cuenta(sql`select count(*) from institucion_sedes s where s.institucion_id = ${INST_ID}`).as("sedes"),
      plan: instituciones.plan,
      verificada: instituciones.verificada,
      suspendida: instituciones.suspendida,
      deBaja: sql<boolean>`${instituciones.bajaEn} is not null`.mapWith(Boolean).as("de_baja"),
      pagoVencido: sql<boolean>`${conPagoVencido(hoy)}`.mapWith(Boolean).as("pago_vencido"),
      busquedasTotal: cuenta(sql`select count(*) from busquedas b where b.institucion_id = ${INST_ID}`).as(
        "busquedas_total",
      ),
      busquedasActivas,
      postulaciones: cuenta(
        sql`select count(*) from postulaciones p join busquedas b on b.id = p.busqueda_id where b.institucion_id = ${INST_ID}`,
      ).as("postulaciones"),
      contrataciones: cuenta(
        sql`select count(*) from postulaciones p join busquedas b on b.id = p.busqueda_id
            where b.institucion_id = ${INST_ID} and p.etapa = 'contratado'`,
      ).as("contrataciones"),
    })
    .from(instituciones)
    .where(donde)
    .orderBy(...orden)
    .limit(POR_PAGINA_INSTITUCIONES)
    .offset((pagina - 1) * POR_PAGINA_INSTITUCIONES);

  return { filas, total, pagina, paginas };
}

/** Cuántas instituciones hay en total (el subtítulo de la lista no depende de los filtros). */
export async function totalInstituciones() {
  const [{ n }] = await getDb().select({ n: count() }).from(instituciones);
  return n;
}

/* ───────────────────────────── Ficha ───────────────────────────── */

export type FichaInstitucion = {
  institucion: typeof instituciones.$inferSelect;
  /** Email de la cuenta propietaria (null en instituciones de ejemplo sin cuenta). */
  emailPropietario: string | null;
  /** Todas sus sedes, la principal primero (el equipo ve también el CUE). */
  sedes: SedeVista[];
  equipo: { id: string; nombre: string | null; email: string; rol: string; estado: string }[];
  busquedas: {
    id: string;
    puesto: string;
    tipo: string;
    rapida: boolean;
    estado: "activa" | "pausada" | "cerrada";
    postulantes: number;
  }[];
  busquedasTotal: number;
  busquedasActivas: number;
  postulaciones: number;
  contrataciones: number;
  facturas: { id: string; periodo: string; plan: string; monto: number; fechaCobro: string; estado: ReturnType<typeof estadoEfectivo>; medio: string | null }[];
  /** La factura impaga más cercana en el tiempo. */
  proximoCobro: { periodo: string; monto: number; fechaCobro: string; estado: ReturnType<typeof estadoEfectivo> } | null;
  /** Motivo de la última suspensión (de la auditoría), mientras la cuenta siga suspendida. */
  motivoSuspension: { motivo: string; nota: string | null; cuando: Date } | null;
  /** Cuándo pidió la baja la institución, si el pedido sigue en pie. */
  bajaSolicitadaEn: Date | null;
  actividad: { id: string; accion: string; detalle: Record<string, unknown> | null; cuando: Date; quien: string | null }[];
};

export async function fichaInstitucion(id: string): Promise<FichaInstitucion | null> {
  const db = getDb();
  const [fila] = await db
    .select({ institucion: instituciones, emailPropietario: usuarios.email })
    .from(instituciones)
    .leftJoin(usuarios, eq(usuarios.id, instituciones.propietarioId))
    .where(eq(instituciones.id, id))
    .limit(1);
  if (!fila) return null;
  const { institucion } = fila;
  const hoy = hoyAR();

  const [equipo, listaBusquedas, [totales], listaFacturas, actividad, [suspension], baja, sedes] = await Promise.all([
    db
      .select({
        id: institucionMiembros.id,
        nombre: institucionMiembros.nombre,
        email: institucionMiembros.email,
        rol: institucionMiembros.rol,
        estado: institucionMiembros.estado,
      })
      .from(institucionMiembros)
      .where(eq(institucionMiembros.institucionId, id))
      .orderBy(asc(institucionMiembros.creadoEn)),
    db
      .select({
        id: busquedas.id,
        puesto: busquedas.puesto,
        tipo: busquedas.tipo,
        rapida: busquedas.rapida,
        estado: busquedas.estado,
        postulantes: cuenta(sql`select count(*) from postulaciones p where p.busqueda_id = "busquedas"."id"`).as("postulantes"),
      })
      .from(busquedas)
      .where(eq(busquedas.institucionId, id))
      .orderBy(sql`(${busquedas.estado} = 'cerrada')`, desc(busquedas.creadoEn))
      .limit(50),
    db
      .select({
        busquedasTotal: sql<number>`count(distinct ${busquedas.id})`.mapWith(Number),
        busquedasActivas: sql<number>`count(distinct ${busquedas.id}) filter (where ${busquedas.estado} = 'activa')`.mapWith(Number),
        postulaciones: sql<number>`(select count(*) from postulaciones p join busquedas b on b.id = p.busqueda_id where b.institucion_id = ${id})`.mapWith(Number),
        contrataciones: sql<number>`(select count(*) from postulaciones p join busquedas b on b.id = p.busqueda_id where b.institucion_id = ${id} and p.etapa = 'contratado')`.mapWith(Number),
      })
      .from(busquedas)
      .where(eq(busquedas.institucionId, id)),
    db
      .select()
      .from(facturas)
      .where(eq(facturas.institucionId, id))
      .orderBy(desc(facturas.fechaCobro))
      .limit(24),
    db
      .select({
        id: auditoria.id,
        accion: auditoria.accion,
        detalle: auditoria.detalle,
        cuando: auditoria.creadoEn,
        quien: usuarios.email,
      })
      .from(auditoria)
      .leftJoin(usuarios, eq(usuarios.id, auditoria.usuarioId))
      .where(
        or(
          and(eq(auditoria.entidad, "institucion"), eq(auditoria.entidadId, id)),
          sql`${auditoria.detalle}->>'institucionId' = ${id}`,
        ),
      )
      .orderBy(desc(auditoria.creadoEn))
      .limit(8),
    institucion.suspendida
      ? db
          .select({ detalle: auditoria.detalle, cuando: auditoria.creadoEn })
          .from(auditoria)
          .where(
            and(
              eq(auditoria.entidad, "institucion"),
              eq(auditoria.entidadId, id),
              eq(auditoria.accion, "institucion.suspender"),
            ),
          )
          .orderBy(desc(auditoria.creadoEn))
          .limit(1)
      : Promise.resolve([]),
    bajaSolicitadaEn(id),
    sedesDeInstitucion(id),
  ]);

  const conEstado = listaFacturas.map((f) => ({
    id: f.id,
    periodo: f.periodo,
    plan: f.plan,
    monto: f.monto,
    fechaCobro: f.fechaCobro,
    estado: estadoEfectivo(f.estado, f.fechaCobro, hoy),
    medio: f.medio,
  }));
  const impagas = conEstado.filter((f) => f.estado !== "pagada").sort((a, b) => a.fechaCobro.localeCompare(b.fechaCobro));
  const proxima = impagas[0];

  const detalleSuspension = suspension?.detalle as { motivo?: string; nota?: string } | null | undefined;

  return {
    institucion,
    emailPropietario: fila.emailPropietario,
    sedes,
    equipo,
    busquedas: listaBusquedas,
    busquedasTotal: totales?.busquedasTotal ?? 0,
    busquedasActivas: totales?.busquedasActivas ?? 0,
    postulaciones: totales?.postulaciones ?? 0,
    contrataciones: totales?.contrataciones ?? 0,
    facturas: conEstado,
    proximoCobro: proxima
      ? { periodo: proxima.periodo, monto: proxima.monto, fechaCobro: proxima.fechaCobro, estado: proxima.estado }
      : null,
    bajaSolicitadaEn: baja,
    motivoSuspension:
      suspension && detalleSuspension?.motivo
        ? { motivo: detalleSuspension.motivo, nota: detalleSuspension.nota ?? null, cuando: suspension.cuando }
        : null,
    actividad,
  };
}

/* ───────────────────────────── Destinatarios de avisos ───────────────────────────── */

/**
 * Cuentas que reciben por mail lo de facturación y plan: la propietaria y los miembros activos que administran
 * (rol dueño o administrador) y ya tienen cuenta. El resto del equipo lo ve en la campanita, no por mail.
 */
export async function destinatariosDeFacturacion(ejecutor: EjecutorBo, institucionId: string): Promise<string[]> {
  const [[propia], gestores] = await Promise.all([
    ejecutor.select({ id: instituciones.propietarioId }).from(instituciones).where(eq(instituciones.id, institucionId)).limit(1),
    ejecutor
      .select({ id: institucionMiembros.usuarioId })
      .from(institucionMiembros)
      .where(
        and(
          eq(institucionMiembros.institucionId, institucionId),
          eq(institucionMiembros.estado, "activo"),
          or(eq(institucionMiembros.rol, "dueno"), eq(institucionMiembros.rol, "administrador")),
        ),
      ),
  ]);
  const ids = new Set<string>();
  if (propia?.id) ids.add(propia.id);
  for (const g of gestores) if (g.id) ids.add(g.id);
  return [...ids];
}

/**
 * Cuentas a las que avisar por algo que le pasa a la institución: la propietaria y los miembros activos
 * del equipo que ya tienen cuenta. Sin repetidos.
 */
export async function destinatariosDeInstitucion(ejecutor: EjecutorBo, institucionId: string): Promise<string[]> {
  const [[propia], miembros] = await Promise.all([
    ejecutor
      .select({ id: instituciones.propietarioId })
      .from(instituciones)
      .where(eq(instituciones.id, institucionId))
      .limit(1),
    ejecutor
      .select({ id: institucionMiembros.usuarioId })
      .from(institucionMiembros)
      .where(and(eq(institucionMiembros.institucionId, institucionId), eq(institucionMiembros.estado, "activo"))),
  ]);
  const ids = new Set<string>();
  if (propia?.id) ids.add(propia.id);
  for (const m of miembros) if (m.id) ids.add(m.id);
  return [...ids];
}

/** La fila completa de una institución, para precargar el formulario de edición del backoffice (sin las consultas de la ficha). */
export async function institucionParaEditar(id: string) {
  const [fila] = await getDb().select().from(instituciones).where(eq(instituciones.id, id)).limit(1);
  return fila ?? null;
}
