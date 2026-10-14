/*
 * Reglas puras (sin base ni red) de las cuentas que nunca terminaron el alta. Sin perfil completo no hay "Mi cuenta" desde donde pedir la
 * baja, y la lista de profesionales del backoffice solo muestra altas completas: el equipo las ve y las borra desde "Altas sin terminar".
 * Lo usan `src/lib/queries/cuentas-sin-terminar.ts`, la pantalla y la acción.
 */

/** Una cuenta recién registrada puede estar completando el alta: solo se puede borrar pasado este tiempo. */
export const HORAS_MINIMAS_SIN_TERMINAR = 24;

const MS_POR_HORA = 3_600_000;

/** Cuántas horas pasaron desde que se registró. */
export const horasDesde = (creadaEn: Date, ahora: Date) => (ahora.getTime() - creadaEn.getTime()) / MS_POR_HORA;

/**
 * Por qué NO se puede borrar esta cuenta desde "Altas sin terminar" (null = se puede). `rol` es el de la fila `usuarios`, o null si
 * la persona solo existe en el acceso (se registró y nunca llegó a crear su fila). `tieneAltaCompleta` es un perfil de profesional con el
 * alta terminada, una institución propia o ser parte de un equipo: eso se da de baja desde su ficha, no desde acá.
 */
export function impedimentoDeBorrarCuentaSinTerminar(cuenta: {
  rol: string | null;
  tieneAltaCompleta: boolean;
  esDemo: boolean;
  creadaEn: Date;
  ahora: Date;
  esElMismoAdmin: boolean;
}): string | null {
  if (cuenta.esElMismoAdmin) return "No podés borrar tu propia cuenta.";
  if (cuenta.rol !== null && cuenta.rol !== "docente" && cuenta.rol !== "institucion") return "Es una cuenta del equipo de UNIDOAR: no se borra desde acá.";
  if (cuenta.esDemo) return "Es un perfil de ejemplo: no se borra desde acá.";
  if (cuenta.tieneAltaCompleta) return "Esta cuenta ya terminó el alta: se da de baja desde su ficha, no desde acá.";
  if (horasDesde(cuenta.creadaEn, cuenta.ahora) < HORAS_MINIMAS_SIN_TERMINAR) {
    return `Se registró hace menos de ${HORAS_MINIMAS_SIN_TERMINAR} horas: puede estar completando el alta. Probá más tarde.`;
  }
  return null;
}

/** En qué punto se quedó la persona, para que el equipo decida con contexto. */
export function etapaDeAltaSinTerminar(cuenta: { enUsuarios: boolean; confirmoElMail: boolean | null; perfilEmpezado: boolean }): string {
  if (!cuenta.enUsuarios) return cuenta.confirmoElMail ? "Confirmó el mail y no pasó de ahí" : "Nunca confirmó el mail";
  if (cuenta.perfilEmpezado) return "Empezó a llenar su perfil";
  return "Eligió el rol y no siguió";
}
