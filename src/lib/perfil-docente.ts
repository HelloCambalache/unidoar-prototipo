import { z } from "zod";
import { grillaSchema } from "@/lib/onboarding";

/*
 * Formulario "Mi perfil" del docente. El cliente manda todo el estado como JSON en un campo
 * oculto (`datos`) y la acción lo valida con este esquema.
 */

const corto = (max: number) => z.string().trim().max(max, `Máximo ${max} caracteres`);

/** Foto y CV vienen de <SubirArchivo>: una URL o ruta, nunca un esquema ejecutable. */
const rutaArchivo = z
  .string()
  .trim()
  .max(600)
  .refine((v) => !/^\s*(javascript|data|vbscript):/i.test(v), "Archivo inválido");

export const perfilDocenteSchema = z.object({
  nombre: z.string().trim().min(2, "Completá tu nombre").max(60, "Máximo 60 caracteres"),
  apellido: corto(80),
  subtitulo: corto(160),
  resumen: corto(1500),
  telefono: corto(40),
  aniosExperiencia: z
    .number({ error: "Poné un número" })
    .int("Poné un número entero")
    .min(0, "No puede ser negativo")
    .max(60, "Revisá este número")
    .nullable(),
  radioKm: z.number({ error: "Poné un número" }).int().min(1, "Mínimo 1 km").max(200, "Máximo 200 km"),
  zonas: z.array(corto(80).min(1)).max(12, "Hasta 12 zonas"),
  asignaturas: z.array(corto(80).min(1)).max(25, "Hasta 25 asignaturas"),
  niveles: z.array(corto(40).min(1)).max(10),
  experiencia: z.array(z.object({ titulo: corto(120), fechas: corto(60), desc: corto(600) })).max(20, "Hasta 20 experiencias"),
  formacion: z.array(z.object({ titulo: corto(120), detalle: corto(200) })).max(20, "Hasta 20 formaciones"),
  grilla: grillaSchema,
  /** Ausente: no se toca. Vacío: se quita. */
  fotoUrl: rutaArchivo.optional(),
  cvUrl: rutaArchivo.optional(),
  /** Certificado de buena conducta (optativo): path del bucket privado, en `docente_detalle.documentos`. */
  conducta: rutaArchivo.optional(),
  /** DNI (frente y dorso) y título o credencial: paths del bucket privado, en `docente_detalle.documentos`. */
  dniFrente: rutaArchivo.optional(),
  dniDorso: rutaArchivo.optional(),
  credencial: rutaArchivo.optional(),
});

export type DatosPerfil = z.infer<typeof perfilDocenteSchema>;
