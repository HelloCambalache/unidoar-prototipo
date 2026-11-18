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

/* ───────────────────────── Recordatorios (2026-11-18, pedido del cliente) ─────────────────────────
 * El equipo puede elegir cuentas de esta pantalla y mandarles un aviso para que terminen el registro: a quien no confirmó el mail se le
 * reenvía el mismo mail de confirmación de siempre; al resto, un recordatorio propio (M69). Reglas puras: la acción las vuelve a aplicar
 * en el servidor, nunca se confía en lo que dice la pantalla. */

/** Cuántos avisos como máximo recibe una misma persona (de cualquiera de los dos tipos): si no volvió después, no le interesa. */
export const MAX_AVISOS_POR_PERSONA = 2;
/** Días que tienen que pasar entre un aviso y el siguiente a la misma persona. */
export const DIAS_ENTRE_AVISOS = 7;
/** Tope de recordatorios (M69) por clic: ningún clic manda cientos. */
export const MAX_RECORDATORIOS_POR_ENVIO = 40;
/** Tope de confirmaciones reenviadas por clic: Supabase limita cuántos mails de acceso salen por hora. */
export const MAX_CONFIRMACIONES_POR_ENVIO = 20;
/** Tope de avisos (recordatorios y confirmaciones juntos) por día: cuida la cuota de mails del dominio. */
export const MAX_AVISOS_POR_DIA = 60;

/** Qué se le manda: a quien no confirmó el mail (solo existe en el acceso), el mail de confirmación; al resto, un recordatorio. */
export type TipoDeAviso = "recordatorio" | "confirmacion";

export const tipoDeAvisoDeAlta = (cuenta: { enUsuarios: boolean; confirmoElMail: boolean | null }): TipoDeAviso =>
  !cuenta.enUsuarios && cuenta.confirmoElMail === false ? "confirmacion" : "recordatorio";

/** Lo que ya se le mandó a una persona (cualquiera de los dos tipos). */
export type HistorialDeAvisos = { cantidad: number; ultimo: Date | null };

export const SIN_AVISOS: HistorialDeAvisos = { cantidad: 0, ultimo: null };

/** Cuántos días faltan para poder volver a escribirle (0 si ya se puede). */
export function diasParaVolverAAvisar(historial: HistorialDeAvisos, ahora: Date): number {
  if (!historial.ultimo) return 0;
  const faltan = DIAS_ENTRE_AVISOS * 24 - horasDesde(historial.ultimo, ahora);
  return faltan <= 0 ? 0 : Math.ceil(faltan / 24);
}

/**
 * Por qué NO se le puede mandar un aviso ahora a esta cuenta (null = se puede). Se suma a lo de borrar: una cuenta del equipo, de ejemplo
 * o con el alta completa nunca; una recién registrada, no todavía (puede estar completando el alta); y a cada persona, como mucho
 * `MAX_AVISOS_POR_PERSONA` avisos con `DIAS_ENTRE_AVISOS` días de distancia.
 */
export function impedimentoDeAvisar(
  cuenta: { rol: string | null; tieneAltaCompleta: boolean; esDemo: boolean; creadaEn: Date; ahora: Date; esElMismoAdmin: boolean },
  historial: HistorialDeAvisos,
): string | null {
  if (cuenta.esElMismoAdmin) return "Es tu propia cuenta.";
  if (cuenta.rol !== null && cuenta.rol !== "docente" && cuenta.rol !== "institucion") return "Es una cuenta del equipo de UNIDOAR.";
  if (cuenta.esDemo) return "Es un perfil de ejemplo.";
  if (cuenta.tieneAltaCompleta) return "Ya terminó el alta.";
  if (horasDesde(cuenta.creadaEn, cuenta.ahora) < HORAS_MINIMAS_SIN_TERMINAR) {
    return `Se registró hace menos de ${HORAS_MINIMAS_SIN_TERMINAR} horas: puede estar completando el alta.`;
  }
  if (historial.cantidad >= MAX_AVISOS_POR_PERSONA) {
    return `Ya recibió ${MAX_AVISOS_POR_PERSONA} avisos: no le escribimos más.`;
  }
  const dias = diasParaVolverAAvisar(historial, cuenta.ahora);
  if (dias > 0) return `Le escribimos hace poco: podés volver a avisarle en ${dias} ${dias === 1 ? "día" : "días"}.`;
  return null;
}

/** «Ninguno», «1 aviso · hace 3 días»… para la columna de la tabla. `haceTiempo` lo arma quien llama (con la hora de la pantalla). */
export const etiquetaDeAvisos = (historial: HistorialDeAvisos, haceTiempo: (fecha: Date) => string): string => {
  if (historial.cantidad === 0 || !historial.ultimo) return "Ninguno";
  return `${historial.cantidad} ${historial.cantidad === 1 ? "aviso" : "avisos"} · ${haceTiempo(historial.ultimo)}`;
};

/** Cuántos avisos se pueden mandar todavía hoy dado lo que ya salió en las últimas 24 horas. */
export const cupoDeAvisosDeHoy = (yaEnviadosHoy: number) => Math.max(0, MAX_AVISOS_POR_DIA - Math.max(0, yaEnviadosHoy));
