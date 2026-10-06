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
