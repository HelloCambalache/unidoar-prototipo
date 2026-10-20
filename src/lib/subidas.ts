import { supabaseUrl } from "@/lib/supabase/env";

/*
 * Reglas de la subida de archivos (las comparten la ruta /api/subir y el componente SubirArchivo).
 * Un paquete que necesite otra carpeta la suma acá: la ruta rechaza todo lo que no esté en la lista.
 */

export const BUCKETS = ["publico", "privado"] as const;
export type BucketAlmacenamiento = (typeof BUCKETS)[number];

export type TipoArchivo = "imagen" | "pdf" | "imagen-o-pdf";

/**
 * Carpetas permitidas por bucket y qué tipo de archivo acepta cada una.
 * `publico`: logos, portadas, fotos (se sirven por URL pública). `privado`: CV y documentación
 * (se guarda el path y las URLs firmadas se generan al leer, ver src/lib/almacenamiento.ts).
 */
export const CARPETAS = {
  publico: { logos: "imagen", portadas: "imagen", fotos: "imagen", cursos: "imagen", novedades: "imagen", instalaciones: "imagen" },
  privado: { cv: "pdf", documentos: "imagen-o-pdf", examenes: "imagen-o-pdf" },
} as const satisfies Record<BucketAlmacenamiento, Record<string, TipoArchivo>>;

export type CarpetaDe<B extends BucketAlmacenamiento> = keyof (typeof CARPETAS)[B] & string;

export const tipoDeCarpeta = (bucket: BucketAlmacenamiento, carpeta: string): TipoArchivo | null => {
  const carpetas: Record<string, TipoArchivo> = CARPETAS[bucket];
  // Solo claves propias: "constructor", "toString" o "__proto__" no son carpetas (un objeto común las hereda de `Object`).
  return Object.hasOwn(carpetas, carpeta) ? (carpetas[carpeta] ?? null) : null;
};

export const LIMITE_IMAGEN = 5 * 1024 * 1024;
/**
 * Lo máximo que se le pide procesar al navegador antes de achicarla: una foto de celular de 10 a 20 MB entra, un
 * archivo de cientos de MB no. El límite que cuenta (`LIMITE_IMAGEN`) se aplica al resultado ya comprimido.
 */
export const LIMITE_ORIGINAL_IMAGEN = 25 * 1024 * 1024;
export const LIMITE_PDF = 50 * 1024 * 1024;
/**
 * Las funciones de Vercel rechazan cuerpos de más de 4,5 MB: el navegador comprime las imágenes grandes antes de
 * subirlas, y los PDF que pasan de este tope se suben directo a Storage con una URL firmada (ver `CARPETA_DE_PASO`).
 */
export const LIMITE_CUERPO_PETICION = 4 * 1024 * 1024;

/**
 * Carpeta (dentro del bucket `privado`) donde llegan los PDF grandes subidos directo a Storage. Ninguna acción acepta
 * un path de acá como valor guardado: /api/subir/confirmar revisa los bytes y guarda lo revisado en su carpeta definitiva.
 */
export const CARPETA_DE_PASO = "subidas";

export const MIME_IMAGEN = ["image/jpeg", "image/png", "image/webp"] as const;
export const MIME_PDF = "application/pdf";

export const aceptaDeTipo = (tipo: TipoArchivo) =>
  tipo === "imagen" ? MIME_IMAGEN.join(",") : tipo === "pdf" ? MIME_PDF : [...MIME_IMAGEN, MIME_PDF].join(",");

export const mb = (bytes: number) => `${Math.round((bytes / (1024 * 1024)) * 10) / 10}`.replace(".", ",");

export type ArchivoDetectado = { mime: string; ext: string; clase: "imagen" | "pdf" };

/** Mira los primeros bytes: el tipo que declara el navegador no es confiable. */
export function detectarArchivo(b: Uint8Array): ArchivoDetectado | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: "image/jpeg", ext: "jpg", clase: "imagen" };
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { mime: "image/png", ext: "png", clase: "imagen" };
  if (
    b.length >= 12 &&
    String.fromCharCode(b[0]!, b[1]!, b[2]!, b[3]!) === "RIFF" &&
    String.fromCharCode(b[8]!, b[9]!, b[10]!, b[11]!) === "WEBP"
  ) {
    return { mime: "image/webp", ext: "webp", clase: "imagen" };
  }
  if (b.length >= 5 && String.fromCharCode(b[0]!, b[1]!, b[2]!, b[3]!, b[4]!) === "%PDF-") {
    return { mime: "application/pdf", ext: "pdf", clase: "pdf" };
  }
  return null;
}

/** URL pública de un path del bucket `publico` (no hace falta clave de servicio para armarla). */
export function urlPublicaDe(path: string) {
  const base = supabaseUrl();
  return base ? `${base.replace(/\/$/, "")}/storage/v1/object/public/publico/${path}` : null;
}

/**
 * ¿Es una URL pública que subió esta misma cuenta? Las acciones que guardan un logo o una portada
 * la usan para no aceptar URLs arbitrarias que llegan en un formulario.
 */
export function esUrlPublicaPropia(url: string, usuarioId: string) {
  const prefijo = urlPublicaDe(`${usuarioId}/`);
  if (!prefijo || !url.startsWith(prefijo)) return false;
  const resto = url.slice(prefijo.length);
  return !/[?#%]|\.\./.test(resto) && resto.length > 0;
}

/** ¿Es un path del bucket privado de esta cuenta, en esa carpeta? (`<usuarioId>/<carpeta>/<archivo>`) */
export function esPathPrivadoPropio(path: string, usuarioId: string, carpeta: string) {
  const prefijo = `${usuarioId}/${carpeta}/`;
  if (!path.startsWith(prefijo)) return false;
  const resto = path.slice(prefijo.length);
  // Sin "%": los nombres que genera /api/subir son "<uuid>.<ext>"; "%2e%2e%2f" sería un "../" escondido que Storage podría decodificar.
  return resto.length > 0 && !/[/\\?#%]|\.\./.test(resto);
}

/** "…/cv/3f2a.pdf" → "3f2a.pdf" */
export const nombreDePath = (path: string) => path.split("/").pop() ?? path;

/**
 * Lo máximo que puede tener una cuenta sin terminar de subir en la carpeta de paso (`<usuario>/subidas/`): subidas directas a Storage que
 * nunca se confirmaron. Es un freno al abuso (pedir URLs de subida y no confirmar llenaba Storage): tres PDF del tamaño máximo.
 */
export const CUOTA_DE_PASO_BYTES = 150 * 1024 * 1024;

/** Cuántas horas puede quedar un archivo en la carpeta de paso antes de que la limpieza diaria lo borre (una subida en curso dura minutos). */
export const HORAS_DE_PASO_ANTES_DE_BARRER = 2;

/** ¿Entra un archivo más de `nuevo` bytes sin pasarse de la cuota de la carpeta de paso, teniendo ya `usado`? */
export const cabeEnLaCuotaDePaso = (usado: number, nuevo: number) => usado + nuevo <= CUOTA_DE_PASO_BYTES;

const PATH_DE_PASO = new RegExp(`^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/${CARPETA_DE_PASO}/[^/]+$`, "i");

/**
 * ¿Es un path de la carpeta de paso (`<uuid de la cuenta>/subidas/<archivo>`)? Es lo único que borra la limpieza automática: ante la duda
 * (otra carpeta, otro bucket, un path raro) no se toca.
 */
export const esPathDePaso = (path: string) => PATH_DE_PASO.test(path);
