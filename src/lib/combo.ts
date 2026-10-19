/*
 * Reglas del teclado de un menú desplegable de opciones (el de las direcciones encontradas). Código puro: lo usa el campo de dirección
 * y se prueba sin navegador.
 */

/** Posición resaltada: -1 es "ninguna" (el foco está en el campo). */
export type Resaltada = number;

/** Flecha abajo / arriba: se mueve una opción, sin dar la vuelta; arriba desde la primera vuelve al campo. */
export function mover(actual: Resaltada, total: number, direccion: "abajo" | "arriba"): Resaltada {
  if (total <= 0) return -1;
  if (direccion === "abajo") return Math.min(actual + 1, total - 1);
  return actual <= 0 ? -1 : actual - 1;
}

/** Qué hace una tecla con el menú abierto: la acción y si hay que frenar el comportamiento normal del navegador (por ejemplo, enviar el formulario). */
export function teclaDelMenu(
  tecla: string,
  resaltada: Resaltada,
  total: number,
): { accion: "mover-abajo" | "mover-arriba" | "elegir" | "cerrar" | "nada"; frenar: boolean } {
  switch (tecla) {
    case "ArrowDown":
      return { accion: "mover-abajo", frenar: true };
    case "ArrowUp":
      return { accion: "mover-arriba", frenar: true };
    // Enter solo elige si hay una opción resaltada; si no, el formulario se envía como siempre.
    case "Enter":
      return resaltada >= 0 && resaltada < total ? { accion: "elegir", frenar: true } : { accion: "nada", frenar: false };
    // Escape cierra el menú sin cerrar el cajón o el diálogo que pueda tener el campo adentro.
    case "Escape":
      return { accion: "cerrar", frenar: true };
    default:
      return { accion: "nada", frenar: false };
  }
}
