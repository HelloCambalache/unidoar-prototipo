import { createHmac, timingSafeEqual } from "node:crypto";
import { normalizarTexto } from "@/lib/onboarding";

/*
 * Ubicar una dirección escrita a mano: interpreta lo que devuelven Georef (API oficial del Estado argentino) y
 * OpenStreetMap, ordena los resultados según lo que la persona escribió ("Av. Maipú 1234, Vicente López") y firma
 * la sugerencia que elige para que el servidor no tenga que confiar en coordenadas que vengan del navegador.
 * Todo es puro (sin red ni base) para poder probarlo; las consultas están en src/lib/ubicacion-busqueda.ts.
 */

export type FuenteUbicacion = "georef" | "osm";

export type Ubicacion = {
  /** "Av. Maipu 1234, Vicente López, Buenos Aires": lo que se muestra en la sugerencia. */
  etiqueta: string;
  /** Calle y altura ya prolijas ("Av. del Libertador 4800"), o null si la fuente no la trae. */
  calle: string | null;
  /** Partido, o "CABA" para la Ciudad (así lo usa el catálogo de zonas). */
  partido: string;
  provincia: string;
  localidad: string | null;
  lat: number;
  lng: number;
  /** Se resolvió la altura (el número de la calle), no solo la calle. */
  exacta: boolean;
  fuente: FuenteUbicacion;
  /** Lo que escribió la persona después de la primera coma (o el partido que ya cargó) coincide con este resultado. */
  coincide: boolean;
};

/* ───────────────────────────── Texto ───────────────────────────── */

const CONECTORES = new Set(["de", "del", "la", "las", "los", "y", "e", "el"]);
const ABREVIATURAS: Record<string, string> = { av: "Av.", avda: "Av.", gral: "Gral.", grl: "Gral.", cnel: "Cnel.", dr: "Dr.", pte: "Pte.", tte: "Tte.", dip: "Dip." };

/** "AV DEL LIBERTADOR" → "Av. del Libertador" (Georef devuelve las calles en mayúsculas y sin tildes). */
export function titulo(texto: string): string {
  return texto
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((palabra, i) => {
      const abreviatura = ABREVIATURAS[palabra.replace(/\.$/, "")];
      if (abreviatura) return abreviatura;
      if (i > 0 && CONECTORES.has(palabra)) return palabra;
      return palabra.charAt(0).toUpperCase() + palabra.slice(1);
    })
    .join(" ");
}

const NOMBRES_DE_CABA = new Set(["ciudad autonoma de buenos aires", "caba", "capital federal", "ciudad de buenos aires", "c a b a"]);
export const esCaba = (provinciaOPartido: string | null | undefined) => NOMBRES_DE_CABA.has(normalizarTexto(provinciaOPartido ?? ""));

/** "Av. Maipú 1234, Vicente López" → la calle con su número y las pistas de lugar que vienen después de la coma. */
export function separarDireccion(texto: string): { calle: string; pistas: string[] } {
  const partes = texto.split(",").map((p) => p.trim()).filter(Boolean);
  return { calle: partes[0] ?? "", pistas: partes.slice(1) };
}

/** Dos direcciones son "la misma" si solo difieren en mayúsculas, tildes o signos. */
export const claveDeDireccion = (texto: string) => normalizarTexto(texto);

/* ───────────────────────────── Georef y OpenStreetMap ───────────────────────────── */

type Crudo = Record<string, unknown> | null | undefined;
const texto = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const nombreDe = (o: unknown) => texto((o as { nombre?: unknown } | null | undefined)?.nombre);

function armarEtiqueta(calle: string | null, localidad: string | null, partido: string, provincia: string) {
  const caba = partido === "CABA";
  const mismaQuePartido = localidad !== null && normalizarTexto(localidad) === normalizarTexto(partido);
  return [calle, localidad && !mismaQuePartido && !esCaba(localidad) ? localidad : null, partido, caba ? null : provincia]
    .filter((x): x is string => Boolean(x))
    .join(", ");
}

