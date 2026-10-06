import "server-only";
import { and, asc, count, desc, eq, gt, isNull, or } from "drizzle-orm";
import { getDb } from "@/db";
import { busquedas, cvEnviados, favoritos, institucionMiembros, instituciones, zonas } from "@/db/schema";
import { normalizar } from "@/lib/coincidencia";
import { distanciaKm } from "@/lib/geo";
import { fotosDeInstitucion, novedadesDeInstitucion } from "@/lib/queries/vitrina";
import { busquedaDeInstitucionActiva, institucionVisible } from "@/lib/visibilidad";

/** Búsqueda que todavía se puede responder: activa y, si es rápida, con plazo vigente. */
export function busquedaVigente(ahora = new Date()) {
  return and(
    eq(busquedas.estado, "activa"),
    or(isNull(busquedas.venceEn), gt(busquedas.venceEn, ahora)),
    busquedaDeInstitucionActiva,
  );
}

export type FiltrosInstituciones = { texto: string; tipo: string; zona: string; soloFavoritas: boolean };

export type InstitucionCatalogo = {
  id: string;
  slug: string;
  nombre: string;
  tipo: string;
  zona: string | null;
  descripcion: string | null;
  logoUrl: string | null;
  verificada: boolean;
  lat: number | null;
  lng: number | null;
  busquedasActivas: number;
  favorita: boolean;
};

type Ubicacion = { lat: number | null; lng: number | null };

/**
 * Catálogo de instituciones con búsquedas activas y favoritas del docente. Lo usan el panel del docente
 * y el sitio público (sin `usuarioId`: sin favoritas, y solo las verificadas o con búsquedas abiertas).
 * Los filtros se aplican en memoria para que "Nunez" encuentre "Núñez" (sin extensión unaccent).
 */
export async function catalogoInstituciones(usuarioId: string | null, filtros: FiltrosInstituciones) {
  const db = getDb();
  const ahora = new Date();
  const [filas, favs] = await Promise.all([
    db
      .select({
        id: instituciones.id,
        slug: instituciones.slug,
        nombre: instituciones.nombre,
        tipo: instituciones.tipo,
        zona: instituciones.zona,
        partido: instituciones.partido,
        descripcion: instituciones.descripcion,
        logoUrl: instituciones.logoUrl,
        verificada: instituciones.verificada,
        lat: instituciones.lat,
        lng: instituciones.lng,
        busquedasActivas: count(busquedas.id),
      })
      .from(instituciones)
      .leftJoin(busquedas, and(eq(busquedas.institucionId, instituciones.id), busquedaVigente(ahora)))
      .where(institucionVisible)
      .groupBy(instituciones.id)
      .orderBy(desc(count(busquedas.id)), asc(instituciones.nombre))
      .limit(500),
    usuarioId
      ? db
          .select({ refId: favoritos.refId })
          .from(favoritos)
          .where(and(eq(favoritos.usuarioId, usuarioId), eq(favoritos.tipo, "institucion")))
      : [],
  ]);
  const favoritas = new Set(favs.map((f) => f.refId));

  const q = normalizar(filtros.texto);
  const zonaFiltro = normalizar(filtros.zona);
  return filas
    .filter((i) => usuarioId !== null || i.verificada || i.busquedasActivas > 0)
    .filter((i) => !q || normalizar(i.nombre).includes(q))
    .filter((i) => !filtros.tipo || i.tipo === filtros.tipo)
    .filter((i) => !zonaFiltro || normalizar(`${i.zona ?? ""} ${i.partido ?? ""}`).includes(zonaFiltro))
    .filter((i) => !(usuarioId && filtros.soloFavoritas) || favoritas.has(i.id))
    .map(
      (i): InstitucionCatalogo => ({
        id: i.id,
        slug: i.slug,
        nombre: i.nombre,
        tipo: i.tipo,
        zona: i.zona,
        descripcion: i.descripcion,
        logoUrl: i.logoUrl,
        verificada: i.verificada,
        lat: i.lat,
        lng: i.lng,
        busquedasActivas: i.busquedasActivas,
        favorita: favoritas.has(i.id),
      }),
    );
}

