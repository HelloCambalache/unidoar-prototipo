/*
 * Varios títulos por profesional (2026-11-12, pedido del cliente: subir cada título por separado en lugar de un solo PDF; quien es docente
 * y guardavidas necesita uno por categoría). Se guardan en `docente_detalle.documentos` como `credencial` (el primero) y `credencial2` a
 * `credencial5`. Así todo lo que ya trabaja con documentos como «clave → archivo» (borrado de archivos reemplazados, la baja, la cola de
 * verificación) sigue funcionando sin cambios. Todo es puro (sin base ni Next) para poder probarlo.
 */

export const CLAVES_DE_TITULO = ["credencial", "credencial2", "credencial3", "credencial4", "credencial5"] as const;
export type ClaveDeTitulo = (typeof CLAVES_DE_TITULO)[number];
export const MAX_TITULOS = CLAVES_DE_TITULO.length;

export const esClaveDeTitulo = (clave: string): clave is ClaveDeTitulo => (CLAVES_DE_TITULO as readonly string[]).includes(clave);

type Documentos = Partial<Record<string, string | undefined>>;

/** Los títulos cargados, en orden. */
export const titulosDe = (documentos: Documentos): { clave: ClaveDeTitulo; path: string }[] =>
  CLAVES_DE_TITULO.flatMap((clave) => {
    const path = documentos[clave];
    return path && path.trim() ? [{ clave, path }] : [];
  });

/** Los títulos cargados o, si no hay ninguno, la casilla del primero (para mostrar que falta). */
export const titulosParaMostrar = (documentos: Documentos): { clave: ClaveDeTitulo }[] => {
  const cargados = titulosDe(documentos);
  return cargados.length > 0 ? cargados : [{ clave: "credencial" }];
};

export const cantidadDeTitulos = (documentos: Documentos) => titulosDe(documentos).length;

/**
 * Acomoda los títulos para que ocupen las primeras casillas sin huecos: si se quitó el primero, el segundo pasa a ser el primero. Así
 * `credencial` está siempre que haya algún título, que es lo que mira el resto de la app. No toca ninguna otra clave. Devuelve una copia.
 */
export function compactarTitulos<T extends Documentos>(documentos: T): T {
  const copia: Documentos = { ...documentos };
  const cargados = titulosDe(copia).map((t) => t.path);
  for (const clave of CLAVES_DE_TITULO) delete copia[clave];
  cargados.forEach((path, i) => {
    copia[CLAVES_DE_TITULO[i]!] = path;
  });
  return copia as T;
}

/** Cuántas casillas de título se muestran de entrada: las que tienen archivo (al menos una). */
export function casillasAbiertas(documentos: Documentos): number {
  let ultima = 0;
  CLAVES_DE_TITULO.forEach((clave, i) => {
    if (documentos[clave]) ultima = i + 1;
  });
  return Math.max(1, ultima);
}

/** El nombre de una casilla: con un solo título es el de la categoría; con varios, «Título o credencial 2». */
export const etiquetaDeCasilla = (indice: number, total: number, nombreUnico: string) =>
  total <= 1 ? nombreUnico : `Título o credencial ${indice + 1}`;

/** ¿Este cambio SUMA un título en una casilla vacía? Es lo único que se puede hacer con un título ya verificado: el equipo lo revisa y vuelve a validar. */
export const sumaUnTitulo = (clave: string, habia: boolean, nuevo: string) => esClaveDeTitulo(clave) && !habia && nuevo.trim() !== "";

/** ¿Dos juegos de documentos tienen las mismas claves con los mismos archivos? (Para saber si hay algo que guardar.) */
export function mismosDocumentos(a: Documentos, b: Documentos): boolean {
  const claves = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const clave of claves) if ((a[clave] ?? "") !== (b[clave] ?? "")) return false;
  return true;
}
