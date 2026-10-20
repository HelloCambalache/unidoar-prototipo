/*
 * Reglas puras del diálogo de confirmación (`src/components/ui/confirmacion.tsx`). Los botones que piden confirmar pasan un mensaje en una
 * sola frase ("¿Quitar a Ana del equipo? Va a perder el acceso…"); el diálogo lo parte en un título corto (la pregunta) y un detalle.
 */

export const TITULO_GENERICO = "¿Confirmás?";
const LARGO_MAXIMO_DEL_TITULO = 120;

/**
 * Separa un mensaje en la pregunta (título del diálogo) y el resto (detalle):
 *  - Si empieza con una pregunta ("¿Borrar a Ana? Esto no se puede deshacer."), la pregunta es el título y lo demás el detalle.
 *  - Si termina con una pregunta ("En la plataforma no figura el DNI. ¿Verificar igual?"), esa pregunta es el título y lo anterior el detalle.
 *  - Si no hay una pregunta corta, el título es genérico y todo el mensaje es el detalle.
 * Nunca se pierde texto: título y detalle juntos dicen lo mismo que el mensaje.
 */
export function dividirMensaje(mensaje: string): { titulo: string; detalle: string | null } {
  const texto = mensaje.replace(/\s+/g, " ").trim();
  if (!texto) return { titulo: TITULO_GENERICO, detalle: null };

  if (texto.startsWith("¿")) {
    const fin = texto.indexOf("?");
    if (fin > 0 && fin + 1 <= LARGO_MAXIMO_DEL_TITULO) {
      return { titulo: texto.slice(0, fin + 1), detalle: texto.slice(fin + 1).trim() || null };
    }
  } else if (texto.endsWith("?")) {
    const inicio = texto.lastIndexOf("¿");
    if (inicio > 0 && texto.length - inicio <= LARGO_MAXIMO_DEL_TITULO) {
      return { titulo: texto.slice(inicio), detalle: texto.slice(0, inicio).trim() || null };
    }
  }
  return { titulo: TITULO_GENERICO, detalle: texto };
}
