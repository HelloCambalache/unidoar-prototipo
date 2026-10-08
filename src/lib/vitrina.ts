import { z } from "zod";

/*
 * Vitrina (perfil público) de una institución: esquema de lo que guarda "Mi perfil" y utilidades que
 * comparten el formulario, las server actions y las páginas públicas. Sin acceso a base: se puede
 * importar desde Client Components.
 */

export const MAX_FOTOS = 12;
export const MAX_NOVEDADES = 30;
export const MAX_VALORES = 12;

const MESES = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];

/** "2026-08-12" → "12 AGO" (la fecha chica que acompaña a cada novedad). */
export function fechaNovedad(iso: string) {
  const [, mes, dia] = iso.split("-");
  const m = Number(mes);
  return `${Number(dia)} ${MESES[m - 1] ?? ""}`.trim();
}

/** "2026-08-12" → "12 de agosto de 2026", para el texto alternativo y lectores de pantalla. */
export function fechaNovedadLarga(iso: string) {
  const [anio, mes, dia] = iso.split("-");
  const nombres = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  return `${Number(dia)} de ${nombres[Number(mes) - 1] ?? ""} de ${anio}`;
}

/** Hoy en hora argentina como yyyy-mm-dd, para precargar la fecha de una novedad nueva. */
export function hoyArgentinaISO(ahora = new Date()) {
  return new Date(ahora.getTime() - 3 * 3_600_000).toISOString().slice(0, 10);
}

export type VitrinaFotoVista = { id: string; url: string; etiqueta: string };
export type VitrinaNovedadVista = { id: string; titulo: string; texto: string; fecha: string };

export type CursoVitrina = {
  id: string;
  titulo: string;
  subtitulo: string | null;
  descripcion: string | null;
  fotoUrl: string | null;
};

export type BusquedaAbierta = { id: string; puesto: string; postulantes: number };

/* ───────── Esquema de "Guardar cambios" ───────── */

const corto = (max: number) => z.string().trim().max(max, `Máximo ${max} caracteres`);

/** Foto y portada vienen de <SubirArchivo>: una URL pública, nunca un esquema ejecutable. */
const rutaArchivo = z
  .string()
  .trim()
  .max(600)
  .refine((v) => !/^\s*(javascript|data|vbscript):/i.test(v), "Archivo inválido");

/** Número que el formulario manda como texto ("" = sin dato). */
const numeroOpcional = (min: number, max: number) =>
  z.preprocess(
    (v) => (v === "" || v == null ? null : typeof v === "string" ? Number(v.replace(",", ".")) : v),
    z
      .number({ error: "Poné un número" })
      .int("Poné un número entero")
      .min(min, `Mínimo ${min}`)
      .max(max, `Máximo ${max}`)
      .nullable(),
  );

const fecha = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Elegí una fecha")
  .refine((v) => {
    const d = new Date(`${v}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(v) && d.getUTCFullYear() >= 2000;
  }, "Fecha inválida");

export const vitrinaFotoSchema = z.object({
  id: z.guid().optional(),
  url: rutaArchivo.min(1, "Subí la foto"),
  etiqueta: corto(60),
});

export const vitrinaNovedadSchema = z.object({
  id: z.guid().optional(),
  titulo: z.string().trim().min(3, "Poné un título").max(120, "Máximo 120 caracteres"),
  texto: z.string().trim().min(1, "Escribí la novedad").max(1000, "Máximo 1000 caracteres"),
  fecha,
});

export const vitrinaSchema = z.object({
  /** Vacío: se quita la imagen. */
  portadaUrl: rutaArchivo,
  logoUrl: rutaArchivo,
  nombre: z.string().trim().min(2, "Poné el nombre de la institución").max(120, "Máximo 120 caracteres"),
  tipo: z.string().trim().min(2, "Elegí el tipo de institución").max(60),
  zona: corto(160),
  fundada: numeroOpcional(1800, new Date().getFullYear()),
  alumnos: numeroOpcional(0, 200_000),
  niveles: corto(160),
  turnos: corto(120),
  docentesPlanta: numeroOpcional(0, 100_000),
  descripcion: corto(2000),
  contactoNombre: z.string().trim().min(2, "Completá el nombre de contacto").max(120, "Máximo 120 caracteres"),
  contactoRol: z.string().trim().min(2, "Elegí el rol").max(60),
  mision: corto(600),
  vision: corto(600),
  valores: z.array(z.string().trim().min(1).max(40, "Cada valor puede tener hasta 40 caracteres")).max(MAX_VALORES, `Hasta ${MAX_VALORES} valores`),
  direccion: z.string().trim().min(3, "Completá la dirección").max(200, "Máximo 200 caracteres"),
  /** Firma de la sugerencia de ubicación que eligió la persona (/api/ubicacion); el servidor la verifica antes de usarla. */
  ubicacion: z.string().max(4000).optional(),
  horarioAdministracion: corto(120),
  fotos: z.array(vitrinaFotoSchema).max(MAX_FOTOS, `Hasta ${MAX_FOTOS} fotos`),
  novedades: z.array(vitrinaNovedadSchema).max(MAX_NOVEDADES, `Hasta ${MAX_NOVEDADES} novedades`),
});

export type DatosVitrina = z.infer<typeof vitrinaSchema>;

/** Errores de Zod por ruta completa ("novedades.2.titulo"), para pintarlos junto a cada campo. */
export function camposDeError(error: z.ZodError) {
  const campos: Record<string, string> = {};
  for (const issue of error.issues) campos[issue.path.join(".") || "_"] ??= issue.message;
  return campos;
}

/** Sin repetidos (sin distinguir mayúsculas), respetando el orden y cómo lo escribió la persona. */
export function sinRepetidos(lista: string[]) {
  const vistos = new Set<string>();
  return lista.filter((x) => {
    const clave = x.trim().toLowerCase();
    if (!clave || vistos.has(clave)) return false;
    vistos.add(clave);
    return true;
  });
}
