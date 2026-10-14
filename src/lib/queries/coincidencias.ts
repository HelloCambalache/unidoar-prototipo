import "server-only";
import { and, arrayOverlaps, count, desc, eq, inArray, isNotNull, ne, sql, type SQL } from "drizzle-orm";
import { getDb } from "@/db";
import { docentes, zonas, type CategoriaDocente, type Institucion } from "@/db/schema";
import { distanciaKm, kmLegible } from "@/lib/geo";
import {
  TOPE_AVISOS,
  TURNO_A_DISPONIBILIDAD,
  TURNO_COMPLEMENTARIO,
  type FiltrosCoincidencia,
  type ResumenCoincidencias,
} from "@/lib/busquedas";
import { ordenarPorPuntaje, puntuarCandidato, type BusquedaAbierta } from "@/lib/recomendaciones";
import { sedesDeInstitucion } from "@/lib/queries/sedes";
import { sedeMasCercana } from "@/lib/sedes";
import { iniciales } from "@/lib/utils";
import { docenteVisible } from "@/lib/visibilidad";

/*
 * Cruce entre una búsqueda (o sus criterios a medio completar) y la base de docentes.
 * Lo usan el panel "Se actualiza mientras completás", el aviso al publicar y los
 * "docentes recomendados" del dashboard, así los tres hablan del mismo universo.
 */

/** Hasta dónde llega "partidos linderos": zonas del catálogo a esta distancia de las propias. */
const RADIO_LINDEROS_KM = 8;

const normalizar = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();

export type ZonasDeBusqueda = {
  /** Las zonas del catálogo que corresponden al texto, más el resto de su partido. */
  base: string[];
  /** `base` más las zonas cercanas de partidos linderos. */
  ampliada: string[];
};

/**
 * "Villa Adelina, Vicente López" → zonas del catálogo (`zonas`). Null si el texto no se puede
 * ubicar: en ese caso no se filtra por zona en vez de devolver cero coincidencias.
 */
export async function resolverZonas(texto?: string | null): Promise<ZonasDeBusqueda | null> {
  if (!texto?.trim()) return null;
  const catalogo = await getDb().select().from(zonas);
  const t = normalizar(texto);
  let coinciden = catalogo.filter((z) => t.includes(normalizar(z.nombre)));
  if (coinciden.length === 0) coinciden = catalogo.filter((z) => z.partido && t.includes(normalizar(z.partido)));
  if (coinciden.length === 0) return null;

  const partidos = new Set(coinciden.map((z) => z.partido).filter(Boolean));
  const base = catalogo.filter((z) => coinciden.includes(z) || (z.partido && partidos.has(z.partido)));
  const conCoords = (z: (typeof catalogo)[number]) => z.lat != null && z.lng != null;
  const puntosBase = base.filter(conCoords);
  const cercanas = catalogo.filter(
    (z) =>
      !base.includes(z) &&
      conCoords(z) &&
      puntosBase.some((b) => distanciaKm({ lat: b.lat!, lng: b.lng! }, { lat: z.lat!, lng: z.lng! }) <= RADIO_LINDEROS_KM),
  );
  return { base: base.map((z) => z.nombre), ampliada: [...base, ...cercanas].map((z) => z.nombre) };
}

function condiciones(f: FiltrosCoincidencia, z: ZonasDeBusqueda | null): SQL[] {
  const c: SQL[] = [
    eq(docentes.categoria, f.categoria),
    eq(docentes.onboardingCompleto, true),
    docenteVisible,
    f.incluirSinVerificar ? ne(docentes.verificacion, "rechazado") : eq(docentes.verificacion, "verificado"),
  ];
  if (f.disciplina) {
    c.push(
      sql`exists (select 1 from unnest(${docentes.asignaturas}) as a(nombre) where lower(a.nombre) = lower(${f.disciplina}))`,
    );
  }
  // Quien no declaró niveles no queda afuera: el nivel solo descarta a quien declaró otros.
  if (f.nivel) c.push(sql`(cardinality(${docentes.niveles}) = 0 or ${f.nivel} = any(${docentes.niveles}))`);
  if (z) c.push(arrayOverlaps(docentes.zonas, f.ampliarZona ? z.ampliada : z.base));
  if (f.turno && f.turnoExtra) {
    const otro = TURNO_COMPLEMENTARIO[f.turno];
    if (otro) c.push(arrayOverlaps(docentes.disponibilidad, TURNO_A_DISPONIBILIDAD[otro]));
  }
  return c;
}

