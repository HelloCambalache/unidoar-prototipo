import "server-only";
import { and, count, eq, inArray, isNotNull } from "drizzle-orm";
import { getDb, transaccion } from "@/db";
import { busquedas, institucionSedes, instituciones } from "@/db/schema";
import type { Ejecutor } from "@/lib/queries/pipeline";
import { espejoDePrincipal, NOMBRE_SEDE_PRINCIPAL, ordenarSedes, sedePrincipal, type SedeVista } from "@/lib/sedes";

/*
 * Sedes de las instituciones (ver src/lib/sedes.ts). La sede PRINCIPAL es la fuente de verdad de la ubicación de la
 * institución; las columnas de `instituciones` (dirección, partido, provincia, zona, lat, lng y CUE) son una copia que se
 * actualiza en el mismo paso, siempre con `guardarSedePrincipal`: nada más escribe esas columnas.
 */

const columnas = {
  id: institucionSedes.id,
  nombre: institucionSedes.nombre,
  direccion: institucionSedes.direccion,
  partido: institucionSedes.partido,
  provincia: institucionSedes.provincia,
  zona: institucionSedes.zona,
  lat: institucionSedes.lat,
  lng: institucionSedes.lng,
  cue: institucionSedes.cue,
  esPrincipal: institucionSedes.esPrincipal,
};

/** Las sedes de una institución, la principal primero. Vacío solo si todavía no se le creó ninguna (`db:sedes`). */
export async function sedesDeInstitucion(institucionId: string, ejecutor: Ejecutor = getDb()): Promise<SedeVista[]> {
  const filas = await ejecutor.select(columnas).from(institucionSedes).where(eq(institucionSedes.institucionId, institucionId));
  return ordenarSedes(filas);
}

/**
 * Las sedes para mostrar en el editor. Una institución sin ninguna (creada antes de que existieran, sin haber corrido `db:sedes`)
 * ofrece como única sede la ubicación que tiene en su ficha, sin id: al guardar se crea como principal.
 */
export async function sedesParaEditar(
  institucion: { id: string; direccion: string | null; zona: string | null; cue: string | null },
): Promise<(Omit<SedeVista, "id"> & { id?: string })[]> {
  const sedes = await sedesDeInstitucion(institucion.id);
  if (sedes.length > 0) return sedes;
  return [{ nombre: NOMBRE_SEDE_PRINCIPAL, direccion: institucion.direccion, partido: null, provincia: null, zona: institucion.zona, lat: null, lng: null, cue: institucion.cue, esPrincipal: true }];
}

/** Las sedes de varias instituciones de una sola consulta (para listados): id de la institución → sus sedes, principal primero. */
export async function sedesDeInstituciones(institucionIds: string[]): Promise<Map<string, SedeVista[]>> {
  const mapa = new Map<string, SedeVista[]>();
  if (institucionIds.length === 0) return mapa;
  const filas = await getDb()
    .select({ ...columnas, institucionId: institucionSedes.institucionId })
    .from(institucionSedes)
    .where(inArray(institucionSedes.institucionId, institucionIds));
  for (const { institucionId, ...sede } of filas) mapa.set(institucionId, [...(mapa.get(institucionId) ?? []), sede]);
  for (const [id, lista] of mapa) mapa.set(id, ordenarSedes(lista));
  return mapa;
}

/** Lo que se puede cambiar de la ubicación de una sede. Lo que no viene no se toca. */
export type UbicacionDeSede = {
  direccion: string | null;
  partido: string | null;
  provincia: string | null;
  zona: string | null;
  lat: number | null;
  lng: number | null;
  cue: string | null;
};

/**
 * Guarda cambios en la sede principal de la institución y deja la copia de `instituciones` igual. Si todavía no tenía sede
 * principal la crea PARTIENDO de lo que ya figura en la institución (así un cambio parcial, como solo el CUE, no la pisa con
 * vacíos). Va dentro de la transacción de quien escribe. Devuelve la sede como quedó.
 */
