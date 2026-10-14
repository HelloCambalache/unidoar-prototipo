import { z } from "zod";
import { distanciaKm } from "@/lib/geo";

/*
 * Sedes de una institución: una organización (colegio, club) con uno o más lugares físicos. Reglas puras (sin base ni Next)
 * para poder probarlas. Toda institución tiene siempre una sede principal; las columnas de ubicación de `instituciones`
 * (dirección, partido, provincia, zona, lat, lng, CUE) son un ESPEJO de esa sede principal (`espejoDePrincipal`).
 */

export const MAX_SEDES = 20;
export const NOMBRE_SEDE_PRINCIPAL = "Sede principal";
const MIN_NOMBRE = 2;
const MAX_NOMBRE = 60;

/** Lo que se sabe de una sede en cualquier pantalla. */
export type SedeVista = {
  id: string;
  nombre: string;
  direccion: string | null;
  partido: string | null;
  provincia: string | null;
  /** Texto para mostrar y para cruzar con las zonas de los profesionales: "Villa Adelina, Vicente López". */
  zona: string | null;
  lat: number | null;
  lng: number | null;
  /** Código del establecimiento (escuelas): identifica a la sede, no a toda la organización. */
  cue: string | null;
  esPrincipal: boolean;
};

type Punto = { lat: number | null; lng: number | null };
type ConPunto = Punto & { esPrincipal?: boolean };

/** Principal primero y después por nombre (sin distinguir mayúsculas ni tildes). */
export function ordenarSedes<T extends { nombre: string; esPrincipal: boolean }>(sedes: readonly T[]): T[] {
  return [...sedes].sort(
    (a, b) => Number(b.esPrincipal) - Number(a.esPrincipal) || a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }),
  );
}

/** La sede principal; si por algún motivo no hubiera ninguna marcada, la primera. */
export function sedePrincipal<T extends { esPrincipal: boolean }>(sedes: readonly T[]): T | null {
  return sedes.find((s) => s.esPrincipal) ?? sedes[0] ?? null;
}

const tienePunto = (s: Punto): s is { lat: number; lng: number } => s.lat != null && s.lng != null;

/**
 * La sede más cercana a un punto, con los kilómetros. Solo cuentan las sedes con coordenadas. Sin punto de referencia o sin
 * ninguna sede ubicada devuelve null (quien llama decide si usa la principal sin distancia).
 */
export function sedeMasCercana<T extends Punto>(origen: Punto | null | undefined, sedes: readonly T[]): { sede: T; km: number } | null {
  if (!origen || !tienePunto(origen)) return null;
  let mejor: { sede: T; km: number } | null = null;
  for (const sede of sedes) {
    if (!tienePunto(sede)) continue;
    const km = distanciaKm({ lat: origen.lat, lng: origen.lng }, { lat: sede.lat, lng: sede.lng });
    if (!mejor || km < mejor.km) mejor = { sede, km };
  }
  return mejor;
}

/**
 * Qué sede usar para medir distancias desde ella: la de la búsqueda si hay una, y si no la principal.
 * (`sedeDeLaBusqueda` es null en búsquedas viejas o con la sede borrada.)
 */
export function sedeParaMedir<T extends ConPunto & { esPrincipal: boolean }>(sedes: readonly T[], sedeDeLaBusqueda?: T | null): T | null {
  return sedeDeLaBusqueda ?? sedePrincipal(sedes);
}

/** Lo de una sede que ve cualquiera (el sitio público y los profesionales): nunca el CUE ni el id. */
export type SedePublica = { nombre: string; direccion: string | null; zona: string | null; lat: number | null; lng: number | null };

/** Se arma campo por campo a propósito: una columna nueva de `SedeVista` no se filtra sola a las páginas públicas. */
export const aSedePublica = (s: Pick<SedeVista, "nombre" | "direccion" | "zona" | "lat" | "lng">): SedePublica => ({
  nombre: s.nombre,
  direccion: s.direccion,
  zona: s.zona,
  lat: s.lat,
  lng: s.lng,
});

/** Un lugar desde el cual se miden distancias a los profesionales (siempre con coordenadas). */
export type PuntoDeReferencia = { nombre: string; lat: number; lng: number };

/**
 * Desde dónde se mide la cercanía de los profesionales cuando una institución los busca: la sede de la búsqueda elegida (solo esa) o,
 * sin búsqueda, todas sus sedes ubicadas (cada profesional se mide contra la más cercana). Una sede sin coordenadas no mide nada.
 * Si ninguna sede está ubicada se usa, de respaldo, la ubicación de la ficha de la institución.
 */