const verificadosPrimero = desc(sql`(${docentes.verificacion} = 'verificado')`);

/** Todo lo que muestra el panel lateral del formulario de publicar, en una pasada. */
export async function resumenCoincidencias(f: FiltrosCoincidencia): Promise<ResumenCoincidencias> {
  const db = getDb();
  const z = await resolverZonas(f.zona);
  const turnoDisponible = f.turno ? TURNO_A_DISPONIBILIDAD[f.turno] : null;
  const otroTurno = f.turno ? TURNO_COMPLEMENTARIO[f.turno] : undefined;
  const hayLinderos = !!z && z.ampliada.length > z.base.length;

  const contar = async (cambios: Partial<FiltrosCoincidencia>) => {
    const [fila] = await db
      .select({ n: count() })
      .from(docentes)
      .where(and(...condiciones({ ...f, ...cambios }, z)));
    return fila?.n ?? 0;
  };

  const [[resumen], muestra, zonaOpuesta, verificacionOpuesta, turnoOpuesto] = await Promise.all([
    db
      .select({
        total: count(),
        verificados: sql<number>`count(*) filter (where ${docentes.verificacion} = 'verificado')`.mapWith(Number),
        conTitulo: sql<number>`count(*) filter (where ${docentes.tituloVerificado})`.mapWith(Number),
        conCuenta: sql<number>`count(*) filter (where ${isNotNull(docentes.usuarioId)})`.mapWith(Number),
        disponibles: turnoDisponible
          ? sql<number>`count(*) filter (where ${arrayOverlaps(docentes.disponibilidad, turnoDisponible)})`.mapWith(Number)
          : sql<number>`0`.mapWith(Number),
      })
      .from(docentes)
      .where(and(...condiciones(f, z))),
    db
      .select({ nombre: docentes.nombre, apellido: docentes.apellido })
      .from(docentes)
      .where(and(...condiciones(f, z)))
      .orderBy(verificadosPrimero, desc(docentes.creadoEn))
      .limit(4),
    hayLinderos ? contar({ ampliarZona: !f.ampliarZona }) : Promise.resolve(null),
    contar({ incluirSinVerificar: !f.incluirSinVerificar }),
    otroTurno ? contar({ turnoExtra: !f.turnoExtra }) : Promise.resolve(null),
  ]);

  const total = resumen?.total ?? 0;
  // Cada escenario es "con el interruptor prendido − con el interruptor apagado", sea cual sea el estado actual.
  const efecto = (opuesta: number, prendidoAhora: boolean) => (prendidoAhora ? total - opuesta : opuesta - total);

  return {
    total,
    verificados: resumen?.verificados ?? 0,
    conTitulo: resumen?.conTitulo ?? 0,
    conCuenta: resumen?.conCuenta ?? 0,
    disponiblesTurno: turnoDisponible ? (resumen?.disponibles ?? 0) : null,
    iniciales: muestra.map((d) => iniciales(`${d.nombre} ${d.apellido}`.trim())),
    escenarios: {
      zona: zonaOpuesta === null ? null : efecto(zonaOpuesta, f.ampliarZona),
      sinVerificar: efecto(verificacionOpuesta, f.incluirSinVerificar),
      turnoExtra:
        turnoOpuesto === null || !otroTurno
          ? null
          : { delta: efecto(turnoOpuesto, f.turnoExtra), turno: otroTurno.toLowerCase() },
    },
    zonaResuelta: z !== null || !f.zona,
  };
}

/** A quiénes avisar al publicar: los que coinciden y tienen cuenta (verificados primero), hasta el tope. */
export async function docentesAvisables(f: FiltrosCoincidencia, limite = TOPE_AVISOS) {
  const z = await resolverZonas(f.zona);
  const filas = await getDb()
    .select({ docenteId: docentes.id, usuarioId: docentes.usuarioId })
    .from(docentes)
    .where(and(...condiciones(f, z), isNotNull(docentes.usuarioId)))
    .orderBy(verificadosPrimero, desc(docentes.creadoEn))
    .limit(limite);
  return filas.flatMap((d) => (d.usuarioId ? [{ docenteId: d.docenteId, usuarioId: d.usuarioId }] : []));
}