export async function guardarSedePrincipal(tx: Ejecutor, institucionId: string, cambios: Partial<UbicacionDeSede>): Promise<SedeVista> {
  const [actual] = await tx
    .select(columnas)
    .from(institucionSedes)
    .where(and(eq(institucionSedes.institucionId, institucionId), eq(institucionSedes.esPrincipal, true)))
    .limit(1)
    .for("update");

  let sede: SedeVista;
  if (actual) {
    if (Object.keys(cambios).length === 0) {
      sede = actual;
    } else {
      [sede] = await tx.update(institucionSedes).set(cambios).where(eq(institucionSedes.id, actual.id)).returning(columnas);
    }
  } else {
    const [inst] = await tx
      .select({
        direccion: instituciones.direccion,
        partido: instituciones.partido,
        provincia: instituciones.provincia,
        zona: instituciones.zona,
        lat: instituciones.lat,
        lng: instituciones.lng,
        cue: instituciones.cue,
      })
      .from(instituciones)
      .where(eq(instituciones.id, institucionId))
      .limit(1);
    [sede] = await tx
      .insert(institucionSedes)
      .values({ institucionId, nombre: NOMBRE_SEDE_PRINCIPAL, esPrincipal: true, ...inst, ...cambios })
      .returning(columnas);
  }

  await tx.update(instituciones).set(espejoDePrincipal(sede)).where(eq(instituciones.id, institucionId));
  return sede;
}

/** Vuelve a copiar la sede principal en la ficha de la institución (después de cambiar cuál es la principal, por ejemplo). */
export async function sincronizarEspejo(tx: Ejecutor, institucionId: string): Promise<void> {
  const [principal] = await tx
    .select(columnas)
    .from(institucionSedes)
    .where(and(eq(institucionSedes.institucionId, institucionId), eq(institucionSedes.esPrincipal, true)))
    .limit(1);
  if (principal) await tx.update(instituciones).set(espejoDePrincipal(principal)).where(eq(instituciones.id, institucionId));
}

/**
 * La sede de una búsqueda que se publica o se edita: la que se pidió (tiene que ser de esta institución), si no la que ya tenía y, si
 * no, la principal. Devuelve null si pidieron una que no es de la institución. Una institución sin ninguna sede (creada antes de que
 * existieran) recibe su principal acá, a partir de lo que tiene en su ficha.
 */
export async function sedeParaBusqueda(institucionId: string, pedida?: string | null, actualId?: string | null): Promise<SedeVista | null> {
  let sedes = await sedesDeInstitucion(institucionId);
  if (sedes.length === 0) {
    await transaccion(async (tx) => {
      await guardarSedePrincipal(tx, institucionId, {});
    });
    sedes = await sedesDeInstitucion(institucionId);
  }
  const id = pedida || actualId || null;
  if (pedida) return sedes.find((s) => s.id === pedida) ?? null;
  return (id ? sedes.find((s) => s.id === id) : null) ?? sedePrincipal(sedes);
}

/** Cuántas sedes tiene cada institución (las que no figuran, ninguna): para decir en qué sede es una búsqueda solo cuando hay más de una. */
export async function contarSedes(institucionIds: string[]): Promise<Map<string, number>> {
  if (institucionIds.length === 0) return new Map();
  const filas = await getDb()
    .select({ institucionId: institucionSedes.institucionId, n: count() })
    .from(institucionSedes)
    .where(inArray(institucionSedes.institucionId, institucionIds))
    .groupBy(institucionSedes.institucionId);
  return new Map(filas.map((f) => [f.institucionId, f.n] as const));
}

/** Cuántas búsquedas abiertas o pausadas tiene cada sede (para saber cuáles se pueden quitar). */
export async function busquedasAbiertasPorSede(institucionId: string, ejecutor: Ejecutor = getDb()): Promise<Map<string, number>> {
  const filas = await ejecutor
    .select({ sedeId: busquedas.sedeId, n: count() })
    .from(busquedas)
    .where(and(eq(busquedas.institucionId, institucionId), inArray(busquedas.estado, ["activa", "pausada"]), isNotNull(busquedas.sedeId)))
    .groupBy(busquedas.sedeId);
  return new Map(filas.flatMap((f) => (f.sedeId ? [[f.sedeId, f.n] as const] : [])));
}

/** Cuántas sedes tiene cada institución (las que no tienen ninguna cuentan como una: su ubicación de la ficha). Para los planes por sede. */
export async function cantidadDeSedes(ejecutor: Ejecutor, institucionIds: string[]): Promise<Map<string, number>> {
  const cantidades = new Map<string, number>(institucionIds.map((id) => [id, 1]));
  if (institucionIds.length === 0) return cantidades;
  const filas = await ejecutor
    .select({ institucionId: institucionSedes.institucionId, n: count() })
    .from(institucionSedes)
    .where(inArray(institucionSedes.institucionId, institucionIds))
    .groupBy(institucionSedes.institucionId);
  for (const f of filas) cantidades.set(f.institucionId, Math.max(1, f.n));
  return cantidades;
}
