import { z } from "zod";
import { enlaceWhatsapp } from "@/lib/pipeline";

/*
 * Contactos privados de una institución (Profesionales → "Cargar perfil" e "Importar CSV"): reglas de validación y
 * lectura del CSV. Sin acceso a base: las usan el navegador (vista previa) y las server actions (que vuelven a
 * validar todo, nunca confían en lo que armó el cliente).
 */

export const MAX_FILAS_IMPORTACION = 500;
export const MAX_CONTACTOS_POR_INSTITUCION = 2000;
export const MAX_BYTES_CSV = 512 * 1024;

/** Cuántos dígitos puede tener un teléfono ("+54 9 11 4455-3320" tiene 13). */
const DIGITOS_MIN = 6;
const DIGITOS_MAX = 15;

/** Solo los números de un teléfono, para compararlos entre sí ("11 4455-3320" y "1144553320" son el mismo). */
export const digitosDeTelefono = (telefono: string) => telefono.replace(/\D/g, "");

/**
 * Clave para saber si dos teléfonos son el mismo número aunque estén escritos distinto: "11 4455-3320", "011 4455 3320",
 * "(011) 15 4455 3320" y "+54 9 11 4455-3320" dan la misma. Si no se reconoce como argentino, se comparan los números a secas.
 */
export function claveDeTelefono(telefono: string) {
  const whatsapp = enlaceWhatsapp(telefono);
  return whatsapp ? whatsapp.replace(/\D/g, "") : digitosDeTelefono(telefono).replace(/^0+/, "");
}

const esTelefono = (v: string) => {
  const n = digitosDeTelefono(v).length;
  return /^[\d\s+().-]+$/.test(v) && n >= DIGITOS_MIN && n <= DIGITOS_MAX;
};

const vacioAUndefined = <T extends z.ZodType>(schema: T) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), schema);

export const contactoSchema = z
  .object({
    nombre: z.string().trim().min(2, "Escribí el nombre").max(120, "Máximo 120 caracteres"),
    email: vacioAUndefined(
      z
        .string()
        .trim()
        .toLowerCase()
        .max(200, "Revisá el email: es demasiado largo")
        .pipe(z.email("Revisá el email: no parece válido"))
        .optional(),
    ),
    telefono: vacioAUndefined(
      z
        .string()
        .trim()
        .max(40, "Máximo 40 caracteres")
        .refine(esTelefono, "Revisá el teléfono: tienen que ser entre 6 y 15 números")
        .optional(),
    ),
    disciplina: vacioAUndefined(z.string().trim().max(100, "Máximo 100 caracteres").optional()),
    nota: vacioAUndefined(z.string().trim().max(500, "Máximo 500 caracteres").optional()),
  })
  .refine((c) => Boolean(c.email || c.telefono), {
    path: ["email"],
    message: "Dejá un email o un teléfono para poder contactarlo",
  });
export type ContactoNuevo = z.output<typeof contactoSchema>;

/* ───────────────────────────── CSV ───────────────────────────── */

/** Una fila del archivo tal como vino, antes de validar. `linea` es el número de fila en la planilla (la 1 son los títulos). */
export type FilaCruda = {
  linea: number;
  nombre: string;
  email: string;
  telefono: string;
  disciplina: string;
  nota: string;
};

/** Lo que viaja del navegador al servidor: el servidor vuelve a validar todo. */
export const filaCrudaSchema = z.object({
  linea: z.number().int().min(1).max(1_000_000),
  nombre: z.string().max(1000),
  email: z.string().max(1000),
  telefono: z.string().max(1000),
  disciplina: z.string().max(1000),
  nota: z.string().max(5000),
});
export const filasCrudasSchema = z.array(filaCrudaSchema).max(MAX_FILAS_IMPORTACION, `Hasta ${MAX_FILAS_IMPORTACION} filas por archivo`);

/** Sin tildes, mayúsculas ni signos: "Teléfono (cel.)" → "telefonocel". */
const normalizarTitulo = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const ALIAS: Record<"nombre" | "apellido" | "email" | "telefono" | "disciplina" | "nota", string[]> = {
  nombre: ["nombre", "nombres", "nombreyapellido", "apellidoynombre", "nombrecompleto", "profesional", "docente", "nombreapellido"],
  apellido: ["apellido", "apellidos"],
  email: ["email", "emails", "mail", "correo", "correoelectronico", "mailcontacto"],
  telefono: ["telefono", "tel", "celular", "cel", "movil", "whatsapp", "telefonocelular", "nrotelefono", "numerodetelefono"],
  disciplina: ["disciplina", "materia", "especialidad", "asignatura", "area", "rol", "puesto", "profesion", "actividad"],
  nota: ["nota", "notas", "comentario", "comentarios", "observaciones", "observacion", "detalle"],
};

