import { z } from "zod";

export const ROLES_CONSULTA = ["Institución", "Docente", "Entrenador/a / Instructor/a", "Guardavidas", "Otro"] as const;

export const contactoSchema = z.object({
  nombre: z.string().trim().min(2, "Contanos cómo te llamás").max(120, "Es demasiado largo"),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254, "Es demasiado largo")
    .pipe(z.email("Escribí un email válido")),
  rol: z.enum(ROLES_CONSULTA, { error: "Elegí una opción" }),
  /** Lo que escribe quien elige "Otro" (opcional: igual cuenta su consulta en el mensaje). */
  rolOtro: z.string().trim().max(60, "Máximo 60 caracteres").optional(),
  mensaje: z.string().trim().min(10, "Contanos un poco más (mínimo 10 caracteres)").max(2000, "Máximo 2.000 caracteres"),
});

export type ValoresContacto = { nombre: string; email: string; rol: string; rolOtro?: string; mensaje: string };

/** Estado que devuelve la acción de contacto a `useActionState`. */
export type EstadoContacto = {
  ok: boolean;
  error?: string;
  campos?: Record<string, string>;
  /** Lo que escribió la persona, para no perderlo si hay errores. */
  valores?: ValoresContacto;
};
