import "server-only";
import { and, asc, count, desc, eq, inArray, sql, type SQL } from "drizzle-orm";
import { getDb } from "@/db";
import {
  asignaturas,
  busquedas,
  docenteDetalle,
  docentes,
  instituciones,
  postulaciones,
  usuarios,
  zonas,
  type CategoriaDocente,
  type Docente,
  type DocumentosDocente,
  type EtapaPostulacion,
} from "@/db/schema";
import { CONSTANCIA, esEstudiante } from "@/lib/estudiantes";
import { urlFirmada } from "@/lib/almacenamiento";
import { bajaDocenteSolicitadaEn } from "@/lib/queries/cuenta";
import {
  POR_PAGINA_BO,
  type DocumentoBo,
  type EstadoVerificacionDocente,
  type FiltrosBoDocentes,
} from "@/lib/backoffice-docentes";
import { MS } from "@/lib/fechas";
import { CATEGORIA_ALTA } from "@/lib/onboarding";
import { pendientesDePerfil } from "@/lib/perfil";
import { desgloseScoring, porcentajePerfilParaScoring } from "@/lib/scoring";
import { contiene, textoPlano } from "@/lib/sql-texto";

/*
 * Lecturas del backoffice sobre docentes: listado con scoring, ficha y cola de verificación.
 * Acá se leen DNI, CUIL y documentos del bucket privado: solo se llama desde páginas bajo /backoffice
 * (el layout exige rol admin) y los enlaces a archivos se firman en cada render, con vencimiento corto.
 */

/** Los enlaces a documentos privados duran 15 minutos: el tiempo de revisar, no de compartirlos. */
const VIGENCIA_ENLACE = 900;

/* ───────────────────────────── Piezas de SQL ───────────────────────────── */

// Calificadas ("docentes"."id") porque Drizzle deja sin calificar las columnas en un select de una tabla,
// y las subconsultas correlacionadas necesitan el nombre exacto.
const D = { id: sql.raw('"docentes"."id"'), usuarioId: sql.raw('"docentes"."usuario_id"') };

const aFecha = (v: unknown) => (v == null ? null : new Date(v as string));

/** Cuántas veces se postuló él mismo (las invitaciones de las instituciones no cuentan). */
const nPostulaciones = sql<number>`(select count(*) from postulaciones p where p.docente_id = ${D.id} and p.origen = 'postulacion')`
  .mapWith(Number)
  .as("n_postulaciones");
const nContrataciones = sql<number>`(select count(*) from postulaciones p where p.docente_id = ${D.id} and p.etapa = 'contratado')`
  .mapWith(Number)
  .as("n_contrataciones");
/** Última actividad = la más reciente entre una notificación suya y una postulación (cualquier origen). */
const ultimaActividadSql = sql<Date | null>`greatest(
  (select max(p.creado_en) from postulaciones p where p.docente_id = ${D.id}),
  (select max(n.creado_en) from notificaciones n where n.usuario_id = ${D.usuarioId}))`
  .mapWith(aFecha)
  .as("ultima_actividad");

const EXISTE_CON_ALTA = eq(docentes.onboardingCompleto, true);

/* ───────────────────────────── Listado con scoring ───────────────────────────── */

export type FilaDocenteBo = {
  id: string;
  nombre: string;
  categoria: CategoriaDocente;
  fotoUrl: string | null;
  disciplina: string;
  zona: string;
  verificacion: EstadoVerificacionDocente;
  suspendido: boolean;
  postulaciones: number;
  contrataciones: number;
  scoring: number;
};

const unir = (xs: string[], max: number, vacio = "—") => xs.slice(0, max).join(", ") || vacio;