/** Parte el texto en filas y celdas: comillas dobles, comas dentro de comillas y saltos de línea dentro de una celda. */
export function parsearCsv(texto: string): string[][] {
  const t = texto.replace(/^﻿/, "");
  // El Excel en español exporta con punto y coma; se elige el separador que más aparece en la primera línea.
  const primera = t.split(/\r?\n/, 1)[0] ?? "";
  const cuenta = (c: string) => primera.split(c).length - 1;
  const separador = cuenta(";") > cuenta(",") && cuenta(";") >= cuenta("\t") ? ";" : cuenta("\t") > cuenta(",") ? "\t" : ",";

  const filas: string[][] = [];
  let fila: string[] = [];
  let celda = "";
  let entreComillas = false;
  const cerrarCelda = () => {
    fila.push(celda);
    celda = "";
  };
  const cerrarFila = () => {
    cerrarCelda();
    filas.push(fila);
    fila = [];
  };

  for (let i = 0; i < t.length; i++) {
    const c = t[i]!;
    if (entreComillas) {
      if (c === '"') {
        if (t[i + 1] === '"') {
          celda += '"';
          i++;
        } else entreComillas = false;
      } else celda += c;
    } else if (c === '"' && celda === "") entreComillas = true;
    else if (c === separador) cerrarCelda();
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && t[i + 1] === "\n") i++;
      cerrarFila();
    } else celda += c;
  }
  if (celda !== "" || fila.length > 0) cerrarFila();
  return filas;
}

export type LecturaCsv = { filas: FilaCruda[]; error: null } | { filas: []; error: string };

/**
 * Convierte el texto de un CSV en filas con las columnas conocidas. La primera fila tiene que ser de títulos
 * (nombre, email, teléfono, disciplina, nota; también se entienden variantes como "Correo" o "Celular").
 * Si hay "nombre" y "apellido" separados, se juntan.
 */
export function filasDeCsv(texto: string): LecturaCsv {
  const celdas = parsearCsv(texto);
  const [titulos, ...datos] = celdas;
  if (!titulos || titulos.every((t) => t.trim() === "")) return { filas: [], error: "El archivo está vacío." };

  const columna = (clave: keyof typeof ALIAS) => titulos.findIndex((t) => ALIAS[clave].includes(normalizarTitulo(t)));
  const iNombre = columna("nombre");
  const iApellido = columna("apellido");
  if (iNombre < 0) {
    return {
      filas: [],
      error: "No encontramos la columna del nombre. La primera fila tiene que tener los títulos: nombre, email, teléfono, disciplina y nota.",
    };
  }
  const iEmail = columna("email");
  const iTelefono = columna("telefono");
  if (iEmail < 0 && iTelefono < 0) {
    return { filas: [], error: "Falta la columna del email o la del teléfono: sin eso no hay forma de contactarlos." };
  }
  const iDisciplina = columna("disciplina");
  const iNota = columna("nota");

  const dato = (celdasFila: string[], i: number) => (i >= 0 ? (celdasFila[i] ?? "").trim() : "");
  const filas: FilaCruda[] = [];
  datos.forEach((c, n) => {
    const nombre = [dato(c, iNombre), iApellido >= 0 && iApellido !== iNombre ? dato(c, iApellido) : ""].filter(Boolean).join(" ");
    const fila = { nombre, email: dato(c, iEmail), telefono: dato(c, iTelefono), disciplina: dato(c, iDisciplina), nota: dato(c, iNota) };
    // Las filas completamente en blanco (típicas al final de una planilla) se ignoran.
    if (Object.values(fila).every((v) => v === "")) return;
    filas.push({ linea: n + 2, ...fila });
  });
  return { filas, error: null };
}

export type ErrorDeFila = { linea: number; nombre: string; mensaje: string };
export type ValidacionDeFilas = {
  validas: (ContactoNuevo & { linea: number })[];
  errores: ErrorDeFila[];
  /** Filas que repiten el email o el teléfono de otra fila del mismo archivo (se queda la primera). */
  repetidasEnArchivo: number;
};

/** Valida cada fila con las mismas reglas que el formulario y descarta las repetidas dentro del archivo. */
export function validarFilas(filas: FilaCruda[]): ValidacionDeFilas {
  const validas: ValidacionDeFilas["validas"] = [];
  const errores: ErrorDeFila[] = [];
  const vistos = new Set<string>();
  let repetidasEnArchivo = 0;

  for (const f of filas) {
    const r = contactoSchema.safeParse({ nombre: f.nombre, email: f.email, telefono: f.telefono, disciplina: f.disciplina, nota: f.nota });
    if (!r.success) {
      errores.push({ linea: f.linea, nombre: f.nombre || "(sin nombre)", mensaje: r.error.issues[0]?.message ?? "Fila inválida" });
      continue;
    }
    const clave = r.data.email ? `e:${r.data.email}` : `t:${claveDeTelefono(r.data.telefono ?? "")}`;
    if (vistos.has(clave)) {
      repetidasEnArchivo += 1;
      continue;
    }
    vistos.add(clave);
    validas.push({ ...r.data, linea: f.linea });
  }
  return { validas, errores, repetidasEnArchivo };
}

/** CSV de ejemplo que se descarga desde el diálogo de importación. */
export const CSV_MODELO =
  "nombre,email,telefono,disciplina,nota\r\n" +
  "María Gómez,maria.gomez@ejemplo.com,11 4455-3320,Educación Física,Dio clases en el colegio en 2024\r\n" +
  "Julián Pérez,,11 5566-7788,Natación,Lo recomendó la coordinadora\r\n";
