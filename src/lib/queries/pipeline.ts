import "server-only";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  busquedas,
  cvEnviados,
  docentes,
  favoritos,
  institucionMiembros,
  postulacionNotas,
  postulaciones,
  usuarios,
  type Institucion,
} from "@/db/schema";
import { CATEGORIA_INFO } from "@/lib/catalogo";
import { diaHoraLegible } from "@/lib/calendario";
import { archivosDeExamen } from "@/lib/examen-preocupacional";
import { aFechaHoraAR, chipEntrevista, diasEntre, fechaCorta, haceTiempo } from "@/lib/fechas";
import { distanciaKm, kmLegible } from "@/lib/geo";
import { autorDeNota, puedeVerElContacto, type BusquedaPipeline, type NotaVista, type OpcionBusqueda, type PostulanteTarjeta } from "@/lib/pipeline";
import { iniciales } from "@/lib/utils";
import { busquedaPropia } from "@/lib/queries/busquedas";
import { estudiantesEntre } from "@/lib/queries/estudiantes";
import { sedesDeInstitucion } from "@/lib/queries/sedes";
import { lugarDeBusqueda } from "@/lib/sedes";

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

/** ¿Esta persona le mandó su CV a esta institución? (junto con postularse, es lo que habilita su contacto y su CV) */
export async function mandoSuCv(institucionId: string, docenteId: string, ejecutor: Ejecutor = getDb()): Promise<boolean> {
  const [fila] = await ejecutor
    .select({ docenteId: cvEnviados.docenteId })
    .from(cvEnviados)
    .where(and(eq(cvEnviados.institucionId, institucionId), eq(cvEnviados.docenteId, docenteId)))
    .limit(1);
  return Boolean(fila);
}

/**
 * ¿La institución puede abrir el CV de esta persona? Es la misma regla que el contacto, a nivel de persona (el CV suele traer el
 * teléfono y el email): se postuló a alguna búsqueda de la institución o le mandó su CV. Que la institución la haya invitado no alcanza.
 */
export async function puedeVerElCvDe(institucionId: string, docenteId: string): Promise<boolean> {
  if (await mandoSuCv(institucionId, docenteId)) return true;
  const [fila] = await getDb()
    .select({ id: postulaciones.id })
    .from(postulaciones)
    .innerJoin(busquedas, eq(busquedas.id, postulaciones.busquedaId))
    .where(and(eq(busquedas.institucionId, institucionId), eq(postulaciones.docenteId, docenteId), eq(postulaciones.origen, "postulacion")))
    .limit(1);
  return Boolean(fila);
}