/** Docentes que cumplen `donde`, con sus conteos y el scoring calculado (en memoria: el universo es el del marketplace). */
async function docentesConScoring(donde: SQL | undefined): Promise<FilaDocenteBo[]> {
  const ahora = Date.now();
  const filas = await getDb()
    .select({
      id: docentes.id,
      nombre: docentes.nombre,
      apellido: docentes.apellido,
      categoria: docentes.categoria,
      fotoUrl: docentes.fotoUrl,
      subtitulo: docentes.subtitulo,
      resumen: docentes.resumen,
      telefono: docentes.telefono,
      zonas: docentes.zonas,
      asignaturas: docentes.asignaturas,
      disponibilidad: docentes.disponibilidad,
      niveles: docentes.niveles,
      experiencia: docentes.experiencia,
      formacion: docentes.formacion,
      cvUrl: docentes.cvUrl,
      verificacion: docentes.verificacion,
      tituloVerificado: docentes.tituloVerificado,
      antecedentesVerificados: docentes.antecedentesVerificados,
      suspendido: docentes.suspendido,
      postulaciones: nPostulaciones,
      contrataciones: nContrataciones,
      ultimaActividad: ultimaActividadSql,
    })
    .from(docentes)
    .where(donde);

  return filas.map((f) => ({
    id: f.id,
    nombre: `${f.nombre} ${f.apellido}`.trim(),
    categoria: f.categoria,
    fotoUrl: f.fotoUrl,
    disciplina: unir(f.asignaturas, 2, f.subtitulo ?? "—"),
    zona: unir(f.zonas, 2),
    verificacion: f.verificacion,
    suspendido: f.suspendido,
    postulaciones: f.postulaciones,
    contrataciones: f.contrataciones,
    scoring: desgloseScoring({
      perfilPct: porcentajePerfilParaScoring(f),
      verificacion: f.verificacion,
      tituloVerificado: f.tituloVerificado,
      antecedentesVerificados: f.antecedentesVerificados,
      postulaciones: f.postulaciones,
      contrataciones: f.contrataciones,
      diasSinActividad: f.ultimaActividad ? Math.max(0, Math.floor((ahora - f.ultimaActividad.getTime()) / MS.DIA)) : null,
    }).total,
  }));
}

function condicionesListado(f: FiltrosBoDocentes) {
  const c: (SQL | undefined)[] = [EXISTE_CON_ALTA];
  if (f.disciplina) c.push(sql`${f.disciplina} = any(${docentes.asignaturas})`);
  if (f.zona) c.push(sql`${f.zona} = any(${docentes.zonas})`);
  if (f.verificacion === "suspendido") c.push(eq(docentes.suspendido, true));
  else if (f.verificacion) c.push(eq(docentes.verificacion, f.verificacion));

  const pajar = sql`coalesce(${docentes.nombre}, '') || ' ' || coalesce(${docentes.apellido}, '') || ' ' || coalesce(${docentes.email}, '')
    || ' ' || coalesce(${docentes.subtitulo}, '') || ' ' || array_to_string(${docentes.asignaturas}, ' ')
    || ' ' || array_to_string(${docentes.zonas}, ' ')`;
  for (const palabra of textoPlano(f.q).split(/\s+/).filter(Boolean).slice(0, 6)) c.push(contiene(pajar, palabra));
  return and(...c);
}

export type ListadoDocentesBo = { filas: FilaDocenteBo[]; total: number; pagina: number; paginas: number };

export async function listarDocentesBo(f: FiltrosBoDocentes): Promise<ListadoDocentesBo> {
  const todos = await docentesConScoring(condicionesListado(f));
  const porNombre = (a: FilaDocenteBo, b: FilaDocenteBo) => a.nombre.localeCompare(b.nombre, "es");
  todos.sort((a, b) => {
    switch (f.orden) {
      case "scoring-asc":
        return a.scoring - b.scoring || porNombre(a, b);
      case "postulaciones":
        return b.postulaciones - a.postulaciones || b.scoring - a.scoring || porNombre(a, b);
      case "nombre":
        return porNombre(a, b);
      default:
        return b.scoring - a.scoring || porNombre(a, b);
    }
  });
  const paginas = Math.max(1, Math.ceil(todos.length / POR_PAGINA_BO));
  const pagina = Math.min(f.pagina, paginas);
  return { filas: todos.slice((pagina - 1) * POR_PAGINA_BO, pagina * POR_PAGINA_BO), total: todos.length, pagina, paginas };
}

/** Los de mejor scoring entre los que terminaron el alta (para "Docentes por calidad de perfil" de Operación). */
export async function topDocentesPorScoring(limite: number): Promise<FilaDocenteBo[]> {
  const todos = await docentesConScoring(EXISTE_CON_ALTA);
  return todos.sort((a, b) => b.scoring - a.scoring || a.nombre.localeCompare(b.nombre, "es")).slice(0, limite);
}

/** Disciplinas y zonas de los catálogos (no de listas fijas) para los filtros del listado. */
export async function opcionesFiltrosBo() {
  const db = getDb();
  const [disciplinas, zonasCatalogo] = await Promise.all([
    db.select({ nombre: asignaturas.nombre }).from(asignaturas).groupBy(asignaturas.nombre),
    db.select({ nombre: zonas.nombre }).from(zonas).orderBy(asc(zonas.orden), asc(zonas.nombre)),
  ]);
  return {
    // Son decenas: alfabético se encuentra más rápido que en el orden del catálogo (mezcla categorías).
    disciplinas: disciplinas.map((d) => d.nombre).sort((a, b) => a.localeCompare(b, "es")),
    zonas: zonasCatalogo.map((z) => z.nombre),
  };
}