export function puntosDeReferencia(
  sedes: readonly { id: string; nombre: string; lat: number | null; lng: number | null }[],
  sedeDeLaBusqueda: string | null | undefined,
  respaldo?: { nombre: string; lat: number | null; lng: number | null } | null,
): PuntoDeReferencia[] {
  const ubicada = (s: { nombre: string; lat: number | null; lng: number | null }): PuntoDeReferencia[] =>
    s.lat != null && s.lng != null ? [{ nombre: s.nombre, lat: s.lat, lng: s.lng }] : [];
  const deLaBusqueda = sedeDeLaBusqueda ? sedes.find((s) => s.id === sedeDeLaBusqueda) : undefined;
  if (deLaBusqueda) return ubicada(deLaBusqueda);
  const todas = sedes.flatMap(ubicada);
  if (todas.length > 0 || sedes.length > 0) return todas;
  return respaldo ? ubicada(respaldo) : [];
}

/** Lo que se necesita de un lugar para medir distancias y mostrar dónde queda. */
export type Lugar = { direccion: string | null; zona: string | null; lat: number | null; lng: number | null };

/**
 * Dónde queda una búsqueda: el de su sede y, si no tiene (búsquedas viejas, o la sede se borró cuando ya estaba cerrada), el de la
 * institución, que es el de su sede principal. Una sede sin ubicar NO toma la de la institución: sus kilómetros quedan sin calcular
 * antes que medir contra otro lugar.
 */
export function lugarDeBusqueda<I extends Lugar>(sede: Lugar | null | undefined, institucion: I): Lugar {
  return sede ?? institucion;
}

/** "Sede Olivos" / "3 sedes" / null cuando hay una sola y no hace falta decirlo. */
export function resumenDeSedes(sedes: readonly { nombre: string }[]): string | null {
  if (sedes.length <= 1) return null;
  return `${sedes.length} sedes`;
}

/** Cómo se nombra una sede junto a la institución: la principal de una institución con una sola sede no lleva nombre. */
export function nombreVisibleDeSede(sede: { nombre: string }, totalSedes: number): string | null {
  return totalSedes > 1 ? sede.nombre : null;
}

/** Lo de la sede principal que `instituciones` guarda como espejo (así lo que lee solo la institución sigue andando). */
export function espejoDePrincipal(s: Pick<SedeVista, "direccion" | "partido" | "provincia" | "zona" | "lat" | "lng" | "cue">) {
  return { direccion: s.direccion, partido: s.partido, provincia: s.provincia, zona: s.zona, lat: s.lat, lng: s.lng, cue: s.cue };
}

export type SedeEditable = { id?: string | null; nombre: string; esPrincipal: boolean };
export type ErrorDeSedes = { error: string; campos: Record<string, string> };

const clave = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();

/**
 * Valida la lista de sedes que se guarda: al menos una, hasta MAX_SEDES, nombre de 2 a 60 caracteres sin repetirse y
 * exactamente una principal. Devuelve null si está bien. Los errores por sede vienen como `sedes.<n>.nombre`.
 */
export function validarSedes(sedes: readonly SedeEditable[]): ErrorDeSedes | null {
  if (sedes.length === 0) return { error: "La institución tiene que tener al menos una sede.", campos: {} };
  if (sedes.length > MAX_SEDES) return { error: `Hasta ${MAX_SEDES} sedes.`, campos: {} };

  const campos: Record<string, string> = {};
  const vistos = new Map<string, number>();
  sedes.forEach((s, i) => {
    const nombre = s.nombre.trim();
    if (nombre.length < MIN_NOMBRE) campos[`sedes.${i}.nombre`] = "Poné un nombre para la sede (ej. Olivos).";
    else if (nombre.length > MAX_NOMBRE) campos[`sedes.${i}.nombre`] = `Máximo ${MAX_NOMBRE} caracteres.`;
    else if (vistos.has(clave(nombre))) campos[`sedes.${i}.nombre`] = "Ya hay otra sede con ese nombre.";
    else vistos.set(clave(nombre), i);
  });
  if (Object.keys(campos).length > 0) return { error: "Revisá los nombres de las sedes.", campos };

  const principales = sedes.filter((s) => s.esPrincipal).length;
  if (principales !== 1) return { error: "Tiene que haber exactamente una sede principal.", campos: {} };
  return null;
}

/**
 * ¿Se puede quitar esta sede? No la principal (hay que marcar otra antes) y no una con búsquedas abiertas o pausadas
 * (las cerradas son historia y quedan sin sede).
 */
