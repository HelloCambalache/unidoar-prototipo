import "server-only";
import { zonasConocidas } from "@/lib/queries/onboarding";
import { claveDeDireccion, type Ubicacion } from "@/lib/ubicacion";
import { buscarUbicacionesEn, ubicarEntrada, type EntradaDeUbicacion, type PedidoDeUbicacion } from "@/lib/ubicacion-busqueda";

/*
 * Ubicar una dirección escrita a mano, con los límites de uso de los servicios que consulta:
 * caché en memoria (las mismas direcciones se repiten mientras la gente tipea), un pedido por segundo hacia
 * OpenStreetMap (su política de uso) y un tope de consultas por cuenta. La lógica de la búsqueda está en
 * src/lib/ubicacion-busqueda.ts, que es pura y tiene pruebas.
 */

const CACHE_MS = 3_600_000;
const CACHE_MAXIMO = 300;
const cache = new Map<string, { vence: number; lista: Ubicacion[] }>();

const SEPARACION_OSM_MS = 1100;
const MAXIMO_EN_ESPERA_OSM = 3;
let turnoOsm: Promise<unknown> = Promise.resolve();
let ultimoOsm = 0;
let enEsperaOsm = 0;

/** Se pide el turno antes de cada consulta a OpenStreetMap: sale como mucho una por segundo desde este servidor. */
function esperarOsm(): Promise<void> {
  if (enEsperaOsm >= MAXIMO_EN_ESPERA_OSM) return Promise.reject(new Error("OpenStreetMap: demasiadas consultas en espera"));
  enEsperaOsm += 1;
  const mio = turnoOsm.then(async () => {
    const espera = ultimoOsm + SEPARACION_OSM_MS - Date.now();
    if (espera > 0) await new Promise((r) => setTimeout(r, espera));
    ultimoOsm = Date.now();
  });
  turnoOsm = mio.finally(() => {
    enEsperaOsm -= 1;
  });
  return mio;
}

const claveDeCache = (p: PedidoDeUbicacion) =>
  [p.osm ? "osm" : "georef", claveDeDireccion(p.texto), claveDeDireccion(p.partido ?? ""), claveDeDireccion(p.provincia ?? "")].join("|");

/**
 * Sugerencias para una dirección. Con `osm: false` (el domicilio de una persona) solo se consulta Georef y nada
 * queda en el caché: la dirección no se retiene.
 */
export async function buscarUbicaciones(pedido: PedidoDeUbicacion): Promise<Ubicacion[]> {
  const clave = claveDeCache(pedido);
  const ahora = Date.now();
  if (pedido.osm) {
    const guardada = cache.get(clave);
    if (guardada && guardada.vence > ahora) return guardada.lista;
  }
  const lista = await buscarUbicacionesEn({ ...pedido, zonas: await zonasConocidas() }, { esperarOsm });
  // Un resultado vacío por una caída momentánea no se guarda: se vuelve a intentar en la próxima consulta.
  if (pedido.osm && lista.length > 0) {
    if (cache.size >= CACHE_MAXIMO) {
      for (const [k, v] of cache) if (v.vence <= ahora) cache.delete(k);
      if (cache.size >= CACHE_MAXIMO) cache.delete(cache.keys().next().value as string);
    }
    cache.set(clave, { vence: ahora + CACHE_MS, lista });
  }
  return lista;
}

/** La ubicación de una dirección al guardar un formulario (las reglas están en `ubicarEntrada`). Null: se usa el catálogo de zonas, como antes. */
export const ubicarPorDireccion = (entrada: EntradaDeUbicacion) => ubicarEntrada(entrada, buscarUbicaciones);

/* ───────────────────────────── Tope de consultas por cuenta ───────────────────────────── */

const VENTANA_MS = 60_000;
const CONSULTAS_POR_VENTANA = 40;
const consultasPorCuenta = new Map<string, number[]>();

/** Deja hacer hasta 40 consultas por minuto por cuenta (mientras alguien tipea salen una cada ~0,5 s). */
export function permitirConsulta(cuentaId: string, ahora = Date.now()): boolean {
  const recientes = (consultasPorCuenta.get(cuentaId) ?? []).filter((t) => ahora - t < VENTANA_MS);
  if (recientes.length >= CONSULTAS_POR_VENTANA) {
    consultasPorCuenta.set(cuentaId, recientes);
    return false;
  }
  recientes.push(ahora);
  consultasPorCuenta.set(cuentaId, recientes);
  if (consultasPorCuenta.size > 2000) {
    for (const [k, v] of consultasPorCuenta) if (v.every((t) => ahora - t >= VENTANA_MS)) consultasPorCuenta.delete(k);
  }
  return true;
}
