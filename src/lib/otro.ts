/*
 * "Otro" con texto propio. Varios desplegables (tipo de institución, rol de contacto, nivel de una búsqueda, quién consulta en
 * Contacto) terminan en "Otro": al elegirlo aparece un "¿Cuál?" y se guarda lo que la persona escribió, no la palabra "Otro".
 * Código puro: lo usan los formularios (navegador) y las acciones (servidor).
 */

export const OTRO = "Otro";
/** Largo máximo de lo que se escribe en "¿Cuál?". */
export const MAX_OTRO = 60;

/**
 * Qué opción del desplegable queda elegida y qué texto va en "¿Cuál?" para un valor ya guardado.
 * Un valor que no está en el vocabulario es algo que se escribió a mano: la opción es "Otro" y el valor es el texto.
 */
export function opcionYTexto(valor: string | null | undefined, vocabulario: readonly string[]): { opcion: string; texto: string } {
  const v = (valor ?? "").trim();
  if (!v) return { opcion: "", texto: "" };
  if (v === OTRO || vocabulario.includes(v)) return { opcion: v, texto: "" };
  return { opcion: OTRO, texto: v };
}

/**
 * Lo que se guarda: la opción elegida o, si eligió "Otro", lo que escribió (sin espacios de más y con el tope de largo).
 * Null si eligió "Otro" y no escribió nada: el formulario tiene que pedirlo.
 */
export function valorElegido(opcion: string, texto: string | null | undefined): string | null {
  if (opcion !== OTRO) return opcion;
  const t = (texto ?? "").trim().replace(/\s+/g, " ").slice(0, MAX_OTRO);
  return t || null;
}

/** El valor de un campo "con Otro" a partir de lo que cambia en pantalla: sin texto vuelve a "Otro" para que el "¿Cuál?" no desaparezca. */
export const valorAlEscribirOtro = (texto: string) => (texto.trim() ? texto : OTRO);

/**
 * ¿Una institución de este tipo entra en el filtro? "Otro" junta todo lo que no es uno de los tipos de la lista
 * (los escritos a mano incluidos); cualquier otro filtro es el tipo exacto.
 */
export function esDelTipo(tipo: string | null | undefined, filtro: string, vocabulario: readonly string[]): boolean {
  if (!filtro) return true;
  if (filtro !== OTRO) return tipo === filtro;
  return !tiposFijos(vocabulario).includes(tipo ?? "");
}

/** Los tipos de la lista sin "Otro". */
export const tiposFijos = (vocabulario: readonly string[]) => vocabulario.filter((t) => t !== OTRO);
