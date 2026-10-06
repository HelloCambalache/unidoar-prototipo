import "server-only";
import { and, count, desc, eq, gt, inArray, isNull, ne, or } from "drizzle-orm";
import { getDb } from "@/db";
import {
  busquedas,
  favoritos,
  instituciones,
  postulaciones,
  type Busqueda,
  type CategoriaDocente,
  type Docente,
  type EtapaPostulacion,
} from "@/db/schema";
import { distanciaKm } from "@/lib/geo";
import { busquedaAbierta, RADIO_MAX, tiempoRestante, type FiltrosOportunidades } from "@/lib/oportunidades";
import { estadoParaDocente } from "@/lib/postulaciones";
import { contiene } from "@/lib/sql-texto";
import { busquedaDeInstitucionActiva, institucionVisible } from "@/lib/visibilidad";

type TonoInsignia = ReturnType<typeof estadoParaDocente>["tono"];

export type OfertaListada = {
  id: string;
  puesto: string;
  categoria: CategoriaDocente;
  disciplina: string;
  nivel: string | null;
  tipo: string;
  rapida: boolean;
  /** "40 min", "18 hs": cuánto falta para que venza una rápida (se calcula en el servidor). */
  responderEn: string | null;
  descripcion: string | null;
  /** Zona de la búsqueda o, si no tiene, la de la institución. */
  zona: string | null;
  /** "Turno mañana · 18 hs semanales" */
  horario: string | null;
  institucion: {
    id: string;
    slug: string;
    nombre: string;
    logoUrl: string | null;
    verificada: boolean;
    lat: number | null;
    lng: number | null;
  };
  /** Distancia entre el docente y la institución; null si falta alguna de las dos ubicaciones. */
  km: number | null;
  favorita: boolean;
  /** Si el docente ya figura en esta búsqueda (postulado o invitado). */
  postulacion: { texto: string; tono: TonoInsignia } | null;
};

export type ResultadoOportunidades = {
  ofertas: OfertaListada[];
  /** Radio aplicado (el del filtro o, si no hay, el que el docente guardó en su perfil). */
  radio: number;
  /** El docente tiene coordenadas: sin ellas no se pueden calcular distancias ni filtrar por radio. */
  conUbicacion: boolean;
};

export function horarioDeBusqueda(b: Pick<Busqueda, "horario" | "turno" | "cargaHoraria">) {
  return b.horario ?? ([b.turno, b.cargaHoraria].filter(Boolean).join(" · ") || null);
}

/**
 * Búsquedas abiertas que ve el docente en "Buscar trabajo" y "Búsquedas rápidas".
 * Las rápidas vencidas no se listan: ya no aceptan respuesta.
 */
export async function listarOportunidades(
  docente: Docente,
  usuarioId: string,
  filtros: FiltrosOportunidades,
): Promise<ResultadoOportunidades> {
  const db = getDb();
  const ahora = new Date();
  const radio = filtros.radio ?? docente.radioKm;
  const origen = docente.lat != null && docente.lng != null ? { lat: docente.lat, lng: docente.lng } : null;
  const conUbicacion = origen !== null;

  const [favoritas, propias] = await Promise.all([
    db
      .select({ id: favoritos.refId })
      .from(favoritos)
      .where(and(eq(favoritos.usuarioId, usuarioId), eq(favoritos.tipo, "busqueda"))),
    db
      .select({ busquedaId: postulaciones.busquedaId, etapa: postulaciones.etapa })
      .from(postulaciones)
      .where(eq(postulaciones.docenteId, docente.id)),
  ]);
  const idsFavoritas = new Set(favoritas.map((f) => f.id));
  if (filtros.favoritos && idsFavoritas.size === 0) return { ofertas: [], radio, conUbicacion };
  const etapaPorBusqueda = new Map<string, EtapaPostulacion>(propias.map((p) => [p.busquedaId, p.etapa]));

  const condiciones = [
    eq(busquedas.estado, "activa"),
    busquedaDeInstitucionActiva,
    or(eq(busquedas.rapida, false), isNull(busquedas.venceEn), gt(busquedas.venceEn, ahora)),
    filtros.categoria ? eq(busquedas.categoria, filtros.categoria) : undefined,
    filtros.nivel ? eq(busquedas.nivel, filtros.nivel) : undefined,
    filtros.turno ? eq(busquedas.turno, filtros.turno) : undefined,
    filtros.rapidas ? eq(busquedas.rapida, true) : undefined,
    filtros.verificadas ? eq(instituciones.verificada, true) : undefined,
    filtros.favoritos ? inArray(busquedas.id, [...idsFavoritas]) : undefined,
    filtros.q
      ? or(
          contiene(busquedas.puesto, filtros.q),
          contiene(busquedas.disciplina, filtros.q),
          contiene(instituciones.nombre, filtros.q),
        )
      : undefined,
  ];

  const filas = await db
    .select({
      busqueda: busquedas,
      institucion: {
        id: instituciones.id,
        slug: instituciones.slug,
        nombre: instituciones.nombre,
        logoUrl: instituciones.logoUrl,
        verificada: instituciones.verificada,
        zona: instituciones.zona,
        lat: instituciones.lat,
        lng: instituciones.lng,
      },
    })
    .from(busquedas)
    .innerJoin(instituciones, eq(instituciones.id, busquedas.institucionId))
    .where(and(...condiciones))
    .orderBy(desc(busquedas.rapida), desc(busquedas.creadoEn))
    .limit(500);

  const limitaRadio = origen !== null && radio < RADIO_MAX;

  const ofertas: OfertaListada[] = [];
  for (const { busqueda: b, institucion: i } of filas) {
    const km = origen && i.lat != null && i.lng != null ? distanciaKm(origen, { lat: i.lat, lng: i.lng }) : null;
    // Sin distancia calculable no se descarta: mejor mostrarla que esconder una oferta posible.
    if (limitaRadio && km !== null && km > radio) continue;
    const etapa = etapaPorBusqueda.get(b.id);
    const estado = etapa ? estadoParaDocente(etapa, b.estado) : null;
    ofertas.push({
      id: b.id,
      puesto: b.puesto,
      categoria: b.categoria,
      disciplina: b.disciplina,
      nivel: b.nivel,
      tipo: b.tipo,
      rapida: b.rapida,
      responderEn: b.rapida && b.venceEn ? tiempoRestante(b.venceEn, ahora) : null,
      descripcion: b.descripcion,
      zona: b.zona ?? i.zona,
      horario: horarioDeBusqueda(b),
      institucion: { id: i.id, slug: i.slug, nombre: i.nombre, logoUrl: i.logoUrl, verificada: i.verificada, lat: i.lat, lng: i.lng },
      km,
      favorita: idsFavoritas.has(b.id),
      postulacion: estado ? { texto: estado.texto, tono: estado.tono } : null,
    });
  }

  // Las rápidas primero (ya vienen así de la base); dentro de cada grupo, las más cercanas.
  ofertas.sort((a, b) => {
    if (a.rapida !== b.rapida) return a.rapida ? -1 : 1;
    if (a.km !== null && b.km !== null) return a.km - b.km;
    if (a.km !== null) return -1;
    if (b.km !== null) return 1;
    return 0;
  });

  return { ofertas, radio, conUbicacion };
}