/** Un resultado de `/direcciones` de Georef (https://apis.datos.gob.ar/georef). */
export function desdeGeoref(d: Crudo): Ubicacion | null {
  const ubicacion = d?.ubicacion as { lat?: unknown; lon?: unknown } | undefined;
  const lat = ubicacion?.lat;
  const lng = ubicacion?.lon;
  if (typeof lat !== "number" || typeof lng !== "number" || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const provincia = nombreDe(d?.provincia);
  if (!provincia) return null;
  const partido = esCaba(provincia) ? "CABA" : (nombreDe(d?.departamento) ?? nombreDe(d?.localidad_censal));
  if (!partido) return null;

  const localidad = nombreDe(d?.localidad_censal);
  const nombreCalle = nombreDe(d?.calle);
  const altura = (d?.altura as { valor?: unknown } | undefined)?.valor;
  const numero = typeof altura === "number" && altura > 0 ? String(altura) : null;
  const calle = nombreCalle ? (numero ? `${titulo(nombreCalle)} ${numero}` : titulo(nombreCalle)) : null;
  return {
    etiqueta: armarEtiqueta(calle, localidad, partido, provincia),
    calle,
    partido,
    provincia,
    localidad,
    lat,
    lng,
    exacta: numero !== null,
    fuente: "georef",
    coincide: false,
  };
}

/** Un resultado de `/search?addressdetails=1` de Nominatim (OpenStreetMap). Solo sirven los que son una calle. */
export function desdeOsm(x: Crudo): Ubicacion | null {
  const lat = Number(x?.lat);
  const lng = Number(x?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const a = (x?.address ?? {}) as Record<string, unknown>;
  if (a.country_code && a.country_code !== "ar") return null;
  const calleBase = texto(a.road) ?? texto(a.pedestrian) ?? texto(a.footway);
  const provincia = texto(a.state);
  if (!calleBase || !provincia) return null;

  const caba = esCaba(provincia);
  const partido = caba
    ? "CABA"
    : (texto(a.county) ?? texto(a.state_district) ?? texto(a.city) ?? texto(a.town) ?? texto(a.village))?.replace(/^partido de\s+/i, "").trim();
  if (!partido) return null;
  const localidad = texto(a.suburb) ?? texto(a.neighbourhood) ?? texto(a.city_district) ?? texto(a.hamlet) ?? texto(a.village) ?? texto(a.town) ?? texto(a.city);
  const numero = texto(a.house_number);
  const calle = numero ? `${calleBase} ${numero}` : calleBase;
  return {
    etiqueta: armarEtiqueta(calle, localidad, partido, provincia),
    calle,
    partido,
    provincia,
    localidad,
    lat,
    lng,
    exacta: numero !== null,
    fuente: "osm",
    coincide: false,
  };
}

/* ───────────────────────────── Pistas de lugar ───────────────────────────── */

const camposDe = (u: Ubicacion) =>
  [u.partido, u.localidad, u.provincia, ...(u.partido === "CABA" ? ["capital federal", "ciudad de buenos aires", "buenos aires"] : [])]
    .filter((c): c is string => Boolean(c))
    .map(normalizarTexto);

/** Zona conocida (nombre normalizado) → partido al que pertenece: "olivos" → "Vicente López". Una pista que es una zona vale por su partido. */
export type AliasDeZonas = ReadonlyMap<string, string>;

export function aliasDeZonas(zonas: { nombre: string; partido: string | null }[] = []): AliasDeZonas {
  const alias = new Map<string, string>();
  for (const z of zonas) if (z.partido) alias.set(normalizarTexto(z.nombre), z.partido);
  return alias;
}

/**
 * Todas las pistas ("Villa Adelina", "Vicente López"…) aparecen en el partido, la localidad o la provincia del resultado
 * o, si la pista es una zona conocida ("Olivos"), el resultado es del partido de esa zona.
 */
export function coincidenPistas(u: Ubicacion, pistas: string[], alias?: AliasDeZonas): boolean {
  const buscadas = pistas.map(normalizarTexto).filter(Boolean);
  if (buscadas.length === 0) return false;
  const campos = camposDe(u);
  const partido = normalizarTexto(u.partido);
  return buscadas.every((p) => {
    if (campos.some((c) => c === p || c.includes(p) || p.includes(c))) return true;
    const delAlias = alias?.get(p);
    return delAlias !== undefined && normalizarTexto(delAlias) === partido;
  });
}

const TIPOS_DE_CALLE = new Set(["av", "avda", "avenida", "calle", "bv", "bvd", "boulevard", "bulevar", "pasaje", "pje", "diagonal", "diag"]);

/** "Av. Maipú 1234" → "maipu": el nombre de la calle sin el tipo ni la altura, para comparar lo escrito con lo encontrado. */
export function nombreDeCalle(texto: string): string {
  const palabras = normalizarTexto(texto).split(" ").filter(Boolean);
  while (palabras.length > 0 && /^\d+$/.test(palabras.at(-1)!)) palabras.pop();
  while (palabras.length > 1 && TIPOS_DE_CALLE.has(palabras[0]!)) palabras.shift();
  return palabras.join(" ");
}

/**
 * Marca cuáles coinciden con las pistas y los pone primero; después los que tienen la calle escrita (no una parecida,
 * como "Remedios Escalada de San Martín" para "San Martín") y los que resolvieron la altura. Es estable.
 */
export function ordenarPorPistas(lista: Ubicacion[], pistas: string[], opciones: { alias?: AliasDeZonas; calle?: string } = {}): Ubicacion[] {
  const escrita = opciones.calle ? nombreDeCalle(opciones.calle) : "";
  const mismaCalle = (u: Ubicacion) => escrita !== "" && nombreDeCalle(u.calle ?? "") === escrita;
  return lista
    .map((u, i) => ({ u: { ...u, coincide: coincidenPistas(u, pistas, opciones.alias) }, i }))
    .sort(
      (a, b) =>
        Number(b.u.coincide) - Number(a.u.coincide) ||
        Number(mismaCalle(b.u)) - Number(mismaCalle(a.u)) ||
        Number(b.u.exacta) - Number(a.u.exacta) ||
        a.i - b.i,
    )
    .map(({ u }) => u);
}

/* ───────────────────────────── Firma de la sugerencia elegida ───────────────────────────── */

const CONTEXTO = "unidoar:ubicacion:v1:";
/** Pasado este tiempo desde que se eligió, la sugerencia deja de valer y el servidor vuelve a ubicar la dirección. */
const VIGENCIA_MS = 6 * 3_600_000;

type Entorno = Record<string, string | undefined>;

function secreto(env: Entorno) {
  const s = env.CORREO_SECRETO?.trim() || env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  return s && s.length >= 16 ? s : null;
}

const firmar = (cuerpo: string, clave: string) => createHmac("sha256", clave).update(CONTEXTO + cuerpo).digest("base64url");

type Carga = { k: string; t: number; u: Ubicacion };

/**
 * Lleva la sugerencia que eligió la persona, atada al texto que tenía escrito. El formulario la manda junto con la
 * dirección y el servidor la acepta solo si la firma es suya, no venció y la dirección sigue siendo la misma.
 */
export function firmarUbicacion(u: Ubicacion, direccionEscrita: string, env: Entorno = process.env, ahora = Date.now()): string | null {
  const clave = secreto(env);
  if (!clave) return null;
  const carga: Carga = { k: claveDeDireccion(direccionEscrita), t: ahora, u };
  const cuerpo = Buffer.from(JSON.stringify(carga)).toString("base64url");
  return `${cuerpo}.${firmar(cuerpo, clave)}`;
}

export function verificarUbicacion(token: string | null | undefined, direccionEscrita: string, env: Entorno = process.env, ahora = Date.now()): Ubicacion | null {
  const clave = secreto(env);
  if (!clave || !token) return null;
  const [cuerpo, firma, resto] = token.split(".");
  if (!cuerpo || !firma || resto !== undefined) return null;
  const esperada = Buffer.from(firmar(cuerpo, clave));
  const recibida = Buffer.from(firma);
  if (recibida.length !== esperada.length || !timingSafeEqual(recibida, esperada)) return null;
  try {
    const carga = JSON.parse(Buffer.from(cuerpo, "base64url").toString("utf8")) as Partial<Carga>;
    const u = carga.u;
    if (typeof carga.t !== "number" || ahora - carga.t > VIGENCIA_MS || ahora < carga.t - 60_000) return null;
    if (carga.k !== claveDeDireccion(direccionEscrita)) return null;
    if (!u || typeof u.lat !== "number" || typeof u.lng !== "number" || !Number.isFinite(u.lat) || !Number.isFinite(u.lng)) return null;
    if (typeof u.partido !== "string" || typeof u.provincia !== "string" || typeof u.etiqueta !== "string") return null;
    return u;
  } catch {
    return null;
  }
}

/* ───────────────────────────── Zona de una institución ───────────────────────────── */

/** "Villa Adelina, Vicente López"; si la localidad es la misma que el partido (o la Ciudad), solo el partido. */
export function zonaDeUbicacion(u: Pick<Ubicacion, "localidad" | "partido">): string {
  const { localidad, partido } = u;
  if (localidad && normalizarTexto(localidad) !== normalizarTexto(partido) && !esCaba(localidad)) return `${localidad}, ${partido}`;
  return partido;
}

export type UbicacionDelCatalogo = { zona: string; lat: number | null; lng: number | null; enCatalogo: boolean };

/**
 * Une lo que dice el catálogo de zonas con lo que se encontró para la dirección. Las coordenadas son las de la dirección
 * si se la pudo ubicar. El texto de zona es el del catálogo cuando salió de una zona conocida ("Villa Adelina, Vicente López");
 * si no, el que arma la dirección encontrada.
 */
export function ubicacionDeInstitucion(catalogo: UbicacionDelCatalogo, direccion: Ubicacion | null) {
  if (!direccion) return { zona: catalogo.zona, lat: catalogo.lat, lng: catalogo.lng };
  return { zona: catalogo.enCatalogo ? catalogo.zona : zonaDeUbicacion(direccion), lat: direccion.lat, lng: direccion.lng };
}
