import { BUCKETS, CARPETAS, urlPublicaDe, type BucketAlmacenamiento } from "@/lib/subidas";

/*
 * Qué archivos de Storage referencia un valor guardado en la base y cuáles dejaron de usarse. Sin acceso a base ni
 * a Storage: lo usan `borrarArchivos` (src/lib/queries/archivos.ts) y el script de limpieza (src/db/limpiar-archivos.ts).
 */

export type ObjetoDeArchivo = { bucket: BucketAlmacenamiento; path: string };

/** `<usuarioId>/<carpeta>/<uuid>.<ext>`: lo que arma /api/subir. */
const FORMA_DEL_PATH = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/([a-z]+)\/[A-Za-z0-9._-]+$/;

/**
 * De un valor guardado en la base al objeto de Storage que referencia: una URL pública del bucket `publico`, o un path
 * del bucket `privado` (CV y documentos). Null si no es un archivo subido por la app: un logo estático (`/assets/…`),
 * la foto de una cuenta de Google u otra URL externa, un texto cualquiera.
 */
export function objetoDeArchivo(valor: string | null | undefined): ObjetoDeArchivo | null {
  if (!valor) return null;
  const prefijoPublico = urlPublicaDe("");
  let bucket: BucketAlmacenamiento;
  let path: string;
  if (prefijoPublico && valor.startsWith(prefijoPublico)) {
    bucket = "publico";
    path = valor.slice(prefijoPublico.length);
  } else if (/^(https?:)?\//.test(valor)) {
    return null;
  } else {
    bucket = "privado";
    path = valor;
  }
  const carpeta = FORMA_DEL_PATH.exec(path)?.[1];
  const carpetas: Record<string, unknown> = CARPETAS[bucket];
  return carpeta && carpeta in carpetas ? { bucket, path } : null;
}

/** De los valores de antes, los que ya no están entre los de después (lo que se reemplazó o se quitó). Sin repetidos. */
export function quitados(antes: (string | null | undefined)[], despues: (string | null | undefined)[]): string[] {
  const vigentes = new Set(despues.filter((v): v is string => Boolean(v)));
  return [...new Set(antes.filter((v): v is string => Boolean(v) && !vigentes.has(v as string)))];
}

/** Patrón (para buscar dentro de texto) de un path de archivo de la app, con las carpetas permitidas. */
export function patronDePaths() {
  const carpetas = [...new Set(BUCKETS.flatMap((b) => Object.keys(CARPETAS[b])))].join("|");
  return `[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/(?:${carpetas})/[A-Za-z0-9._-]+`;
}
