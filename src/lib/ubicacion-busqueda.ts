import {
  aliasDeZonas,
  claveDeDireccion,
  coincidenPistas,
  desdeGeoref,
  desdeOsm,
  esCaba,
  ordenarPorPistas,
  provinciasDeZonas,
  separarDireccion,
  verificarUbicacion,
  type Ubicacion,
} from "@/lib/ubicacion";
import { normalizarTexto } from "@/lib/onboarding";

/*
 * Busca una dirección escrita a mano: primero en Georef (API oficial del Estado argentino, sin clave) y, solo si no
 * encuentra nada que coincida con lo escrito y el pedido lo permite, en OpenStreetMap (Nominatim). Con `osm: false`
 * la dirección nunca sale hacia OpenStreetMap: se usa para el domicilio de las personas.
 * `fetchImpl` y `esperarOsm` se inyectan para poder probarlo sin red; el caché y los límites de uso están en
 * src/lib/queries/ubicacion.ts.
 */

const GEOREF = "https://apis.datos.gob.ar/georef/api/direcciones";
const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "UNIDOAR/1.0 (https://www.unidoar.com.ar; hola@unidoar.com.ar)";
const MAXIMO_DE_SUGERENCIAS = 5;
const NOMBRE_OFICIAL_CABA = "Ciudad Autónoma de Buenos Aires";

export type PedidoDeUbicacion = {
  /** Lo que escribió la persona, tal cual ("Av. Maipú 1234, Vicente López"). */
  texto: string;
  /** El partido y la provincia que ya cargó en el mismo formulario, si los hay: acotan la búsqueda. */
  partido?: string | null;
  provincia?: string | null;
  /** Permite consultar OpenStreetMap si Georef no encuentra nada. */
  osm: boolean;
  /** Las zonas que conoce la app: una pista como "Olivos" vale por el partido al que pertenece (Georef no ubica barrios). */
  zonas?: { nombre: string; partido: string | null; provincia?: string | null }[];
};

export type DependenciasDeBusqueda = {
  fetchImpl?: typeof fetch;
  /** Espera el turno para consultar OpenStreetMap (permite 1 pedido por segundo). */
  esperarOsm?: () => Promise<void>;
};

type FiltrosGeoref = { provincia?: string; departamento?: string };

async function consultarGeoref(calle: string, filtros: FiltrosGeoref, fetchImpl: typeof fetch): Promise<Ubicacion[]> {
  const url = new URL(GEOREF);
  url.searchParams.set("direccion", calle);
  url.searchParams.set("max", "10");
  if (filtros.provincia) url.searchParams.set("provincia", filtros.provincia);
  if (filtros.departamento) url.searchParams.set("departamento", filtros.departamento);
  try {
    const respuesta = await fetchImpl(url, { signal: AbortSignal.timeout(5000) });
    // Un nombre de provincia o partido que Georef no conoce devuelve 400: se reintenta con menos filtros.
    if (!respuesta.ok) return [];
    const cuerpo = (await respuesta.json()) as { direcciones?: unknown[] };
    return (cuerpo.direcciones ?? []).flatMap((d) => {
      const u = desdeGeoref(d as Record<string, unknown>);
      return u ? [u] : [];
    });
  } catch {
    return [];
  }
}

async function consultarOsm(consulta: string, fetchImpl: typeof fetch, esperar?: () => Promise<void>): Promise<Ubicacion[]> {
  const url = new URL(NOMINATIM);
  url.searchParams.set("q", consulta);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("countrycodes", "ar");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "5");
  url.searchParams.set("accept-language", "es");
  try {
    await esperar?.();
    const respuesta = await fetchImpl(url, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(6000) });
    if (!respuesta.ok) return [];
    const cuerpo = (await respuesta.json()) as unknown[];
    return (Array.isArray(cuerpo) ? cuerpo : []).flatMap((x) => {
      const u = desdeOsm(x as Record<string, unknown>);
      return u ? [u] : [];
    });
  } catch {
    return [];
  }
}

/** A menos de ~150 m es el mismo lugar. */
const mismoLugar = (a: Ubicacion, b: Ubicacion) => Math.abs(a.lat - b.lat) < 0.0014 && Math.abs(a.lng - b.lng) < 0.0014;

