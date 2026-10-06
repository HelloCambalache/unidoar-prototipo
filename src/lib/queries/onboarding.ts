import "server-only";
import { cache } from "react";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  asignaturas,
  docenteDetalle,
  zonas,
  type CategoriaDocente,
  type DocenteDetalle,
} from "@/db/schema";
import { CATEGORIAS } from "@/lib/catalogo";
import { normalizarTexto } from "@/lib/onboarding";

/* Lecturas del alta: catálogos (asignaturas, zonas) y resolución de ubicaciones. */

export type CatalogoAsignaturas = Record<CategoriaDocente, { rubro: string; items: string[] }[]>;

/** Catálogo categoría → rubro → asignaturas, como lo edita el backoffice (tabla `asignaturas`). */
export const catalogoAsignaturas = cache(async (): Promise<CatalogoAsignaturas> => {
  const filas = await getDb()
    .select()
    .from(asignaturas)
    .orderBy(asc(asignaturas.orden), asc(asignaturas.rubro), asc(asignaturas.nombre));

  const salida = Object.fromEntries(CATEGORIAS.map((c) => [c, [] as { rubro: string; items: string[] }[]])) as CatalogoAsignaturas;
  for (const f of filas) {
    const grupos = salida[f.categoria];
    let grupo = grupos.find((g) => g.rubro === f.rubro);
    if (!grupo) {
      grupo = { rubro: f.rubro, items: [] };
      grupos.push(grupo);
    }
    grupo.items.push(f.nombre);
  }
  return salida;
});

/** Nombres válidos de una categoría: el servidor rechaza cualquier asignatura que no esté en el catálogo. */
export async function nombresDeAsignaturas(categoria: CategoriaDocente) {
  const catalogo = await catalogoAsignaturas();
  return new Set(catalogo[categoria].flatMap((g) => g.items));
}

export type ZonaSugerida = { nombre: string; partido: string | null; provincia: string; lat: number | null; lng: number | null };

/** Zonas conocidas (con coordenadas): sirven de sugerencia y para ubicar al docente y a la institución. */
export const zonasConocidas = cache(async (): Promise<ZonaSugerida[]> => {
  const filas = await getDb().select().from(zonas).orderBy(asc(zonas.orden), asc(zonas.nombre));
  return filas.map(({ nombre, partido, provincia, lat, lng }) => ({ nombre, partido, provincia, lat, lng }));
});

/** Partidos y provincias que ya existen en el catálogo de zonas, para autocompletar los formularios. */
export async function opcionesDeUbicacion() {
  const todas = await zonasConocidas();
  const unicos = (xs: (string | null)[]) => [...new Set(xs.filter((x): x is string => Boolean(x)))];
  return { partidos: unicos(todas.map((z) => z.partido)), provincias: unicos(todas.map((z) => z.provincia)) };
}

const ALIAS_CABA = new Set(["caba", "c a b a", "capital federal", "ciudad de buenos aires", "ciudad autonoma de buenos aires"]);
const nombrePartido = (t: string) => (ALIAS_CABA.has(normalizarTexto(t)) ? "caba" : normalizarTexto(t));

const centroide = (puntos: { lat: number | null; lng: number | null }[]) => {
  const validos = puntos.filter((p): p is { lat: number; lng: number } => p.lat != null && p.lng != null);
  if (validos.length === 0) return { lat: null, lng: null };
  return {
    lat: validos.reduce((s, p) => s + p.lat, 0) / validos.length,
    lng: validos.reduce((s, p) => s + p.lng, 0) / validos.length,
  };
};

/**
 * Ubica una institución a partir de su dirección y partido, con la tabla `zonas`:
 * 1) alguna zona nombrada en la dirección ("…, Villa Adelina"); 2) una zona que se llama como el partido;
 * 3) el centro de las zonas de ese partido. Si nada coincide, queda sin coordenadas (no se inventan).
 * `zona` es el texto para mostrar ("Villa Adelina, Vicente López").
 */
export async function ubicarInstitucion(entrada: { direccion: string; partido: string }) {
  const todas = await zonasConocidas();
  const direccion = ` ${normalizarTexto(entrada.direccion)} `;
  const enDireccion = todas
    .filter((z) => direccion.includes(` ${normalizarTexto(z.nombre)} `))
    .sort((a, b) => b.nombre.length - a.nombre.length)[0];
  const partido = nombrePartido(entrada.partido);
  const comoPartido = todas.find((z) => normalizarTexto(z.nombre) === partido);
  const delPartido = todas.filter((z) => z.partido && nombrePartido(z.partido) === partido);

  const exacta = enDireccion ?? comoPartido;
  if (exacta) {
    const zona = exacta.partido && exacta.nombre !== exacta.partido ? `${exacta.nombre}, ${exacta.partido}` : exacta.nombre;
    return { zona, lat: exacta.lat, lng: exacta.lng };
  }
  if (delPartido.length > 0) return { zona: entrada.partido, ...centroide(delPartido) };
  return { zona: entrada.partido, lat: null, lng: null };
}

/**
 * Coordenadas de un docente: el centro de las zonas que eligió que existen en el catálogo; si ninguna
 * coincide, las del partido de su domicilio. Sin coincidencias queda en null (se completa más adelante).
 */
export async function ubicarDocente(entrada: { zonas: string[]; partido?: string | null }) {
  const todas = await zonasConocidas();
  const elegidas = new Set(entrada.zonas.map(normalizarTexto));
  const coincidentes = todas.filter((z) => elegidas.has(normalizarTexto(z.nombre)));
  if (coincidentes.length > 0) return centroide(coincidentes);
  if (entrada.partido) {
    const partido = nombrePartido(entrada.partido);
    const delPartido = todas.filter(
      (z) => normalizarTexto(z.nombre) === partido || (z.partido && nombrePartido(z.partido) === partido),
    );
    if (delPartido.length > 0) return centroide(delPartido);
  }
  return { lat: null, lng: null };
}

/** Datos del alta que no están en `docentes` (DNI, grilla, documentación…). */
export async function detalleDeDocente(docenteId: string): Promise<DocenteDetalle | null> {
  const [fila] = await getDb().select().from(docenteDetalle).where(eq(docenteDetalle.docenteId, docenteId)).limit(1);
  return fila ?? null;
}
