/*
 * Respuesta del profesional a la entrevista que agendó la institución ("Voy" / "No puedo"). Reglas puras (sin base ni Next):
 * las usan la acción, el cajón de Mis postulaciones, el mail M24 y el tablero de la institución.
 */

export type RespuestaEntrevista = "voy" | "no_puedo";

export const MAX_MENSAJE_RESPUESTA = 300;

/** El parámetro `?entrevista=` que traen los botones del mail. Solo preselecciona: nunca responde solo al abrir el enlace. */
export function respuestaDesdeEnlace(valor: string | string[] | undefined): RespuestaEntrevista | null {
  const v = Array.isArray(valor) ? valor[0] : valor;
  if (v === "voy") return "voy";
  if (v === "no-puedo") return "no_puedo";
  return null;
}

/** Ruta del cajón de la postulación con la respuesta preseleccionada (botones del mail). */
export function rutaParaResponder(rutaPostulacion: string, respuesta: RespuestaEntrevista) {
  const separador = rutaPostulacion.includes("?") ? "&" : "?";
  return `${rutaPostulacion}${separador}entrevista=${respuesta === "voy" ? "voy" : "no-puedo"}`;
}

/** Por qué no se puede responder ahora (null si se puede). */
export function motivoParaNoResponder(entrevistaEn: Date | null, ahora: Date = new Date()): string | null {
  if (!entrevistaEn) return "La institución todavía no agendó una entrevista (o la quitó).";
  if (entrevistaEn.getTime() <= ahora.getTime()) return "Esta entrevista ya pasó.";
  return null;
}

/** Texto del aviso (campanita) para la institución: "Ana Pérez confirmó la entrevista para «Profesor de Inglés»". */
export function avisoDeRespuesta(nombre: string, puesto: string, respuesta: RespuestaEntrevista, mensaje: string | null) {
  const base =
    respuesta === "voy"
      ? `confirmó que va a la entrevista para «${puesto}».`
      : `avisó que no puede ir a la entrevista para «${puesto}».`;
  return { titulo: nombre, texto: mensaje ? `${base} Mensaje: «${mensaje}»` : base };
}

/** Cómo se muestra la respuesta (tablero de la institución y cajón del profesional). */
export function etiquetaDeRespuesta(respuesta: RespuestaEntrevista | null): { texto: string; tono: "verde" | "naranja" | "neutro" } {
  if (respuesta === "voy") return { texto: "Confirmó que va", tono: "verde" };
  if (respuesta === "no_puedo") return { texto: "No puede ir", tono: "naranja" };
  return { texto: "Sin respuesta", tono: "neutro" };
}
