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
