import "server-only";
import { and, count, desc, eq, gt, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  busquedas,
  favoritos,
  institucionSedes,
  instituciones,
  postulaciones,
  type Busqueda,
  type CategoriaDocente,
  type Docente,
  type EtapaPostulacion,
} from "@/db/schema";
import { distanciaKm } from "@/lib/geo";
import { contarSedes } from "@/lib/queries/sedes";
import { lugarDeBusqueda } from "@/lib/sedes";
import { busquedaAbierta, RADIO_MAX, tiempoRestante, type FiltrosOportunidades } from "@/lib/oportunidades";
import { estadoParaDocente } from "@/lib/postulaciones";
import { contiene, palabrasDeBusqueda } from "@/lib/sql-texto";
import { busquedaDeInstitucionActiva, busquedaVigente, institucionVisible } from "@/lib/visibilidad";

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
  /** Zona de la búsqueda o, si no tiene, la de su sede (o la de la institución en las búsquedas sin sede). */
  zona: string | null;
  /** Nombre de la sede donde es la búsqueda; solo si la institución tiene más de una. */
  sede: string | null;
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
  /** Distancia entre el docente y la sede de la búsqueda; null si falta alguna de las dos ubicaciones. */
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
 * Búsquedas abiertas que ve el docente en "Buscar trabajo" y "Búsquedas rápidas", y las que ve cualquier
 * visita en el sitio público (`docente` y `usuarioId` en null: sin distancias, favoritas ni postulaciones).
 * Las rápidas vencidas no se listan: ya no aceptan respuesta.
 */
export async function listarOportunidades(
  docente: Docente | null,
  usuarioId: string | null,
  filtros: FiltrosOportunidades,
): Promise<ResultadoOportunidades> {
  const db = getDb();
  const ahora = new Date();
  const radio = filtros.radio ?? docente?.radioKm ?? RADIO_MAX;
  const origen = docente?.lat != null && docente.lng != null ? { lat: docente.lat, lng: docente.lng } : null;
  const conUbicacion = origen !== null;

  const [favoritas, propias] = await Promise.all([
    usuarioId
      ? db
          .select({ id: favoritos.refId })
          .from(favoritos)
          .where(and(eq(favoritos.usuarioId, usuarioId), eq(favoritos.tipo, "busqueda")))
      : [],
    docente
      ? db
          .select({ busquedaId: postulaciones.busquedaId, etapa: postulaciones.etapa, examenPreocupacionalEn: postulaciones.examenPreocupacionalEn })
          .from(postulaciones)
          .where(eq(postulaciones.docenteId, docente.id))
      : [],
  ]);
  const idsFavoritas = new Set(favoritas.map((f) => f.id));
  const soloFavoritas = !!usuarioId && !!filtros.favoritos;
  if (soloFavoritas && idsFavoritas.size === 0) return { ofertas: [], radio, conUbicacion };
  const etapaPorBusqueda = new Map<string, EtapaPostulacion>(propias.map((p) => [p.busquedaId, p.etapa]));
  const conExamenRealizado = new Set(propias.filter((p) => p.examenPreocupacionalEn).map((p) => p.busquedaId));

  const condiciones = [
    eq(busquedas.estado, "activa"),
    busquedaDeInstitucionActiva,
    or(eq(busquedas.rapida, false), isNull(busquedas.venceEn), gt(busquedas.venceEn, ahora)),
    filtros.categoria ? eq(busquedas.categoria, filtros.categoria) : undefined,
    filtros.nivel ? eq(busquedas.nivel, filtros.nivel) : undefined,
    filtros.turno ? eq(busquedas.turno, filtros.turno) : undefined,
    // "Suplencia" trae también las suplencias rápidas: quien busca suplencias las quiere todas.
    filtros.tipo ? (filtros.tipo === "Suplencia" ? inArray(busquedas.tipo, ["Suplencia", "Suplencia rápida"]) : eq(busquedas.tipo, filtros.tipo)) : undefined,
    filtros.rapidas ? eq(busquedas.rapida, true) : undefined,
    filtros.verificadas ? eq(instituciones.verificada, true) : undefined,
    soloFavoritas ? inArray(busquedas.id, [...idsFavoritas]) : undefined,
    // Cada palabra tiene que estar en el puesto, la materia o el nombre de la institución (los tres juntos): "San Andrés" encuentra
    // las de "Colegio San Andrés" y "inglés San Andrés", las de inglés de esa institución. El buscador es uno solo (frase o texto).
    ...palabrasDeBusqueda(filtros.q ?? "").map((palabra) =>
      contiene(sql`concat_ws(' ', ${busquedas.puesto}, ${busquedas.disciplina}, ${instituciones.nombre})`, palabra),
    ),
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
        direccion: instituciones.direccion,
        zona: instituciones.zona,
        lat: instituciones.lat,
        lng: instituciones.lng,
      },
      sede: institucionSedes,
    })
    .from(busquedas)
    .innerJoin(instituciones, eq(instituciones.id, busquedas.institucionId))
    .leftJoin(institucionSedes, eq(institucionSedes.id, busquedas.sedeId))
    .where(and(...condiciones))
    .orderBy(desc(busquedas.rapida), desc(busquedas.creadoEn))
    .limit(500);

  const limitaRadio = origen !== null && radio < RADIO_MAX;
  const cantidadDeSedes = await contarSedes([...new Set(filas.map((f) => f.institucion.id))]);

  const ofertas: OfertaListada[] = [];
  for (const { busqueda: b, institucion: i, sede } of filas) {
    // Los kilómetros, el mapa y la zona salen de la sede de la búsqueda (o, sin sede, de la institución).
    const lugar = lugarDeBusqueda(sede, i);
    const km = origen && lugar.lat != null && lugar.lng != null ? distanciaKm(origen, { lat: lugar.lat, lng: lugar.lng }) : null;
    // Sin distancia calculable no se descarta: mejor mostrarla que esconder una oferta posible.
    if (limitaRadio && km !== null && km > radio) continue;
    const etapa = etapaPorBusqueda.get(b.id);
    const estado = etapa ? estadoParaDocente(etapa, b.estado, conExamenRealizado.has(b.id)) : null;
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
      zona: b.zona ?? lugar.zona,
      sede: sede && (cantidadDeSedes.get(i.id) ?? 0) > 1 ? sede.nombre : null,
      horario: horarioDeBusqueda(b),
      institucion: { id: i.id, slug: i.slug, nombre: i.nombre, logoUrl: i.logoUrl, verificada: i.verificada, lat: lugar.lat, lng: lugar.lng },
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
  /** Nombre de la sede donde es la búsqueda; solo si la institución tiene más de una. */
  sede: string | null;
  km: number | null;
  /** Fila del docente en esta búsqueda, si se postuló o lo invitaron. */
  postulacion: { id: string; etapa: EtapaPostulacion; origen: "postulacion" | "invitacion"; examenRealizado: boolean } | null;
  /** Otras búsquedas abiertas de la misma institución (hasta 5). */
  otras: { id: string; puesto: string; tipo: string; rapida: boolean }[];
  totalActivas: number;
  /** Cuántas personas se postularon (sin contar invitaciones) y cuántas en los últimos 3 días. Solo números: nunca quiénes. */
  postulantes: { total: number; recientes: number };
  /** Activa y, si es rápida, dentro de su plazo: solo así se puede postular. */
  abierta: boolean;
  /** "40 min", "18 hs": cuánto falta para que venza una rápida abierta. */
  responderEn: string | null;
};

