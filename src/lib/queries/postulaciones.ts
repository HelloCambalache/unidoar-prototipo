import "server-only";
import { and, asc, desc, eq, isNotNull } from "drizzle-orm";
import { getDb } from "@/db";
import {
  busquedas,
  institucionMiembros,
  instituciones,
  postulacionNotas,
  postulaciones,
  type EtapaPostulacion,
} from "@/db/schema";
import { diaHoraLegible, enlaceGoogleCalendar, fechaHoraCorta } from "@/lib/calendario";
import type { FiltrosPostulaciones } from "@/lib/oportunidades";
import { estadoParaDocente } from "@/lib/postulaciones";
import { haceCuanto } from "@/lib/utils";
import { horarioDeBusqueda } from "@/lib/queries/oportunidades";

type EstadoVisible = ReturnType<typeof estadoParaDocente>;

export type FilaPostulacion = {
  id: string;
  puesto: string;
  institucion: string;
  estado: EstadoVisible;
  /** "hace 5 días": se calcula en el servidor para no desfasar la hidratación. */
  cuando: string;
};

export type ListadoPostulaciones = {
  /** Filas de la pestaña elegida, con búsqueda y filtros aplicados. */
  filas: FilaPostulacion[];
  /** Conteos de ambas pestañas con búsqueda y filtros aplicados. */
  conteo: { activas: number; cerradas: number };
  /** Opciones de los selects: salen de las propias postulaciones del docente. */
  niveles: string[];
  zonas: string[];
  /** Postulaciones del docente sin ningún filtro: distingue "no hay ninguna" de "ninguna coincide". */
  total: number;
};