export async function buscarUbicacionesEn(pedido: PedidoDeUbicacion, deps: DependenciasDeBusqueda = {}): Promise<Ubicacion[]> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const texto = pedido.texto.trim();
  if (texto.length < 5) return [];
  const partido = pedido.partido?.trim() || null;
  const provincia = pedido.provincia?.trim() || null;
  const alias = aliasDeZonas(pedido.zonas);

  const { calle, pistas } = separarDireccion(texto);
  const pistasExigidas = [...pistas, ...(partido ? [partido] : [])];
  const opciones = { alias, calle, provincias: provinciasDeZonas(pedido.zonas) };

  // 1) Georef. Cada pista de lugar se prueba como partido (o como el partido de una zona conocida: "Olivos" → Vicente López)
  //    y se corta en cuanto algún resultado coincide con lo escrito. Si Georef no conoce un nombre devuelve 400: se sigue
  //    con el siguiente. El último intento es sin filtros.
  const intentos: FiltrosGeoref[] = [];
  const agregar = (f: FiltrosGeoref) => {
    if (!intentos.some((x) => x.provincia === f.provincia && x.departamento === f.departamento)) intentos.push(f);
  };
  if (partido && esCaba(partido)) agregar({ provincia: NOMBRE_OFICIAL_CABA });
  else if (partido) {
    if (provincia) agregar({ provincia, departamento: partido });
    agregar({ departamento: partido });
  }
  for (const pista of pistas) {
    if (esCaba(pista)) agregar({ provincia: NOMBRE_OFICIAL_CABA });
    else agregar({ departamento: alias.get(normalizarTexto(pista)) ?? pista });
  }
  agregar({});

  let lista: Ubicacion[] = [];
  for (const filtros of intentos) {
    const encontrados = ordenarPorPistas(await consultarGeoref(calle, filtros, fetchImpl), pistasExigidas, opciones);
    // Con pistas de lugar, solo sirve lo que coincide: ofrecer otra provincia sería ofrecer un lugar equivocado.
    const sirven = pistasExigidas.length > 0 ? encontrados.filter((u) => u.coincide) : encontrados;
    if (sirven.length > 0) {
      lista = sirven;
      break;
    }
  }

  // 2) OpenStreetMap, solo de respaldo y solo si el pedido lo permite.
  if (lista.length === 0 && pedido.osm) {
    const consulta = pistas.length > 0 || !partido ? texto : [texto, partido, provincia].filter(Boolean).join(", ");
    const deOsm = ordenarPorPistas(await consultarOsm(consulta, fetchImpl, deps.esperarOsm), pistasExigidas, opciones);
    lista = pistasExigidas.length > 0 ? deOsm.filter((u) => u.coincide) : deOsm;
  }

  // Dos resultados que se ven igual (misma etiqueta) o que quedan a menos de ~150 m no son opciones distintas para quien elige.
  const sinRepetidos: Ubicacion[] = [];
  for (const u of lista) {
    if (!sinRepetidos.some((x) => mismoLugar(x, u) || claveDeDireccion(x.etiqueta) === claveDeDireccion(u.etiqueta))) sinRepetidos.push(u);
  }
  return sinRepetidos.slice(0, MAXIMO_DE_SUGERENCIAS).map((u) => ({ ...u, coincide: coincidenPistas(u, pistasExigidas, alias) }));
}

export type EntradaDeUbicacion = {
  direccion: string;
  partido?: string | null;
  provincia?: string | null;
  /** La firma de la sugerencia que eligió la persona (campo oculto `ubicacion`). */
  token?: string | null;
  osm: boolean;
};

/**
 * La ubicación de una dirección al guardar un formulario. El servidor no confía en coordenadas que vengan del navegador:
 * acepta la sugerencia elegida solo si trae la firma de este servidor, para esa misma dirección, reciente y sin
 * contradecir el partido que la persona dejó escrito. Sin eso busca él mismo y se queda con el primer resultado que
 * coincide con lo escrito (calle, número y lugar). Si nada coincide devuelve null y quien llama usa el catálogo de zonas.
 */
export async function ubicarEntrada(
  entrada: EntradaDeUbicacion,
  buscar: (pedido: PedidoDeUbicacion) => Promise<Ubicacion[]>,
  env: Record<string, string | undefined> = process.env,
  ahora = Date.now(),
): Promise<Ubicacion | null> {
  const texto = entrada.direccion.trim();
  if (texto.length < 5) return null;
  const partido = entrada.partido?.trim() || null;
  const elegida = verificarUbicacion(entrada.token, texto, env, ahora);
  if (elegida && (!partido || coincidenPistas(elegida, [partido]))) return elegida;
  const lista = await buscar({ texto, partido, provincia: entrada.provincia, osm: entrada.osm });
  return lista.find((u) => u.coincide) ?? null;
}
