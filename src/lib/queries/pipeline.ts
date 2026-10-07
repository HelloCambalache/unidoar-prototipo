import "server-only";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  busquedas,
  docentes,
  favoritos,
  postulacionNotas,
  postulaciones,
  usuarios,
  type Institucion,
} from "@/db/schema";
import { CATEGORIA_INFO } from "@/lib/catalogo";
import { diaHoraLegible } from "@/lib/calendario";
import { chipEntrevista, diasEntre, haceTiempo } from "@/lib/fechas";
import { distanciaKm, kmLegible } from "@/lib/geo";
import type { BusquedaPipeline, NotaVista, OpcionBusqueda, PostulanteTarjeta } from "@/lib/pipeline";
import { iniciales } from "@/lib/utils";
import { busquedaPropia } from "@/lib/queries/busquedas";

type Db = ReturnType<typeof getDb>;
/** La base o una transacción: las acciones pasan `tx` para que el chequeo de propiedad y la escritura sean atómicos. */
export type Ejecutor = Pick<Db, "select" | "insert" | "update" | "delete">;

/**
 * La postulación junto con su búsqueda y su docente, solo si la búsqueda es de la institución.
 * Todas las acciones del pipeline arrancan por acá: un id de postulación que viene del cliente
 * no se usa nunca sin pasar por este chequeo.
 */
export async function postulacionPropia(institucionId: string, postulacionId: string, ejecutor: Ejecutor = getDb()) {
  const [fila] = await ejecutor
    .select({ postulacion: postulaciones, busqueda: busquedas, docente: docentes })
    .from(postulaciones)
    .innerJoin(busquedas, eq(busquedas.id, postulaciones.busquedaId))
    .innerJoin(docentes, eq(docentes.id, postulaciones.docenteId))
    .where(and(eq(postulaciones.id, postulacionId), eq(busquedas.institucionId, institucionId)))
    .limit(1);
  return fila ?? null;
}

/** Para el selector de búsqueda del pipeline: abiertas primero, con cuántos postulantes nuevos tiene cada una. */
export async function opcionesDeBusqueda(institucionId: string): Promise<OpcionBusqueda[]> {
  return getDb()
    .select({
      id: busquedas.id,
      puesto: busquedas.puesto,
      estado: busquedas.estado,
      nuevos: sql<number>`count(${postulaciones.id}) filter (where ${postulaciones.etapa} = 'nuevos')`.mapWith(Number),
    })
    .from(busquedas)
    .leftJoin(postulaciones, eq(postulaciones.busquedaId, busquedas.id))
    .where(eq(busquedas.institucionId, institucionId))
    .groupBy(busquedas.id)
    .orderBy(sql`(${busquedas.estado} = 'cerrada')`, desc(busquedas.creadoEn));
}

/** La búsqueda que se abre por defecto en /institucion/postulantes: la abierta con más nuevos. */
export function busquedaPorDefecto(opciones: OpcionBusqueda[]) {
  const abiertas = opciones.filter((o) => o.estado !== "cerrada");
  const mejor = [...abiertas].sort((a, b) => b.nuevos - a.nuevos)[0];
  return (mejor ?? opciones[0])?.id ?? null;
}