/* ───────────────────────────── Documentos ───────────────────────────── */

// Solo se previsualizan imágenes del bucket privado: una URL externa (CV viejo) no se carga en el navegador de quien revisa.
const rutaEsImagen = (ruta: string) => !/^https?:\/\//.test(ruta) && /\.(jpe?g|png|webp)$/i.test(ruta);

type EntradaDocumentos = {
  categoria: CategoriaDocente;
  cvUrl: string | null;
  documentos: DocumentosDocente;
  estudia: boolean;
};

/**
 * Los documentos del alta con su enlace firmado (en paralelo). El CV puede ser un path privado o una URL vieja. Quien todavía
 * estudia presenta la constancia de alumno regular (obligatoria) en lugar del título (que no le aplica).
 */
async function documentosDeDocente(e: EntradaDocumentos): Promise<DocumentoBo[]> {
  const base: { clave: DocumentoBo["clave"]; etiqueta: string; opcional: boolean; noAplica: boolean; ruta: string | null }[] = [
    { clave: "dniFrente", etiqueta: "DNI · frente", opcional: false, noAplica: false, ruta: e.documentos.dniFrente ?? null },
    { clave: "dniDorso", etiqueta: "DNI · dorso", opcional: false, noAplica: false, ruta: e.documentos.dniDorso ?? null },
    ...(e.estudia || e.documentos.constancia
      ? [{ clave: "constancia" as const, etiqueta: CONSTANCIA.nombre, opcional: !e.estudia, noAplica: false, ruta: e.documentos.constancia ?? null }]
      : []),
    {
      clave: "credencial",
      etiqueta: CATEGORIA_ALTA[e.categoria].credencial.nombre,
      opcional: e.estudia,
      noAplica: e.estudia && !e.documentos.credencial,
      ruta: e.documentos.credencial ?? null,
    },
    {
      clave: "conducta",
      etiqueta: "Certificado de buena conducta",
      opcional: true,
      noAplica: false,
      ruta: e.documentos.conducta ?? null,
    },
    { clave: "cv", etiqueta: "CV", opcional: true, noAplica: false, ruta: e.cvUrl },
  ];
  return Promise.all(
    base.map(async ({ ruta, ...d }): Promise<DocumentoBo> => {
      const url = !ruta ? null : /^https?:\/\//.test(ruta) ? ruta : await urlFirmada(ruta, VIGENCIA_ENLACE);
      return { ...d, subido: !!ruta, url, esImagen: !!ruta && rutaEsImagen(ruta) };
    }),
  );
}

/** Qué le falta para poder verificarlo: solo lo que bloquea (lo optativo no entra). */
function faltantesDe(
  documentos: DocumentoBo[],
  dni: string | null | undefined,
  identidadVerificada = false,
  /** Si todavía estudia: el porcentaje de materias que declaró (null = no lo cargó). Omitido si ya se recibió. */
  estudiante?: { porcentaje: number | null },
) {
  const f: string[] = [];
  if (!dni) f.push("Número de DNI");
  if (estudiante && estudiante.porcentaje == null) f.push("Porcentaje de materias aprobadas");
  for (const d of documentos) {
    // Con la identidad verificada las fotos del DNI se borraron a propósito: no faltan.
    if (identidadVerificada && (d.clave === "dniFrente" || d.clave === "dniDorso")) continue;
    if (!d.subido && !d.opcional && !d.noAplica) f.push(d.etiqueta);
  }
  return f;
}

/* ───────────────────────────── Ficha de un docente ───────────────────────────── */

export type PostulacionReciente = {
  id: string;
  busqueda: string;
  institucion: string;
  institucionId: string;
  creadaEn: Date;
  etapa: EtapaPostulacion;
  origen: "postulacion" | "invitacion";
};

