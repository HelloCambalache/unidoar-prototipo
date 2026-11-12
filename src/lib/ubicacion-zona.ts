import { normalizarTexto } from "@/lib/onboarding";

/*
 * Ubicar una ZONA escrita a mano ("La Plata", "Mar del Plata"): las zonas del catálogo son pocas (zona norte) y un profesional puede
 * trabajar en cualquier lugar. Se le pregunta a Georef (API oficial del Estado) por la localidad y se usa su punto central para
 * calcular las distancias. Es una ayuda: si Georef no responde o el nombre es ambiguo, la zona se guarda igual, solo sin coordenadas.
 * Todo es puro (sin red ni base) para poder probarlo; la consulta está en src/lib/queries/ubicacion-zonas.ts.
 */

export type ZonaUbicada = {
  /** Como la escribe Georef ("La Plata"). */
  nombre: string;
  provincia: string;
  partido: string | null;
  lat: number;
  lng: number;
};

type Crudo = Record<string, unknown> | null | undefined;
const texto = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const nombreDe = (o: unknown) => texto((o as { nombre?: unknown } | null | undefined)?.nombre);

/** Un resultado de `/localidades` de Georef (con `campos=nombre,centroide,departamento,provincia,municipio`). */
export function desdeGeorefLocalidad(l: Crudo): ZonaUbicada | null {
  const centroide = l?.centroide as { lat?: unknown; lon?: unknown } | undefined;
  const lat = centroide?.lat;
  const lng = centroide?.lon;
  if (typeof lat !== "number" || typeof lng !== "number" || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const nombre = texto(l?.nombre);
  const provincia = nombreDe(l?.provincia);
  if (!nombre || !provincia) return null;
  return { nombre, provincia, partido: nombreDe(l?.departamento) ?? nombreDe(l?.municipio), lat, lng };
}

/**
 * Cuál de las localidades que devolvió Georef es la que escribió la persona. Georef busca por parecido ("La Plata" trae también
 * "Mar del Plata" y "Cordón del Plata"), así que solo sirve un nombre IGUAL al escrito (sin mirar tildes ni mayúsculas).
 * Si hay iguales en varias provincias ("San Martín" existe en diez), se prefieren las provincias donde la app ya tiene zonas y, si
 * ninguna lo es, no se adivina: es mejor guardar la zona sin coordenadas que con las de otro extremo del país.
 */
export function elegirZona(
  escrita: string,
  candidatas: readonly ZonaUbicada[],
  provinciasPreferidas: ReadonlySet<string> = new Set(),
): ZonaUbicada | null {
  const clave = normalizarTexto(escrita);
  if (!clave) return null;
  const iguales = candidatas.filter((c) => normalizarTexto(c.nombre) === clave);
  if (iguales.length === 0) return null;
  const provincias = new Set(iguales.map((c) => normalizarTexto(c.provincia)));
  if (provincias.size === 1) return iguales[0]!;
  return iguales.find((c) => provinciasPreferidas.has(normalizarTexto(c.provincia))) ?? null;
}

export type Punto = { lat: number; lng: number };

/**
 * El punto de la primera zona (en el orden en que las escribió la persona: la primera es la principal) que se pueda ubicar: primero
 * se mira el catálogo de zonas y, si no la conoce, se le pregunta a Georef. Las consultas a Georef de las zonas que el catálogo no
 * conoce (hasta `maximoPorGeoref`) salen todas juntas, así la espera no se suma; una que falla cuenta como «no ubicada».
 */
export async function primeraZonaUbicada(
  escritas: readonly string[],
  delCatalogo: (zona: string) => Punto | null,
  porGeoref: (zona: string) => Promise<Punto | null>,
  maximoPorGeoref = 3,
): Promise<Punto | null> {
  const consultas = new Map<string, Promise<Punto | null>>();
  for (const z of escritas) {
    if (consultas.size >= maximoPorGeoref) break;
    if (!delCatalogo(z)) consultas.set(z, porGeoref(z).catch(() => null));
  }
  for (const z of escritas) {
    const delCat = delCatalogo(z);
    if (delCat) return delCat;
    const resultado = await consultas.get(z);
    if (resultado) return resultado;
  }
  return null;
}

/** Georef rechaza un nombre muy corto o muy largo; lo escrito se limpia antes de preguntar. */
export function consultaDeZona(escrita: string): string | null {
  const limpio = escrita.trim().replace(/\s+/g, " ");
  return limpio.length >= 3 && limpio.length <= 80 ? limpio : null;
}
