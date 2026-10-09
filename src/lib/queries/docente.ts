import "server-only";
import { and, asc, count, countDistinct, desc, eq, gte } from "drizzle-orm";
import { getDb } from "@/db";
import {
  asignaturas,
  busquedas,
  docenteDetalle,
  instituciones,
  notificaciones,
  postulaciones,
  zonas,
  type Docente,
  type DocumentosDocente,
} from "@/db/schema";
import { coincidencia, coincideZona } from "@/lib/coincidencia";
import { grillaDesdeLista } from "@/lib/disponibilidad";
import { etiquetaFechas, fechaCorta } from "@/lib/fechas-curso";
import { grillaDesdeJson, grillaTieneHorarios } from "@/lib/onboarding";
import { estadoParaDocente } from "@/lib/postulaciones";
import { cursosParaDocente } from "@/lib/queries/cursos";
import { busquedaVigente, kmEntre } from "@/lib/queries/instituciones";
import { institucionVisible } from "@/lib/visibilidad";

/** El dashboard muestra cuatro tarjetas por fila (diseño del prototipo): recomendadas, instituciones y cursos. */
const CUATRO_POR_FILA = 4;

const HORA = 3_600_000;
const DIA = 24 * HORA;

function unir(items: string[]) {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`;
}

function recortar(texto: string | null, max: number) {
  const t = (texto ?? "").trim();
  return t.length > max ? `${t.slice(0, max).trim()}…` : t;
}

/* ───────────────────────────── Dashboard ───────────────────────────── */

export type TarjetaOferta = {
  id: string;
  puesto: string;
  institucion: string;
  logoUrl: string | null;
  zona: string | null;
  km: number | null;
  porcentaje: number;
  motivos: string[];
};

export type TarjetaInstitucionDestacada = {
  id: string;
  slug: string;
  nombre: string;
  tipo: string;
  zona: string | null;
  logoUrl: string | null;
  resumen: string;
  busquedasActivas: number;
};

export type TarjetaCursoDestacado = {
  id: string;
  titulo: string;
  subtitulo: string | null;
  modalidad: string;
  fotoUrl: string | null;
  fechas: string;
};

export type FilaPostulacion = {
  id: string;
  puesto: string;
  institucion: string;
  creadaEl: string;
  estado: ReturnType<typeof estadoParaDocente>;
};

export type Tablero = {
  /** Sin postulaciones todavía: se muestra la variante "recién registrado". */
  primeraVez: boolean;
  metricas: {
    nuevas: number;
    nuevasDonde: string;
    postulacionesActivas: number;
    conEntrevista: number;
    vistasPerfil: number;
    suplencias: number;
    suplenciaVence: string | null;
  };
  /** Ya subió el frente del DNI (o ya está verificado): el paso "Subí tu documentación" está hecho. */
  documentacionCargada: boolean;
  /** Búsquedas abiertas, de su categoría y en sus zonas o dentro de su radio. */
  paraVos: number;
  recomendadas: TarjetaOferta[];
  instituciones: TarjetaInstitucionDestacada[];
  cursos: TarjetaCursoDestacado[];
  postulaciones: FilaPostulacion[];
  totalPostulaciones: number;
};

/**
 * Todo lo que muestra el dashboard del docente. Las búsquedas vigentes se traen una vez
 * (hasta 300, las más nuevas) y se puntúan en memoria; alcanza para el volumen de este corte.
 */
export async function tableroDocente(docente: Docente, usuarioId: string): Promise<Tablero> {
  const db = getDb();
  const ahora = new Date();
  const hace14 = new Date(ahora.getTime() - 14 * DIA);
  const hace30 = new Date(ahora.getTime() - 30 * DIA);

  const [vigentes, mias, vistas, conBusquedas, cursosVigentes, detalle] = await Promise.all([
    db
      .select({
        id: busquedas.id,
        puesto: busquedas.puesto,
        categoria: busquedas.categoria,
        disciplina: busquedas.disciplina,
        nivel: busquedas.nivel,
        turno: busquedas.turno,
        zona: busquedas.zona,
        rapida: busquedas.rapida,
        venceEn: busquedas.venceEn,
        creadoEn: busquedas.creadoEn,
        institucion: instituciones.nombre,
        logoUrl: instituciones.logoUrl,
        partido: instituciones.partido,
        instLat: instituciones.lat,
        instLng: instituciones.lng,
      })
      .from(busquedas)
      .innerJoin(instituciones, eq(instituciones.id, busquedas.institucionId))
      .where(busquedaVigente(ahora))
      .orderBy(desc(busquedas.creadoEn))
      .limit(300),
    db
      .select({
        id: postulaciones.id,
        busquedaId: postulaciones.busquedaId,
        etapa: postulaciones.etapa,
        examenPreocupacionalEn: postulaciones.examenPreocupacionalEn,
        creadoEn: postulaciones.creadoEn,
        puesto: busquedas.puesto,
        estadoBusqueda: busquedas.estado,
        institucion: instituciones.nombre,
      })
      .from(postulaciones)
      .innerJoin(busquedas, eq(busquedas.id, postulaciones.busquedaId))
      .innerJoin(instituciones, eq(instituciones.id, busquedas.institucionId))
      .where(eq(postulaciones.docenteId, docente.id))
      .orderBy(desc(postulaciones.creadoEn)),
    // Cada vista de una institución llega como notificación "vista" con el nombre de la institución de título.
    db
      .select({ n: countDistinct(notificaciones.titulo) })
      .from(notificaciones)
      .where(and(eq(notificaciones.usuarioId, usuarioId), eq(notificaciones.tipo, "vista"), gte(notificaciones.creadoEn, hace30))),
    db
      .select({
        id: instituciones.id,
        slug: instituciones.slug,
        nombre: instituciones.nombre,
        tipo: instituciones.tipo,
        zona: instituciones.zona,
        descripcion: instituciones.descripcion,
        logoUrl: instituciones.logoUrl,
        lat: instituciones.lat,
        lng: instituciones.lng,
        activas: count(busquedas.id),
      })
      .from(instituciones)
      .innerJoin(busquedas, and(eq(busquedas.institucionId, instituciones.id), busquedaVigente(ahora)))
      .where(and(eq(instituciones.verificada, true), institucionVisible))
      .groupBy(instituciones.id)
      .orderBy(desc(count(busquedas.id)), asc(instituciones.nombre))
      .limit(30),
    cursosParaDocente(docente.id),
    db
      .select({ documentos: docenteDetalle.documentos })
      .from(docenteDetalle)
      .where(eq(docenteDetalle.docenteId, docente.id))
      .limit(1),
  ]);

  const yaPostuladas = new Set(mias.map((p) => p.busquedaId));
  const yo = { lat: docente.lat, lng: docente.lng };

  const candidatas = vigentes
    .filter((b) => !yaPostuladas.has(b.id))
    .map((b) => {
      const km = kmEntre(yo, { lat: b.instLat, lng: b.instLng });
      return { b, km, ...coincidencia(docente, b, km) };
    });

  // "Para vos": su categoría, en sus zonas o dentro de su radio. Sin ubicación cargada, solo la categoría.
  const sinUbicacion = docente.zonas.length === 0 && docente.lat == null;
  const paraVos = candidatas.filter(
    ({ b, km }) =>
      b.categoria === docente.categoria &&
      (sinUbicacion || coincideZona(b.zona, docente.zonas) || (km != null && km <= docente.radioKm)),
  );

  const nuevas = paraVos.filter(({ b }) => b.creadoEn >= hace14);
  // "Vicente López, Núñez y Tigre": el partido, salvo en CABA, donde el dato útil es el barrio.
  const lugarDe = (b: { partido: string | null; zona: string | null }) =>
    b.partido && b.partido !== "CABA" ? b.partido : (b.zona ?? b.partido);
  const dondeNuevas = [...new Set(nuevas.map(({ b }) => lugarDe(b)).filter((z): z is string => !!z))].slice(0, 3);

  const suplencias = paraVos.filter(({ b }) => b.rapida);
  const vencimientos = suplencias.map(({ b }) => b.venceEn).filter((v): v is Date => !!v);
  let suplenciaVence: string | null = null;
  if (vencimientos.length) {
    const horas = Math.max(1, Math.ceil((Math.min(...vencimientos.map((v) => v.getTime())) - ahora.getTime()) / HORA));
    const cuando = horas >= 48 ? `${Math.ceil(horas / 24)} días` : `${horas} hs`;
    suplenciaVence = `${suplencias.length > 1 ? "una vence" : "vence"} en ${cuando}`;
  }

  const recomendadas = [...candidatas]
    .sort((x, y) => y.porcentaje - x.porcentaje || (x.km ?? Infinity) - (y.km ?? Infinity))
    .slice(0, CUATRO_POR_FILA)
    .map(
      ({ b, km, porcentaje, motivos }): TarjetaOferta => ({
        id: b.id,
        puesto: b.puesto,
        institucion: b.institucion,
        logoUrl: b.logoUrl,
        zona: b.zona,
        km,
        porcentaje,
        motivos,
      }),
    );

  const destacadas = conBusquedas
    .map((i) => {
      const km = kmEntre(yo, i);
      const cerca = coincideZona(i.zona, docente.zonas) || (km != null && km <= docente.radioKm);
      return { i, km, cerca };
    })
    .sort(
      (x, y) =>
        Number(y.cerca) - Number(x.cerca) || y.i.activas - x.i.activas || (x.km ?? Infinity) - (y.km ?? Infinity),
    )
    .slice(0, CUATRO_POR_FILA)
    .map(
      ({ i }): TarjetaInstitucionDestacada => ({
        id: i.id,
        slug: i.slug,
        nombre: i.nombre,
        tipo: i.tipo,
        zona: i.zona,
        logoUrl: i.logoUrl,
        resumen: recortar(i.descripcion, 92),
        busquedasActivas: i.activas,
      }),
    );

  const cursos = cursosVigentes
    .filter((c) => !c.inscripto)
    .sort((x, y) => y.inscriptos - x.inscriptos)
    .slice(0, CUATRO_POR_FILA)
    .map(
      (c): TarjetaCursoDestacado => ({
        id: c.id,
        titulo: c.titulo,
        subtitulo: c.subtitulo,
        modalidad: c.modalidad,
        fotoUrl: c.fotoUrl,
        fechas: etiquetaFechas(c.fechaInicio, c.fechaFinal),
      }),
    );

  const conEstado = mias.map((p) => ({ p, estado: estadoParaDocente(p.etapa, p.estadoBusqueda, !!p.examenPreocupacionalEn) }));
  const activas = conEstado.filter(({ estado }) => estado.activa);

  return {
    primeraVez: mias.length === 0,
    metricas: {
      nuevas: nuevas.length,
      nuevasDonde: unir(dondeNuevas.length ? dondeNuevas : docente.zonas.slice(0, 3)),
      postulacionesActivas: activas.length,
      conEntrevista: activas.filter(({ p }) => p.etapa === "entrevista").length,
      vistasPerfil: vistas[0]?.n ?? 0,
      suplencias: suplencias.length,
      suplenciaVence,
    },
    documentacionCargada: docente.verificacion === "verificado" || !!detalle[0]?.documentos?.dniFrente,
    paraVos: paraVos.length,
    recomendadas,
    instituciones: destacadas,
    cursos,
    postulaciones: conEstado.slice(0, 3).map(({ p, estado }) => ({
      id: p.id,
      puesto: p.puesto,
      institucion: p.institucion,
      creadaEl: fechaCorta(p.creadoEn),
      estado,
    })),
    totalPostulaciones: mias.length,
  };
}

/* ───────────────────────────── Perfil ───────────────────────────── */

/**
 * Sugerencias de zonas y asignaturas (de la base), la grilla de disponibilidad guardada y los
 * documentos que ya subió. La grilla y los documentos viven en `docente_detalle` (los crea el alta).
 */
export async function datosParaPerfil(docente: Docente) {
  const db = getDb();
  const [zonasCat, asignaturasCat, detalle] = await Promise.all([
    db.select({ nombre: zonas.nombre }).from(zonas).orderBy(asc(zonas.orden), asc(zonas.nombre)),
    db
      .select({ nombre: asignaturas.nombre, categoria: asignaturas.categoria })
      .from(asignaturas)
      .orderBy(asc(asignaturas.orden)),
    db
      .select({
        grilla: docenteDetalle.grillaDisponibilidad,
        documentos: docenteDetalle.documentos,
        situacionEstudio: docenteDetalle.situacionEstudio,
        porcentajeMaterias: docenteDetalle.porcentajeMaterias,
      })
      .from(docenteDetalle)
      .where(eq(docenteDetalle.docenteId, docente.id))
      .limit(1),
  ]);

  // Primero las asignaturas de su categoría; el resto también se puede elegir.
  const propias = asignaturasCat.filter((a) => a.categoria === docente.categoria).map((a) => a.nombre);
  const otras = asignaturasCat.filter((a) => a.categoria !== docente.categoria).map((a) => a.nombre);
  const guardada = detalle[0]?.grilla ? grillaDesdeJson(detalle[0].grilla) : null;

  return {
    zonas: zonasCat.map((z) => z.nombre),
    asignaturas: [...new Set([...propias, ...otras])],
    grilla: guardada && grillaTieneHorarios(guardada) ? guardada : grillaDesdeLista(docente.disponibilidad),
    documentos: (detalle[0]?.documentos ?? {}) as DocumentosDocente,
    situacionEstudio: detalle[0]?.situacionEstudio ?? null,
    porcentajeMaterias: detalle[0]?.porcentajeMaterias ?? null,
  };
}

/** Solo la grilla de disponibilidad (para el CV imprimible): la guardada o, si no hay, la que sale de la lista de turnos. */
export async function grillaDelDocente(docente: Docente) {
  const [fila] = await getDb()
    .select({ grilla: docenteDetalle.grillaDisponibilidad })
    .from(docenteDetalle)
    .where(eq(docenteDetalle.docenteId, docente.id))
    .limit(1);
  const guardada = fila?.grilla ? grillaDesdeJson(fila.grilla) : null;
  return guardada && grillaTieneHorarios(guardada) ? guardada : grillaDesdeLista(docente.disponibilidad);
}