export type FichaDocenteBo = {
  docente: Docente;
  /** Email de la cuenta de acceso (puede diferir del de contacto del perfil); null si el perfil no tiene cuenta. */
  emailCuenta: string | null;
  /** Cuándo aceptó los términos y cuál era la versión; null si no hay constancia (cuentas anteriores al registro). */
  terminos: { version: string; en: Date } | null;
  /** Cuándo pidió la baja de la cuenta, si el pedido sigue en pie. */
  bajaSolicitadaEn: Date | null;
  identidad: {
    dni: string | null;
    cuil: string | null;
    fechaNacimiento: string | null;
    situacionEstudio: string | null;
    /** Solo si todavía estudia: el porcentaje de materias aprobadas que declaró. */
    porcentajeMaterias: number | null;
  };
  postulaciones: number;
  contrataciones: number;
  recientes: PostulacionReciente[];
  ultimaActividad: Date | null;
  scoring: ReturnType<typeof desgloseScoring>;
  perfil: ReturnType<typeof pendientesDePerfil>;
  documentos: DocumentoBo[];
  faltantes: string[];
};

export async function fichaDocenteBo(docenteId: string): Promise<FichaDocenteBo | null> {
  const db = getDb();
  const [fila] = await db
    .select({
      docente: docentes,
      emailCuenta: usuarios.email,
      terminosEn: usuarios.terminosAceptadosEn,
      terminosVersion: usuarios.terminosVersion,
      detalle: docenteDetalle,
    })
    .from(docentes)
    .leftJoin(usuarios, eq(usuarios.id, docentes.usuarioId))
    .leftJoin(docenteDetalle, eq(docenteDetalle.docenteId, docentes.id))
    .where(eq(docentes.id, docenteId))
    .limit(1);
  if (!fila) return null;
  const { docente, detalle } = fila;

  const [recientes, [conteos], [actividad]] = await Promise.all([
    db
      .select({
        id: postulaciones.id,
        busqueda: busquedas.puesto,
        institucion: instituciones.nombre,
        institucionId: instituciones.id,
        creadaEn: postulaciones.creadoEn,
        etapa: postulaciones.etapa,
        origen: postulaciones.origen,
      })
      .from(postulaciones)
      .innerJoin(busquedas, eq(busquedas.id, postulaciones.busquedaId))
      .innerJoin(instituciones, eq(instituciones.id, busquedas.institucionId))
      .where(eq(postulaciones.docenteId, docente.id))
      .orderBy(desc(postulaciones.creadoEn))
      .limit(8),
    db
      .select({
        postulaciones: sql<number>`count(*) filter (where ${postulaciones.origen} = 'postulacion')`.mapWith(Number),
        contrataciones: sql<number>`count(*) filter (where ${postulaciones.etapa} = 'contratado')`.mapWith(Number),
      })
      .from(postulaciones)
      .where(eq(postulaciones.docenteId, docente.id)),
    db.execute<{ ultima: string | null }>(sql`select greatest(
      (select max(p.creado_en) from postulaciones p where p.docente_id = ${docente.id}::uuid),
      (select max(n.creado_en) from notificaciones n where n.usuario_id = ${docente.usuarioId}::uuid)) as ultima`),
  ]);

  const ultimaActividad = aFecha(actividad?.ultima);
  const postulacionesPropias = conteos?.postulaciones ?? 0;
  const contrataciones = conteos?.contrataciones ?? 0;

  const documentos = await documentosDeDocente({
    categoria: docente.categoria,
    cvUrl: docente.cvUrl,
    documentos: detalle?.documentos ?? {},
    estudia: detalle?.situacionEstudio === "estudiante",
  });

  return {
    docente,
    emailCuenta: fila.emailCuenta,
    terminos: fila.terminosEn && fila.terminosVersion ? { version: fila.terminosVersion, en: fila.terminosEn } : null,
    bajaSolicitadaEn: await bajaDocenteSolicitadaEn(docente.id),
    identidad: {
      dni: detalle?.dni ?? null,
      cuil: detalle?.cuil ?? null,
      fechaNacimiento: detalle?.fechaNacimiento ?? null,
      situacionEstudio: detalle?.situacionEstudio ?? null,
      porcentajeMaterias: detalle?.porcentajeMaterias ?? null,
    },
    postulaciones: postulacionesPropias,
    contrataciones,
    recientes,
    ultimaActividad,
    scoring: desgloseScoring({
      perfilPct: porcentajePerfilParaScoring(docente),
      verificacion: docente.verificacion,
      tituloVerificado: docente.tituloVerificado,
      antecedentesVerificados: docente.antecedentesVerificados,
      postulaciones: postulacionesPropias,
      contrataciones,
      diasSinActividad: ultimaActividad ? Math.max(0, Math.floor((Date.now() - ultimaActividad.getTime()) / MS.DIA)) : null,
    }),
    perfil: pendientesDePerfil(docente),
    documentos,
    faltantes: faltantesDe(
      documentos,
      detalle?.dni,
      docente.verificacion === "verificado",
      esEstudiante(detalle?.situacionEstudio) ? { porcentaje: detalle?.porcentajeMaterias ?? null } : undefined,
    ),
  };
}