function normalizar(texto: string) {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export async function postulacionesDelDocente(
  docenteId: string,
  filtros: Pick<FiltrosPostulaciones, "q" | "nivel" | "zona" | "tab">,
): Promise<ListadoPostulaciones> {
  const filas = await getDb()
    .select({
      id: postulaciones.id,
      etapa: postulaciones.etapa,
      creadoEn: postulaciones.creadoEn,
      puesto: busquedas.puesto,
      busquedaEstado: busquedas.estado,
      nivel: busquedas.nivel,
      zonaBusqueda: busquedas.zona,
      institucion: instituciones.nombre,
      zonaInstitucion: instituciones.zona,
    })
    .from(postulaciones)
    .innerJoin(busquedas, eq(busquedas.id, postulaciones.busquedaId))
    .innerJoin(instituciones, eq(instituciones.id, busquedas.institucionId))
    .where(eq(postulaciones.docenteId, docenteId))
    .orderBy(desc(postulaciones.creadoEn));

  const ahora = new Date();
  const todas = filas.map((f) => ({
    id: f.id,
    puesto: f.puesto,
    institucion: f.institucion,
    nivel: f.nivel,
    zona: f.zonaBusqueda ?? f.zonaInstitucion,
    estado: estadoParaDocente(f.etapa, f.busquedaEstado),
    cuando: haceCuanto(f.creadoEn, ahora),
  }));

  const consulta = filtros.q ? normalizar(filtros.q) : null;
  const coinciden = todas.filter(
    (p) =>
      (!consulta || normalizar(`${p.puesto} ${p.institucion}`).includes(consulta)) &&
      (!filtros.nivel || p.nivel === filtros.nivel) &&
      (!filtros.zona || p.zona === filtros.zona),
  );
  const activas = coinciden.filter((p) => p.estado.activa);
  const cerradas = coinciden.filter((p) => !p.estado.activa);

  const unicos = (valores: (string | null)[]) =>
    [...new Set(valores.filter((v): v is string => !!v))].sort((a, b) => a.localeCompare(b, "es"));

  return {
    filas: (filtros.tab === "cerradas" ? cerradas : activas).map(({ id, puesto, institucion, estado, cuando }) => ({
      id,
      puesto,
      institucion,
      estado,
      cuando,
    })),
    conteo: { activas: activas.length, cerradas: cerradas.length },
    niveles: unicos(todas.map((p) => p.nivel)),
    zonas: unicos(todas.map((p) => p.zona)),
    total: todas.length,
  };
}

export type DetallePostulacion = {
  id: string;
  busquedaId: string;
  puesto: string;
  institucion: { nombre: string; slug: string };
  estado: EstadoVisible;
  etapa: EtapaPostulacion;
  /** "Postulación enviada hace 5 días" / "Invitación recibida hace 2 días" */
  envio: string;
  zona: string | null;
  horario: string | null;
  tipo: string;
  descripcion: string | null;
  /** Se puede retirar mientras siga en carrera (no contratada ni con la búsqueda cerrada). */
  puedeRetirar: boolean;
  /**
   * pendiente: la institución todavía no movió la postulación (no hubo contacto);
   * activo: avanzó de etapa y contacta por WhatsApp; cerrado: terminó sin seguir.
   */
  contacto: "pendiente" | "activo" | "cerrado";
  agenda: { titulo: string; cuando: string; googleHref: string } | null;
  /** Solo las notas del propio docente: las de la institución son privadas del otro lado. */
  notas: { id: string; texto: string; fecha: string }[];
};

/** Detalle para el cajón. Devuelve null si el id no existe o no es del docente (no se distingue a propósito). */
export async function detallePostulacion(postulacionId: string, docenteId: string): Promise<DetallePostulacion | null> {
  const db = getDb();
  const [fila] = await db
    .select({ postulacion: postulaciones, busqueda: busquedas, institucion: instituciones })
    .from(postulaciones)
    .innerJoin(busquedas, eq(busquedas.id, postulaciones.busquedaId))
    .innerJoin(instituciones, eq(instituciones.id, busquedas.institucionId))
    .where(and(eq(postulaciones.id, postulacionId), eq(postulaciones.docenteId, docenteId)))
    .limit(1);
  if (!fila) return null;
  const { postulacion: p, busqueda: b, institucion: i } = fila;

  const notas = await db
    .select({ id: postulacionNotas.id, texto: postulacionNotas.texto, creadoEn: postulacionNotas.creadoEn })
    .from(postulacionNotas)
    .where(and(eq(postulacionNotas.postulacionId, p.id), eq(postulacionNotas.autor, "docente")))
    .orderBy(desc(postulacionNotas.creadoEn));

  const estado = estadoParaDocente(p.etapa, b.estado);
  const tituloAgenda = p.entrevistaTitulo?.trim() || "Entrevista";

  return {
    id: p.id,
    busquedaId: b.id,
    puesto: b.puesto,
    institucion: { nombre: i.nombre, slug: i.slug },
    estado,
    etapa: p.etapa,
    envio: `${p.origen === "invitacion" ? "Invitación recibida" : "Postulación enviada"} ${haceCuanto(p.creadoEn)}`,
    zona: b.zona ?? i.zona,
    horario: horarioDeBusqueda(b),
    tipo: b.tipo,
    descripcion: b.descripcion,
    puedeRetirar: estado.activa,
    // Archivada (etapa interna "descartado") se ve como pendiente: no se le avisa. Cerrada la búsqueda, ya es un "no siguió".
    contacto: p.etapa === "descartado" ? (b.estado === "cerrada" ? "cerrado" : "pendiente") : p.etapa === "nuevos" ? "pendiente" : "activo",
    agenda: p.entrevistaEn
      ? {
          titulo: tituloAgenda,
          cuando: diaHoraLegible(p.entrevistaEn),
          googleHref: enlaceGoogleCalendar({
            titulo: `${tituloAgenda} — ${i.nombre}`,
            inicio: p.entrevistaEn,
            detalle: `Postulación a "${b.puesto}" en ${i.nombre}. Agendado desde UNIDOAR.`,
            lugar: i.direccion,
          }),
        }
      : null,
    notas: notas.map((n) => ({ id: n.id, texto: n.texto, fecha: fechaHoraCorta(n.creadoEn) })),
  };
}

/** Cuentas que operan una institución: el propietario y los miembros activos que ya tienen usuario. */
export async function usuariosConAcceso(institucion: { id: string; propietarioId: string | null }) {
  const miembros = await getDb()
    .select({ usuarioId: institucionMiembros.usuarioId })
    .from(institucionMiembros)
    .where(
      and(
        eq(institucionMiembros.institucionId, institucion.id),
        eq(institucionMiembros.estado, "activo"),
        isNotNull(institucionMiembros.usuarioId),
      ),
    )
    .orderBy(asc(institucionMiembros.creadoEn));
  const ids = [institucion.propietarioId, ...miembros.map((m) => m.usuarioId)];
  return [...new Set(ids.filter((id): id is string => !!id))];
}
