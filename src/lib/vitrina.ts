import { z } from "zod";
import type { Institucion } from "@/db/schema";

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

/** Valores iniciales de los campos editables del formulario (los números como texto, que es como los maneja un input). */
export type DatosFormularioVitrina = {
  portadaUrl: string;
  logoUrl: string;
  nombre: string;
  tipo: string;
  fundada: string;
  alumnos: string;
  niveles: string;
  turnos: string;
  docentesPlanta: string;
  descripcion: string;
  contactoNombre: string;
  contactoRol: string;
  mision: string;
  vision: string;
  valores: string[];
  horarioAdministracion: string;
};

/** Lo que guarda hoy la institución, como arranca el formulario del perfil público. */
export function datosInicialesDeVitrina(i: Institucion): DatosFormularioVitrina {
  return {
    portadaUrl: i.portadaUrl ?? "",
    logoUrl: i.logoUrl ?? "",
    nombre: i.nombre,
    tipo: i.tipo,
    fundada: i.fundada?.toString() ?? "",
    alumnos: i.alumnos?.toString() ?? "",
    niveles: i.niveles ?? "",
    turnos: i.turnos ?? "",
    docentesPlanta: i.docentesPlanta?.toString() ?? "",
    descripcion: i.descripcion ?? "",
    contactoNombre: i.contactoNombre ?? "",
    contactoRol: i.contactoRol ?? "",
    mision: i.mision ?? "",
    vision: i.vision ?? "",
    valores: i.valores,
    horarioAdministracion: i.horarioAdministracion ?? "",
  };
}

/**
 * Lo que devuelve "Guardar cambios" del perfil público: las listas ya con sus ids y la huella de lo que quedó guardado (para que el
 * próximo guardado compare contra esto y no contra lo que se abrió al principio).
 */
export type VitrinaGuardada = { fotos: VitrinaFotoVista[]; novedades: VitrinaNovedadVista[]; huella: string };

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

/* ───────── Qué cambió al guardar ───────── */

/** Lo que muestra "Actividad del equipo" cuando un admin edita el perfil: qué partes tocó, sin los valores. */
export type VitrinaAntes = {
  nombre: string;
  tipo: string;
  fundada: number | null;
  alumnos: number | null;
  niveles: string | null;
  turnos: string | null;
  docentesPlanta: number | null;
  descripcion: string | null;
  contactoNombre: string | null;
  contactoRol: string | null;
  mision: string | null;
  vision: string | null;
  valores: string[];
  horarioAdministracion: string | null;
  logoUrl: string | null;
  portadaUrl: string | null;
  fotos: { url: string; etiqueta: string }[];
  novedades: { titulo: string; texto: string; fecha: string }[];
};

const CAMPOS_DE_VITRINA: [keyof VitrinaAntes & keyof DatosVitrina, string][] = [
  ["nombre", "nombre"],
  ["tipo", "tipo"],
  ["fundada", "año de fundación"],
  ["alumnos", "alumnos"],
  ["niveles", "niveles"],
  ["turnos", "turnos"],
  ["docentesPlanta", "profesionales en planta"],
  ["descripcion", "descripción"],
  ["contactoNombre", "nombre de contacto"],
  ["contactoRol", "rol de contacto"],
  ["mision", "misión"],
  ["vision", "visión"],
  ["horarioAdministracion", "horario de administración"],
  ["logoUrl", "logo"],
  ["portadaUrl", "portada"],
];

const comoTexto = (v: unknown) => (v === null || v === undefined ? "" : String(v).trim());

/**
 * Una huella de lo que había guardado cuando se abrió la pantalla del perfil público: la pantalla la manda al guardar y el servidor la
 * compara con lo que hay en ese momento. Si no coinciden, otra persona del equipo guardó mientras tanto y NO se pisa lo suyo (lo mismo
 * que ya hace Planes). La galería y las novedades van en el orden en que se muestran (el de la base).
 */
export function huellaDeVitrina(v: VitrinaAntes): string {
  return JSON.stringify({
    campos: CAMPOS_DE_VITRINA.map(([k]) => comoTexto(v[k])),
    valores: sinRepetidos(v.valores),
    fotos: v.fotos.map((f) => [f.url, comoTexto(f.etiqueta)]),
    novedades: v.novedades.map((n) => [n.titulo, n.texto, n.fecha]),
  });
}

/** Nombres (en castellano) de lo que cambió entre lo guardado y lo que se manda: campos, valores, galería y novedades. */
export function cambiosDeVitrina(antes: VitrinaAntes, d: DatosVitrina): string[] {
  const cambios = CAMPOS_DE_VITRINA.filter(([k]) => comoTexto(antes[k]) !== comoTexto(d[k])).map(([, etiqueta]) => etiqueta);
  if (sinRepetidos(antes.valores).join("\n") !== sinRepetidos(d.valores).join("\n")) cambios.push("valores");
  const fotos = (l: { url: string; etiqueta: string }[]) => l.map((f) => `${f.url}|${comoTexto(f.etiqueta)}`).join("\n");
  if (fotos(antes.fotos) !== fotos(d.fotos)) cambios.push("galería de fotos");
  const novedades = (l: { titulo: string; texto: string; fecha: string }[]) => l.map((n) => `${n.titulo}|${n.texto}|${n.fecha}`).join("\n");
  if (novedades(antes.novedades) !== novedades(d.novedades)) cambios.push("novedades");
  return cambios;
}

/**
 * Una institución verificada tiene el nombre y el tipo congelados para quien edita su propio perfil: el equipo los revisó junto con el CUIT
 * y el sello de verificada depende de eso (si no, una institución verificada podía pasar a llamarse como otra y conservar el sello). Solo
 * el equipo los cambia, desde el backoffice. Devuelve cuáles de los dos campos se quieren cambiar (ignora espacios de más).
 */
export function identidadCambiada(actual: { nombre: string; tipo: string }, nuevo: { nombre: string; tipo: string }): ("nombre" | "tipo")[] {
  const igual = (a: string, b: string) => a.trim().replace(/\s+/g, " ") === b.trim().replace(/\s+/g, " ");
  const cambios: ("nombre" | "tipo")[] = [];
  if (!igual(actual.nombre, nuevo.nombre)) cambios.push("nombre");
  if (!igual(actual.tipo, nuevo.tipo)) cambios.push("tipo");
  return cambios;
}