export function puedeQuitarSede(sede: { esPrincipal: boolean }, busquedasAbiertas: number): { ok: true } | { ok: false; error: string } {
  if (sede.esPrincipal) return { ok: false, error: "No se puede quitar la sede principal: marcá otra como principal primero." };
  if (busquedasAbiertas > 0) {
    return {
      ok: false,
      error:
        busquedasAbiertas === 1
          ? "Esta sede tiene una búsqueda abierta: cerrala o pasala a otra sede antes de quitarla."
          : `Esta sede tiene ${busquedasAbiertas} búsquedas abiertas: cerralas o pasalas a otra sede antes de quitarla.`,
    };
  }
  return { ok: true };
}

/* ───────── Lo que manda el editor de sedes ───────── */

/**
 * Una sede tal como la manda el formulario. La forma se valida acá; el nombre (largo, repetidos) y la principal los valida
 * `validarSedes`. `ubicacion` es la firma de la sugerencia de dirección que eligió la persona (/api/ubicacion): el servidor la
 * verifica antes de usarla, nunca le cree coordenadas al navegador. `cue` solo lo respeta el equipo de UNIDOAR.
 */
export const sedeEntradaSchema = z.object({
  id: z.guid().optional(),
  nombre: z.string().max(200),
  direccion: z.string().trim().min(3, "Completá la dirección").max(200, "Máximo 200 caracteres"),
  zona: z.string().trim().max(160, "Máximo 160 caracteres"),
  cue: z.string().trim().max(20, "Máximo 20 caracteres").optional(),
  ubicacion: z.string().max(4000).optional(),
  esPrincipal: z.boolean(),
});

export const sedesEntradaSchema = z.object({
  sedes: z.array(sedeEntradaSchema).min(1, "La institución tiene que tener al menos una sede.").max(MAX_SEDES, `Hasta ${MAX_SEDES} sedes.`),
});

export type SedeEntrada = z.infer<typeof sedeEntradaSchema>;

type SedeComparable = { id?: string | null; nombre: string; direccion: string | null; zona: string | null; cue: string | null; esPrincipal: boolean };

const comoTexto = (v: string | null | undefined) => (v ?? "").trim();

/**
 * Una huella de las sedes guardadas cuando se abrió la pantalla: se manda al guardar y el servidor la compara con lo que hay en ese
 * momento; si no coinciden, otra persona del equipo las cambió mientras tanto y no se pisa lo suyo. Solo cuentan las sedes que ya existen
 * (las que tienen `id`), en cualquier orden, y de cada una lo que se edita: nombre, dirección, zona, cuál es la principal y, si quien
 * edita puede cargarlo (`conCue`), el CUE. La ubicación en el mapa no entra: sale de la dirección.
 */
export function huellaDeSedes(
  sedes: readonly { id?: string | null; nombre: string; direccion: string | null; zona: string | null; cue: string | null; esPrincipal: boolean }[],
  opciones: { conCue: boolean },
): string {
  return JSON.stringify(
    sedes
      .flatMap((s) => (s.id ? [[s.id, comoTexto(s.nombre), comoTexto(s.direccion), comoTexto(s.zona), opciones.conCue ? comoTexto(s.cue) : "", s.esPrincipal] as const] : []))
      .sort((a, b) => a[0].localeCompare(b[0])),
  );
}

/**
 * Nombres (en castellano) de lo que cambió entre las sedes guardadas y las que se mandan, para la actividad del equipo: nunca los
 * valores. Las sedes se emparejan por `id`; una sin `id` (o con uno que no existía) es nueva.
 */
export function cambiosDeSedes(antes: readonly SedeComparable[], despues: readonly SedeComparable[]): string[] {
  const previas = new Map(antes.map((s) => [s.id, s]));
  const cambios = new Set<string>();
  const idsNuevos = new Set(despues.flatMap((s) => (s.id ? [s.id] : [])));

  for (const s of despues) {
    const antesDe = s.id ? previas.get(s.id) : undefined;
    if (!antesDe) {
      cambios.add("sedes agregadas");
      continue;
    }
    if (comoTexto(antesDe.nombre) !== comoTexto(s.nombre)) cambios.add("nombre de sede");
    if (comoTexto(antesDe.direccion) !== comoTexto(s.direccion)) cambios.add("dirección de sede");
    if (comoTexto(antesDe.zona) !== comoTexto(s.zona)) cambios.add("zona de sede");
    if (comoTexto(antesDe.cue) !== comoTexto(s.cue)) cambios.add("CUE de sede");
    if (antesDe.esPrincipal !== s.esPrincipal) cambios.add("sede principal");
  }
  if (antes.some((s) => s.id && !idsNuevos.has(s.id))) cambios.add("sedes quitadas");
  return [...cambios];
}
