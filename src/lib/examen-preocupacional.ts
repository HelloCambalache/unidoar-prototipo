import type { EtapaPostulacion } from "@/db/schema";

/*
 * Archivos del examen preocupacional que guarda la institución en la postulación (el estudio en PDF o foto). Es un dato
 * sensible (de salud): van al bucket privado, se abren solo con un enlace que verifica la cuenta y nunca se muestran por URL
 * pública. Sin acceso a base ni a Storage: lo usan la acción, la ruta de descarga y el cajón.
 */

export type ArchivoExamen = { path: string; nombre: string };

export const MAX_ARCHIVOS_EXAMEN = 5;

/** Carpeta del bucket privado donde se guardan (`<usuarioId>/examenes/<uuid>.<ext>`). */
export const CARPETA_EXAMEN = "examenes";

/** Se pueden adjuntar o quitar archivos mientras la persona está en el examen o, ya contratada, para dejar el registro. */
export const puedeAdjuntarAlExamen = (etapa: EtapaPostulacion) => etapa === "examen_preocupacional" || etapa === "contratado";

/** El nombre del archivo tal como lo ve la institución: sin rutas ni caracteres de control, y de largo razonable. */
export function nombreVisibleDeArchivo(nombre: string | null | undefined, path: string): string {
  const limpio = (nombre ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[/\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  return limpio || (path.split("/").pop() ?? "Archivo");
}

/** Interpreta lo que hay guardado en la columna (jsonb): ignora cualquier cosa que no tenga la forma esperada. */
export function archivosDeExamen(valor: unknown): ArchivoExamen[] {
  if (!Array.isArray(valor)) return [];
  return valor.flatMap((x) => {
    const a = x as Partial<ArchivoExamen> | null;
    return a && typeof a.path === "string" && a.path && typeof a.nombre === "string" ? [{ path: a.path, nombre: a.nombre }] : [];
  });
}

/** Suma un archivo a la lista, sin repetirlo y con tope. Devuelve el motivo si no se puede. */
export function sumarArchivoDeExamen(
  actuales: ArchivoExamen[],
  nuevo: ArchivoExamen,
): { ok: true; lista: ArchivoExamen[] } | { ok: false; error: string } {
  if (actuales.some((a) => a.path === nuevo.path)) return { ok: true, lista: actuales };
  if (actuales.length >= MAX_ARCHIVOS_EXAMEN) {
    return { ok: false, error: `Podés guardar hasta ${MAX_ARCHIVOS_EXAMEN} archivos. Quitá alguno para subir otro.` };
  }
  return { ok: true, lista: [...actuales, nuevo] };
}
