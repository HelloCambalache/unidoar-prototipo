import "server-only";
import { zonasConocidas } from "@/lib/queries/onboarding";
import { provinciasDeZonas } from "@/lib/ubicacion";
import { consultaDeZona, desdeGeorefLocalidad, elegirZona, primeraZonaUbicada, type Punto, type ZonaUbicada } from "@/lib/ubicacion-zona";
import { normalizarTexto } from "@/lib/onboarding";

/*
 * Ubicar una zona escrita a mano con Georef (`/localidades`). Es una ayuda para calcular distancias: nunca frena un guardado.
 * Georef es una API pública y sin clave; la zona que se consulta es un nombre de lugar (no un dato personal). Las reglas de qué
 * resultado sirve están en src/lib/ubicacion-zona.ts, que es puro y tiene pruebas.
 */

const GEOREF_LOCALIDADES = "https://apis.datos.gob.ar/georef/api/localidades";
const MAXIMO_DE_ZONAS_A_CONSULTAR = 3;

// Las mismas zonas se repiten entre profesionales ("La Plata"): se recuerda lo ya resuelto (solo los aciertos) por un rato.
const CACHE_MS = 6 * 3_600_000;
const CACHE_MAXIMO = 200;
const cache = new Map<string, { vence: number; zona: ZonaUbicada }>();

async function consultarLocalidades(nombre: string): Promise<ZonaUbicada[]> {
  const url = new URL(GEOREF_LOCALIDADES);
  url.searchParams.set("nombre", nombre);
  url.searchParams.set("campos", "nombre,centroide,departamento,provincia,municipio");
  url.searchParams.set("max", "20");
  try {
    const respuesta = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!respuesta.ok) return [];
    const cuerpo = (await respuesta.json()) as { localidades?: unknown[] };
    return (cuerpo.localidades ?? []).flatMap((l) => {
      const z = desdeGeorefLocalidad(l as Record<string, unknown>);
      return z ? [z] : [];
    });
  } catch {
    return [];
  }
}

/** La localidad que escribió la persona, o null si Georef no responde, no la conoce o hay varias iguales sin forma de elegir. */
export async function ubicarZonaPorGeoref(escrita: string): Promise<ZonaUbicada | null> {
  const consulta = consultaDeZona(escrita);
  if (!consulta) return null;
  const clave = normalizarTexto(consulta);
  const ahora = Date.now();
  const guardada = cache.get(clave);
  if (guardada && guardada.vence > ahora) return guardada.zona;

  const candidatas = await consultarLocalidades(consulta);
  const preferidas = provinciasDeZonas(await zonasConocidas());
  const zona = elegirZona(consulta, candidatas, preferidas);
  if (zona) {
    if (cache.size >= CACHE_MAXIMO) {
      for (const [k, v] of cache) if (v.vence <= ahora) cache.delete(k);
      if (cache.size >= CACHE_MAXIMO) cache.delete(cache.keys().next().value as string);
    }
    cache.set(clave, { vence: ahora + CACHE_MS, zona });
  }
  return zona;
}

/**
 * Las coordenadas del profesional a partir de las zonas que escribió: la primera (en el orden que las puso) que el catálogo de
 * zonas conozca o que Georef pueda ubicar. Nunca lanza: sin coordenadas la zona se guarda igual.
 */
export async function ubicarPrimeraZona(
  escritas: readonly string[],
  catalogo: readonly { nombre: string; lat: number | null; lng: number | null }[],
): Promise<Punto | null> {
  const delCatalogo = new Map<string, Punto>();
  for (const z of catalogo) if (z.lat != null && z.lng != null) delCatalogo.set(normalizarTexto(z.nombre), { lat: z.lat, lng: z.lng });
  try {
    return await primeraZonaUbicada(
      escritas,
      (z) => delCatalogo.get(normalizarTexto(z)) ?? null,
      async (z) => {
        const ubicada = await ubicarZonaPorGeoref(z);
        return ubicada ? { lat: ubicada.lat, lng: ubicada.lng } : null;
      },
      MAXIMO_DE_ZONAS_A_CONSULTAR,
    );
  } catch {
    return null;
  }
}