export type DocenteRecomendado = {
  id: string;
  nombre: string;
  iniciales: string;
  fotoUrl: string | null;
  categoria: CategoriaDocente;
  /** "Ed. Física · Vicente López" / "Natación · a 2 km" */
  detalle: string;
  etiquetas: string[];
  /** Por qué se lo recomendamos ("Da Inglés, como tu búsqueda abierta", "A 3 km de tu sede"…), del más importante al menos. */
  motivos: string[];
  /** La búsqueda abierta de la institución con la que más coincide: a esa se lo invita. Null si no coincide con ninguna. */
  busquedaId: string | null;
};

/**
 * Docentes verificados de la zona de la institución (y partidos linderos), de las categorías
 * de sus búsquedas abiertas, que todavía no se postularon a ninguna de ellas. Con varias sedes cuentan las zonas de todas
 * y la distancia es a la sede más cercana.
 */
export async function docentesRecomendados(
  institucion: Institucion,
  { categorias = [], busquedas: abiertas = [], limite }: { categorias?: CategoriaDocente[]; busquedas?: BusquedaAbierta[]; limite: number },
): Promise<DocenteRecomendado[]> {
  const sedes = await sedesDeInstitucion(institucion.id);
  // El texto de zona junta el de todas las sedes (cada nombre de zona del catálogo que aparezca suma); sin sedes, el de la ficha.
  const textoDeZonas = sedes.map((s) => s.zona ?? s.partido).filter(Boolean).join(" ");
  const z = await resolverZonas(textoDeZonas || (institucion.zona ?? institucion.partido));
  const c: SQL[] = [
    eq(docentes.onboardingCompleto, true),
    docenteVisible,
    eq(docentes.verificacion, "verificado"),
    sql`not exists (
      select 1 from postulaciones p join busquedas b on b.id = p.busqueda_id
      where p.docente_id = ${docentes.id} and b.institucion_id = ${institucion.id} and b.estado <> 'cerrada'
    )`,
  ];
  if (categorias.length) c.push(inArray(docentes.categoria, categorias));
  if (z) c.push(arrayOverlaps(docentes.zonas, z.ampliada));

  const candidatos = await getDb()
    .select()
    .from(docentes)
    .where(and(...c))
    .orderBy(sql`${docentes.aniosExperiencia} desc nulls last`, desc(docentes.creadoEn))
    .limit(Math.max(limite * 3, 40));

  // Sin sedes (todavía sin crear), la ubicación de la ficha hace de única sede.
  const lugares = sedes.length > 0 ? sedes : [{ lat: institucion.lat, lng: institucion.lng }];
  const puntuados = candidatos
    .map((d) => {
      const km = d.lat != null && d.lng != null ? (sedeMasCercana({ lat: d.lat, lng: d.lng }, lugares)?.km ?? null) : null;
      const nombre = `${d.nombre} ${d.apellido}`.trim();
      const materia = d.asignaturas[0] ?? null;
      const lugar = kmLegible(km) ?? d.zonas[0] ?? null;
      const { puntaje, motivos, busquedaId } = puntuarCandidato(
        {
          categoria: d.categoria,
          asignaturas: d.asignaturas,
          niveles: d.niveles,
          disponibilidad: d.disponibilidad,
          aniosExperiencia: d.aniosExperiencia,
          tituloVerificado: d.tituloVerificado,
          km,
        },
        abiertas,
      );
      return {
        km,
        puntaje,
        fila: {
          id: d.id,
          nombre,
          iniciales: iniciales(nombre),
          fotoUrl: d.fotoUrl,
          categoria: d.categoria,
          detalle: [materia, lugar].filter(Boolean).join(" · "),
          etiquetas: [d.niveles[0], d.disponibilidad[0]].filter((e): e is string => !!e),
          motivos,
          busquedaId,
        } satisfies DocenteRecomendado,
      };
    });
  // Los que más coinciden con las búsquedas abiertas primero; sin coincidencias, los más cercanos y con más experiencia.
  return ordenarPorPuntaje(puntuados)
    .slice(0, limite)
    .map((x) => x.fila);
}