/** Todo el pipeline de una búsqueda: sus postulantes con lo que necesita la tarjeta y el cajón del CV. */
export async function pipelineDeBusqueda(
  institucion: Institucion,
  usuarioId: string,
  busquedaId: string,
): Promise<{ busqueda: BusquedaPipeline; postulantes: PostulanteTarjeta[] } | null> {
  const db = getDb();
  const b = await busquedaPropia(institucion.id, busquedaId);
  if (!b) return null;
  const ahora = new Date();

  const filas = await db
    .select({ p: postulaciones, d: docentes, emailCuenta: usuarios.email })
    .from(postulaciones)
    .innerJoin(docentes, eq(docentes.id, postulaciones.docenteId))
    .leftJoin(usuarios, eq(usuarios.id, docentes.usuarioId))
    .where(eq(postulaciones.busquedaId, b.id))
    .orderBy(desc(postulaciones.etapaDesde));

  const ids = filas.map((f) => f.p.id);
  const docenteIds = filas.map((f) => f.d.id);
  const [notas, guardados] = await Promise.all([
    ids.length
      ? db
          .select()
          .from(postulacionNotas)
          .where(and(inArray(postulacionNotas.postulacionId, ids), eq(postulacionNotas.autor, "institucion")))
          .orderBy(desc(postulacionNotas.creadoEn))
      : [],
    docenteIds.length
      ? db
          .select({ refId: favoritos.refId })
          .from(favoritos)
          .where(and(eq(favoritos.usuarioId, usuarioId), eq(favoritos.tipo, "docente"), inArray(favoritos.refId, docenteIds)))
      : [],
  ]);

  const notasPor = new Map<string, NotaVista[]>();
  for (const n of notas) {
    const lista = notasPor.get(n.postulacionId) ?? [];
    lista.push({ id: n.id, texto: n.texto, cuando: haceTiempo(n.creadoEn, ahora) });
    notasPor.set(n.postulacionId, lista);
  }
  const favoritosSet = new Set(guardados.map((g) => g.refId));
  const origen = institucion.lat != null && institucion.lng != null ? { lat: institucion.lat, lng: institucion.lng } : null;

  const postulantes = filas.map(({ p, d, emailCuenta }): PostulanteTarjeta => {
    const nombre = `${d.nombre} ${d.apellido}`.trim();
    const km = origen && d.lat != null && d.lng != null ? distanciaKm(origen, { lat: d.lat, lng: d.lng }) : null;
    const ubicacion = kmLegible(km) ?? d.zonas[0] ?? null;
    return {
      id: p.id,
      docenteId: d.id,
      nombre,
      iniciales: iniciales(nombre),
      fotoUrl: d.fotoUrl,
      categoria: d.categoria,
      subtitulo: [d.asignaturas[0], ubicacion].filter(Boolean).join(" · ") || CATEGORIA_INFO[d.categoria].label,
      etapa: p.etapa,
      origen: p.origen,
      mensaje: p.mensaje,
      dias: diasEntre(p.etapaDesde, ahora),
      desde: haceTiempo(p.creadoEn, ahora),
      etapaDesde: p.etapaDesde.toISOString(),
      entrevista: p.entrevistaEn
        ? {
            texto: diaHoraLegible(p.entrevistaEn),
            corta: chipEntrevista(p.entrevistaEn, ahora),
            titulo: p.entrevistaTitulo,
          }
        : null,
      esFavorito: favoritosSet.has(d.id),
      suspendido: d.suspendido,
      notas: notasPor.get(p.id) ?? [],
      zonas: d.zonas,
      cv: {
        verificado: d.verificacion === "verificado",
        tituloVerificado: d.tituloVerificado,
        antecedentesVerificados: d.antecedentesVerificados,
        subtitulo: d.subtitulo,
        resumen: d.resumen,
        aniosExperiencia: d.aniosExperiencia,
        experiencia: d.experiencia,
        formacion: d.formacion,
        asignaturas: d.asignaturas,
        niveles: d.niveles,
        disponibilidad: d.disponibilidad,
        ubicacion: kmLegible(km),
        // De un perfil suspendido no se muestra el contacto (tampoco el WhatsApp, que sale del teléfono).
        telefono: d.suspendido ? null : d.telefono,
        email: d.suspendido ? null : (d.email ?? emailCuenta ?? null),
        cvUrl: d.cvUrl,
      },
    };
  });

  return {
    busqueda: {
      id: b.id,
      puesto: b.puesto,
      estado: b.estado,
      rapida: b.rapida,
      publicada: haceTiempo(b.creadoEn, ahora),
      postulantes: postulantes.filter((x) => x.etapa !== "descartado").length,
    },
    postulantes,
  };
}