/* ───────────────────────────── Cola de verificación ───────────────────────────── */

export const POR_PAGINA_COLA = 10;
export type EstadoCola = "todos" | "pendiente" | "correccion";

export type ItemCola = {
  id: string;
  nombre: string;
  categoria: CategoriaDocente;
  fotoUrl: string | null;
  subtitulo: string | null;
  verificacion: "pendiente" | "correccion";
  /** Motivo de la corrección pedida antes (si hubo). */
  nota: string | null;
  /** Cuándo se le pidió la corrección. */
  revisadaEn: Date | null;
  creadoEn: Date;
  suspendido: boolean;
  zonas: string[];
  telefono: string | null;
  email: string | null;
  identidad: { dni: string | null; cuil: string | null; fechaNacimiento: string | null; estudia: boolean; porcentajeMaterias: number | null };
  documentos: DocumentoBo[];
  faltantes: string[];
};

export type ColaVerificacion = {
  items: ItemCola[];
  total: number;
  pagina: number;
  paginas: number;
  cantidades: { todos: number; pendiente: number; correccion: number };
};

/**
 * Docentes con el alta completa y la verificación pendiente o con corrección pedida, los más antiguos primero.
 * Cada uno viene con su DNI, CUIL y documentos (enlaces firmados): esta lectura es solo del backoffice.
 */
export async function colaVerificacion(opciones: { estado: EstadoCola; pagina: number }): Promise<ColaVerificacion> {
  const db = getDb();
  const enCola = and(EXISTE_CON_ALTA, inArray(docentes.verificacion, ["pendiente", "correccion"]));

  const conteos = await db
    .select({ estado: docentes.verificacion, n: count() })
    .from(docentes)
    .where(enCola)
    .groupBy(docentes.verificacion);
  const cantidades = {
    pendiente: conteos.find((c) => c.estado === "pendiente")?.n ?? 0,
    correccion: conteos.find((c) => c.estado === "correccion")?.n ?? 0,
    todos: 0,
  };
  cantidades.todos = cantidades.pendiente + cantidades.correccion;

  const total = cantidades[opciones.estado];
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA_COLA));
  const pagina = Math.min(Math.max(1, opciones.pagina), paginas);

  const filas = await db
    .select({ docente: docentes, emailCuenta: usuarios.email, detalle: docenteDetalle })
    .from(docentes)
    .leftJoin(usuarios, eq(usuarios.id, docentes.usuarioId))
    .leftJoin(docenteDetalle, eq(docenteDetalle.docenteId, docentes.id))
    .where(and(enCola, opciones.estado === "todos" ? undefined : eq(docentes.verificacion, opciones.estado)))
    .orderBy(asc(docentes.creadoEn), asc(docentes.id))
    .limit(POR_PAGINA_COLA)
    .offset((pagina - 1) * POR_PAGINA_COLA);

  const items = await Promise.all(
    filas.map(async ({ docente: d, emailCuenta, detalle }): Promise<ItemCola> => {
      const documentos = await documentosDeDocente({
        categoria: d.categoria,
        cvUrl: d.cvUrl,
        documentos: detalle?.documentos ?? {},
        estudia: detalle?.situacionEstudio === "estudiante",
      });
      return {
        id: d.id,
        nombre: `${d.nombre} ${d.apellido}`.trim(),
        categoria: d.categoria,
        fotoUrl: d.fotoUrl,
        subtitulo: d.subtitulo,
        verificacion: d.verificacion === "correccion" ? "correccion" : "pendiente",
        nota: d.verificacionNota,
        revisadaEn: d.verificacionRevisadaEn,
        creadoEn: d.creadoEn,
        suspendido: d.suspendido,
        zonas: d.zonas,
        telefono: d.telefono,
        email: d.email ?? emailCuenta,
        identidad: {
          dni: detalle?.dni ?? null,
          cuil: detalle?.cuil ?? null,
          fechaNacimiento: detalle?.fechaNacimiento ?? null,
          estudia: detalle?.situacionEstudio === "estudiante",
          porcentajeMaterias: detalle?.porcentajeMaterias ?? null,
        },
        documentos,
        faltantes: faltantesDe(
          documentos,
          detalle?.dni,
          false,
          esEstudiante(detalle?.situacionEstudio) ? { porcentaje: detalle?.porcentajeMaterias ?? null } : undefined,
        ),
      };
    }),
  );

  return { items, total, pagina, paginas, cantidades };
}