export async function detalleOferta(busquedaId: string, docente: Docente): Promise<DetalleOferta | null> {
  const db = getDb();
  const [fila] = await db
    .select({ busqueda: busquedas, institucion: instituciones, sede: institucionSedes })
    .from(busquedas)
    .innerJoin(instituciones, eq(instituciones.id, busquedas.institucionId))
    .leftJoin(institucionSedes, eq(institucionSedes.id, busquedas.sedeId))
    .where(and(eq(busquedas.id, busquedaId), institucionVisible))
    .limit(1);
  if (!fila) return null;
  const { busqueda, institucion, sede } = fila;
  // Dónde queda: la sede de la búsqueda o, sin sede, la institución (que refleja a su sede principal).
  const lugar = lugarDeBusqueda(sede, institucion);
  const cantidadDeSedes = sede ? ((await contarSedes([institucion.id])).get(institucion.id) ?? 0) : 0;

  const [[propia], otras, [conteo], [postulantes]] = await Promise.all([
    db
      .select({ id: postulaciones.id, etapa: postulaciones.etapa, origen: postulaciones.origen, examenPreocupacionalEn: postulaciones.examenPreocupacionalEn })
      .from(postulaciones)
      .where(and(eq(postulaciones.busquedaId, busqueda.id), eq(postulaciones.docenteId, docente.id)))
      .limit(1),
    db
      .select({ id: busquedas.id, puesto: busquedas.puesto, tipo: busquedas.tipo, rapida: busquedas.rapida })
      .from(busquedas)
      .where(
        and(
          eq(busquedas.institucionId, institucion.id),
          busquedaVigente,
          ne(busquedas.id, busqueda.id),
        ),
      )
      .orderBy(desc(busquedas.creadoEn))
      .limit(5),
    db
      .select({ total: count() })
      .from(busquedas)
      .where(and(eq(busquedas.institucionId, institucion.id), busquedaVigente)),
    // Solo cuántas personas se postularon (no quiénes): las invitaciones sin respuesta no cuentan.
    db
      .select({
        total: count(),
        recientes: sql<number>`count(*) filter (where ${postulaciones.creadoEn} > now() - interval '3 days')`.mapWith(Number),
      })
      .from(postulaciones)
      .where(and(eq(postulaciones.busquedaId, busqueda.id), eq(postulaciones.origen, "postulacion"))),
  ]);

  const km =
    docente.lat != null && docente.lng != null && lugar.lat != null && lugar.lng != null
      ? distanciaKm({ lat: docente.lat, lng: docente.lng }, { lat: lugar.lat, lng: lugar.lng })
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
      direccion: lugar.direccion,
      zona: lugar.zona,
      logoUrl: institucion.logoUrl,
      lat: lugar.lat,
      lng: lugar.lng,
    },
    sede: sede && cantidadDeSedes > 1 ? sede.nombre : null,
    km,
    postulacion: propia ? { id: propia.id, etapa: propia.etapa, origen: propia.origen, examenRealizado: !!propia.examenPreocupacionalEn } : null,
    otras,
    totalActivas: conteo?.total ?? 0,
    postulantes: { total: postulantes?.total ?? 0, recientes: postulantes?.recientes ?? 0 },
    abierta: busquedaAbierta(busqueda),
    responderEn: busqueda.rapida && busqueda.venceEn ? tiempoRestante(busqueda.venceEn) : null,
  };
}
