/*
 * Reglas puras de la baja de una cuenta (sin base ni Storage): qué cuentas se pueden dar de baja, cómo se confirma y cómo se
 * buscan los rastros de una persona en textos sueltos. Lo usan `src/lib/queries/baja-docente.ts`, el botón del backoffice y
 * el pedido de baja de "Mi cuenta".
 */

/** Un texto listo para comparar con otro: sin espacios de más y sin distinguir mayúsculas. */
export const comparable = (t: string) => t.trim().replace(/\s+/g, " ").toLowerCase();

/** ¿Escribió el email de la cuenta? Es la confirmación de las acciones que no se pueden deshacer. */
export const confirmaElEmail = (escrito: string, email: string) => comparable(escrito) !== "" && comparable(escrito) === comparable(email);

/**
 * Por qué NO se puede dar de baja a esta cuenta desde el backoffice (null = se puede). Un perfil de ejemplo, uno sin cuenta
 * de acceso o una cuenta del equipo no son una baja que procesar.
 */
export function impedimentoDeBaja(cuenta: { rol: string | null; esDemo: boolean; tieneCuenta: boolean; esElMismoAdmin: boolean }): string | null {
  if (!cuenta.tieneCuenta) return "Es un perfil sin cuenta de acceso: no hay una baja que procesar.";
  if (cuenta.esDemo) return "Es un perfil de ejemplo: no se da de baja desde acá.";
  if (cuenta.rol !== "docente") return "Esa cuenta no es de un profesional: no se da de baja desde acá.";
  if (cuenta.esElMismoAdmin) return "No podés dar de baja tu propia cuenta.";
  return null;
}

/** Un patrón para `ILIKE` que encuentra el texto adentro de otro: los comodines del propio texto se escapan. */
export const patronQueContiene = (texto: string) => `%${texto.replace(/[\\%_]/g, "\\$&")}%`;

/**
 * El nombre completo, si alcanza para buscarlo en avisos y mails sin llevarse por delante los de otras personas. Con un solo
 * nombre corto ("Ana") coincidiría con "Mariana" y con cualquiera: en ese caso no se busca por nombre (null).
 */
export function nombreParaBuscar(nombre: string, apellido: string): string | null {
  const completo = `${nombre} ${apellido}`.trim().replace(/\s+/g, " ");
  return completo.length >= 8 && completo.includes(" ") ? completo : null;
}

/** Parte una lista en tandas del tamaño pedido (Storage borra de a cien). */
export function enLotes<T>(lista: readonly T[], tamano: number): T[][] {
  const lotes: T[][] = [];
  for (let i = 0; i < lista.length; i += tamano) lotes.push(lista.slice(i, i + tamano));
  return lotes;
}
