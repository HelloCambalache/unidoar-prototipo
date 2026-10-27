/** A qué búsquedas se puede invitar a un docente y en cuáles ya está. Sin acceso a base: lo usan servidor y cliente. */

export type OpcionInvitacion = {
  id: string;
  puesto: string;
  detalle: string;
  /** libre: se lo puede invitar · invitado: ya lo invitaste · postulado: se postuló él/ella. */
  estado: "libre" | "invitado" | "postulado";
};

export function opcionesDeInvitacion(
  activas: { id: string; puesto: string; detalle: string }[],
  relaciones: { busquedaId: string; origen: "postulacion" | "invitacion" }[],
): OpcionInvitacion[] {
  return activas.map((b) => {
    const r = relaciones.find((x) => x.busquedaId === b.id);
    return {
      id: b.id,
      puesto: b.puesto,
      detalle: b.detalle,
      estado: !r ? "libre" : r.origen === "postulacion" ? "postulado" : "invitado",
    };
  });
}

export type DecisionDeInvitacion =
  | { tipo: "sin-busquedas" }
  /** Una sola búsqueda abierta: se invita directo a esa (si ya está invitada o se postuló, el botón lo dice y no se puede tocar). */
  | { tipo: "directa"; opcion: OpcionInvitacion }
  /** Hay varias búsquedas abiertas y a alguna todavía no está invitada: se pregunta a cuál. */
  | { tipo: "elegir"; opciones: OpcionInvitacion[] }
  /** Hay varias y en todas ya está invitada o se postuló: no hay nada que ofrecer. */
  | { tipo: "ya-esta" };

/**
 * Qué hace «Invitar a postularse» según las búsquedas abiertas de la institución. **Con más de una, siempre se pregunta a cuál** (la búsqueda
 * que se venía mirando, `contextoId`, va primera en la lista, pero no se elige sola): invitar es avisarle a una persona, y a cuál búsqueda la
 * invitás no se puede adivinar. Solo con una única búsqueda abierta se invita directo.
 */
export function decidirInvitacion(opciones: OpcionInvitacion[], contextoId: string | null): DecisionDeInvitacion {
  if (opciones.length === 0) return { tipo: "sin-busquedas" };
  if (opciones.length === 1) return { tipo: "directa", opcion: opciones[0]! };
  if (opciones.every((o) => o.estado !== "libre")) return { tipo: "ya-esta" };
  // La de contexto primero; el resto en el orden que ya traían (las más nuevas primero).
  const delContexto = contextoId ? opciones.filter((o) => o.id === contextoId) : [];
  const resto = opciones.filter((o) => o.id !== contextoId);
  return { tipo: "elegir", opciones: [...delContexto, ...resto] };
}

/**
 * Invitaciones a profesionales que puede mandar una institución por día. Invitar no cuesta nada y avisa por campanita y mail a cada
 * persona: sin un tope, una cuenta recién registrada podía invitar a todo el catálogo. 60 sobra para un uso normal.
 */
export const MAX_INVITACIONES_A_PROFESIONALES_POR_DIA = 60;

/** El motivo por el que hoy no se puede invitar a nadie más (o null). `hoy` son las invitaciones de las últimas 24 horas. */
export function motivoDeTopeDeInvitaciones(hoy: number): string | null {
  return hoy >= MAX_INVITACIONES_A_PROFESIONALES_POR_DIA
    ? `Ya mandaste ${MAX_INVITACIONES_A_PROFESIONALES_POR_DIA} invitaciones hoy. Probá de nuevo mañana o escribinos desde Contacto si necesitás más.`
    : null;
}