export type DetalleOferta = {
  busqueda: Busqueda;
  institucion: {
    id: string;
    slug: string;
    nombre: string;
    tipo: string;
    descripcion: string | null;
    verificada: boolean;
    direccion: string | null;
    zona: string | null;
    logoUrl: string | null;
    lat: number | null;
    lng: number | null;
  };
  km: number | null;
  /** Fila del docente en esta búsqueda, si se postuló o lo invitaron. */
  postulacion: { id: string; etapa: EtapaPostulacion; origen: "postulacion" | "invitacion" } | null;
  /** Otras búsquedas abiertas de la misma institución (hasta 5). */
  otras: { id: string; puesto: string; tipo: string; rapida: boolean }[];
  totalActivas: number;
  /** Activa y, si es rápida, dentro de su plazo: solo así se puede postular. */
  abierta: boolean;
  /** "40 min", "18 hs": cuánto falta para que venza una rápida abierta. */
  responderEn: string | null;
};

export async function detalleOferta(busquedaId: string, docente: Docente): Promise<DetalleOferta | null> {
  const db = getDb();
  const [fila] = await db
    .select({ busqueda: busquedas, institucion: instituciones })
    .from(busquedas)
    .innerJoin(instituciones, eq(instituciones.id, busquedas.institucionId))
    .where(and(eq(busquedas.id, busquedaId), institucionVisible))
    .limit(1);
  if (!fila) return null;
  const { busqueda, institucion } = fila;

  const [[propia], otras, [conteo]] = await Promise.all([
    db
      .select({ id: postulaciones.id, etapa: postulaciones.etapa, origen: postulaciones.origen })
      .from(postulaciones)
      .where(and(eq(postulaciones.busquedaId, busqueda.id), eq(postulaciones.docenteId, docente.id)))
      .limit(1),
    db
      .select({ id: busquedas.id, puesto: busquedas.puesto, tipo: busquedas.tipo, rapida: busquedas.rapida })
      .from(busquedas)
      .where(
        and(
          eq(busquedas.institucionId, institucion.id),
          eq(busquedas.estado, "activa"),
          ne(busquedas.id, busqueda.id),
        ),
      )
      .orderBy(desc(busquedas.creadoEn))
      .limit(5),
    db
      .select({ total: count() })
      .from(busquedas)
      .where(and(eq(busquedas.institucionId, institucion.id), eq(busquedas.estado, "activa"))),
  ]);

  const km =
    docente.lat != null && docente.lng != null && institucion.lat != null && institucion.lng != null
      ? distanciaKm({ lat: docente.lat, lng: docente.lng }, { lat: institucion.lat, lng: institucion.lng })
      : null;

  return {
    busqueda,
    institucion: {
      id: institucion.id,
      slug: institucion.slug,
      nombre: institucion.nombre,
      tipo: institucion.tipo,
      descripcion: institucion.descripcion,
      verificada: institucion.verificada,
      direccion: institucion.direccion,
      zona: institucion.zona,
      logoUrl: institucion.logoUrl,
      lat: institucion.lat,
      lng: institucion.lng,
    },
    km,
    postulacion: propia ?? null,
    otras,
    totalActivas: conteo?.total ?? 0,
    abierta: busquedaAbierta(busqueda),
    responderEn: busqueda.rapida && busqueda.venceEn ? tiempoRestante(busqueda.venceEn) : null,
  };
}
