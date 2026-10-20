/*
 * Errores para el log, sin datos de personas. El mensaje de un error de Drizzle trae el SQL y los parámetros ("Failed query: … params: …"),
 * y los parámetros pueden ser un email, un teléfono o el texto de un mensaje de Contacto: si la base falla (una conexión que se agota,
 * por ejemplo), eso quedaría en los logs de Vercel. Acá se deja solo lo que informó la base (el código y el mensaje, que no incluyen los
 * valores) o, si no es un error de la base, su mensaje. Puro: se prueba solo.
 */

const MAX_LARGO = 300;

type ConCodigo = { code?: unknown; cause?: unknown; message?: unknown };

export function resumenDeError(e: unknown): string {
  if (!(e instanceof Error)) return String(e).slice(0, MAX_LARGO);
  const causa = (e as ConCodigo).cause;
  const deLaBase = causa instanceof Error ? causa : null;
  const codigo = (deLaBase as ConCodigo | null)?.code ?? (e as ConCodigo).code;
  // Un error de consulta de Drizzle empieza con "Failed query:" y lleva el SQL y los parámetros: no se registra su mensaje.
  const esDeConsulta = e.message.startsWith("Failed query:");
  const texto = esDeConsulta ? (deLaBase?.message ?? "falló una consulta a la base") : e.message;
  return `${typeof codigo === "string" ? `[${codigo}] ` : ""}${texto}`.slice(0, MAX_LARGO);
}