export async function zonasDisponibles() {
  const filas = await getDb().select({ nombre: zonas.nombre }).from(zonas).orderBy(asc(zonas.orden), asc(zonas.nombre));
  return filas.map((z) => z.nombre);
}

/** Km entre el docente y una institución, o null si falta alguna ubicación. */
export function kmEntre(a: Ubicacion, b: Ubicacion) {
  if (a.lat == null || a.lng == null || b.lat == null || b.lng == null) return null;
  return distanciaKm({ lat: a.lat, lng: a.lng }, { lat: b.lat, lng: b.lng });
}

/** Perfil público de una institución para el docente: sin CUIT, CUE, teléfono ni contacto. */
export async function perfilInstitucion(slug: string, usuarioId: string, docenteId: string) {
  const db = getDb();
  const [institucion] = await db
    .select({
      id: instituciones.id,
      slug: instituciones.slug,
      nombre: instituciones.nombre,
      tipo: instituciones.tipo,
      fundada: instituciones.fundada,
      direccion: instituciones.direccion,
      zona: instituciones.zona,
      lat: instituciones.lat,
      lng: instituciones.lng,
      logoUrl: instituciones.logoUrl,
      portadaUrl: instituciones.portadaUrl,
      descripcion: instituciones.descripcion,
      alumnos: instituciones.alumnos,
      niveles: instituciones.niveles,
      turnos: instituciones.turnos,
      docentesPlanta: instituciones.docentesPlanta,
      verificada: instituciones.verificada,
      mision: instituciones.mision,
      vision: instituciones.vision,
      valores: instituciones.valores,
      horarioAdministracion: instituciones.horarioAdministracion,
    })
    .from(instituciones)
    .where(and(eq(instituciones.slug, slug), institucionVisible))
    .limit(1);
  if (!institucion) return null;

  const [abiertas, favorito, cv, fotos, novedades] = await Promise.all([
    db
      .select({
        id: busquedas.id,
        puesto: busquedas.puesto,
        tipo: busquedas.tipo,
        turno: busquedas.turno,
        nivel: busquedas.nivel,
        rapida: busquedas.rapida,
      })
      .from(busquedas)
      .where(and(eq(busquedas.institucionId, institucion.id), busquedaVigente()))
      .orderBy(desc(busquedas.creadoEn)),
    db
      .select({ n: count() })
      .from(favoritos)
      .where(and(eq(favoritos.usuarioId, usuarioId), eq(favoritos.tipo, "institucion"), eq(favoritos.refId, institucion.id))),
    db
      .select({ n: count() })
      .from(cvEnviados)
      .where(and(eq(cvEnviados.docenteId, docenteId), eq(cvEnviados.institucionId, institucion.id))),
    fotosDeInstitucion(institucion.id),
    novedadesDeInstitucion(institucion.id, 6),
  ]);

  return {
    institucion,
    fotos,
    novedades,
    busquedas: abiertas,
    favorita: (favorito[0]?.n ?? 0) > 0,
    cvEnviado: (cv[0]?.n ?? 0) > 0,
  };
}

/** Cuentas que reciben los avisos de una institución: su propietario y los miembros activos del equipo. */
export async function usuariosDeInstitucion(institucionId: string) {
  const db = getDb();
  const [dueno, equipo] = await Promise.all([
    db.select({ id: instituciones.propietarioId }).from(instituciones).where(eq(instituciones.id, institucionId)).limit(1),
    db
      .select({ id: institucionMiembros.usuarioId })
      .from(institucionMiembros)
      .where(and(eq(institucionMiembros.institucionId, institucionId), eq(institucionMiembros.estado, "activo"))),
  ]);
  const ids = [dueno[0]?.id, ...equipo.map((m) => m.id)].filter((id): id is string => !!id);
  return [...new Set(ids)];
}