/** Para el selector de búsqueda del pipeline: abiertas primero, con cuántos postulantes nuevos tiene cada una. */
export async function opcionesDeBusqueda(institucionId: string): Promise<OpcionBusqueda[]> {
  return getDb()
    .select({
      id: busquedas.id,
      puesto: busquedas.puesto,
      estado: busquedas.estado,
      sedeId: busquedas.sedeId,
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
  const [notas, guardados, estudiantes, conCv] = await Promise.all([
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
    estudiantesEntre(docenteIds),
    // Quienes le mandaron su CV a esta institución: junto con quienes se postularon, son los únicos cuyo contacto se muestra.
    docenteIds.length
      ? db
          .select({ docenteId: cvEnviados.docenteId })
          .from(cvEnviados)
          .where(and(eq(cvEnviados.institucionId, institucion.id), inArray(cvEnviados.docenteId, docenteIds)))
      : [],
  ]);
  const mandaronCv = new Set(conCv.map((c) => c.docenteId));

  // Quién escribió cada nota: su nombre en el equipo de esta institución, y su email como último recurso.
  const autorIds = [...new Set(notas.flatMap((n) => (n.usuarioId ? [n.usuarioId] : [])))];
  const [miembros, cuentas] = autorIds.length
    ? await Promise.all([
        db
          .select({ usuarioId: institucionMiembros.usuarioId, nombre: institucionMiembros.nombre })
          .from(institucionMiembros)
          .where(and(eq(institucionMiembros.institucionId, institucion.id), inArray(institucionMiembros.usuarioId, autorIds))),
        db.select({ id: usuarios.id, email: usuarios.email }).from(usuarios).where(inArray(usuarios.id, autorIds)),
      ])
    : [[], []];
  const nombreEnElEquipo = new Map(miembros.flatMap((m) => (m.usuarioId && m.nombre ? [[m.usuarioId, m.nombre] as const] : [])));
  const emailDe = new Map(cuentas.map((c) => [c.id, c.email] as const));

  const notasPor = new Map<string, NotaVista[]>();
  for (const n of notas) {
    const lista = notasPor.get(n.postulacionId) ?? [];
    lista.push({
      id: n.id,
      texto: n.texto,
      cuando: haceTiempo(n.creadoEn, ahora),
      autor: autorDeNota({
        usuarioId: n.usuarioId,
        yo: usuarioId,
        nombreEnElEquipo: n.usuarioId ? nombreEnElEquipo.get(n.usuarioId) : null,
        esPropietario: n.usuarioId === institucion.propietarioId,
        contactoNombre: institucion.contactoNombre,
        email: n.usuarioId ? emailDe.get(n.usuarioId) : null,
      }),
    });
    notasPor.set(n.postulacionId, lista);
  }
  const favoritosSet = new Set(guardados.map((g) => g.refId));
  // Los kilómetros se miden desde la sede de la búsqueda; las búsquedas sin sede, desde la institución.
  const sedeDeLaBusqueda = b.sedeId ? ((await sedesDeInstitucion(institucion.id)).find((s) => s.id === b.sedeId) ?? null) : null;
  const lugar = lugarDeBusqueda(sedeDeLaBusqueda, institucion);
  const origen = lugar.lat != null && lugar.lng != null ? { lat: lugar.lat, lng: lugar.lng } : null;

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
            fechaLocal: aFechaHoraAR(p.entrevistaEn),
            respuesta: p.entrevistaRespuesta ?? null,
            respuestaMensaje: p.entrevistaRespuestaMensaje ?? null,
          }
        : null,
      examenPreocupacional: p.examenPreocupacionalEn ? { cuando: fechaCorta(p.examenPreocupacionalEn) } : null,
      examenArchivos: archivosDeExamen(p.examenPreocupacionalArchivos).map((a) => ({ nombre: a.nombre })),
      esFavorito: favoritosSet.has(d.id),
      suspendido: d.suspendido,
      notas: notasPor.get(p.id) ?? [],
      zonas: d.zonas,
      cv: {
        verificado: d.verificacion === "verificado",
        tituloVerificado: d.tituloVerificado,
        estudiante: estudiantes.get(d.id) ?? null,
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
        // El contacto (teléfono, email y el WhatsApp que sale de él) solo se muestra de quien se postuló o mandó su CV: una invitación
        // no alcanza. Y de un perfil suspendido, nunca.
        contactoVisible: !d.suspendido && puedeVerElContacto(p.origen, mandaronCv.has(d.id)),
        telefono: !d.suspendido && puedeVerElContacto(p.origen, mandaronCv.has(d.id)) ? d.telefono : null,
        email: !d.suspendido && puedeVerElContacto(p.origen, mandaronCv.has(d.id)) ? (d.email ?? emailCuenta ?? null) : null,
        // El archivo no viaja al navegador: "Descargar CV" pasa por /api/cv/<postulación>, que comprueba de quién es y firma la URL.
        // El CV trae el teléfono y el email: se ofrece con la misma regla que el contacto (una invitación sin aceptar no alcanza).
        tieneCv: Boolean(d.cvUrl) && !d.suspendido && puedeVerElContacto(p.origen, mandaronCv.has(d.id)),
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
