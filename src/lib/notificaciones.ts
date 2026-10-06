import { iniciales } from "@/lib/utils";

/** Aspecto del avatar de una notificación según su tipo (colores del prototipo). */
export function estiloNotificacion(tipo: string, titulo: string) {
  switch (tipo) {
    case "urgente":
      return { ini: "⚡", fondo: "#FDE9E1", texto: "#8A2F1A" };
    case "entrevista":
      return { ini: iniciales(titulo), fondo: "#FBE0EF", texto: "#97125F" };
    case "vista":
    case "verificacion":
      return { ini: iniciales(titulo), fondo: "#E7F5EF", texto: "#1E7A4C" };
    case "sistema":
      return { ini: "UD", fondo: "#F0EFEA", texto: "#3D423E" };
    default:
      return { ini: iniciales(titulo), fondo: "#E5E9FB", texto: "#16214F" };
  }
}

export type NotificacionVista = {
  id: string;
  tipo: string;
  titulo: string;
  texto: string;
  enlace: string | null;
  leida: boolean;
  /** "hace 5 min": se calcula en el servidor para no desfasar la hidratación. */
  cuando: string;
};
