import { z } from "zod";
import { ROLES_EQUIPO_INFO, ROLES_INVITABLES } from "@/lib/catalogo";

/*
 * Reglas del equipo de una institución que comparten el servidor (acciones y queries) y el cliente
 * (modal de invitación, ficha). Sin acceso a base: se puede importar desde Client Components.
 */

export type EstadoMiembro = "activo" | "invitado";

/** Una persona de la tabla "Equipo". */
export type MiembroVista = {
  /** `institucion_miembros.id`; el dueño de una cuenta sin fila propia llega con el id "propietario". */
  id: string;
  nombre: string;
  email: string;
  /** Clave de ROLES_EQUIPO_INFO (puede ser una vieja que ya no está en el catálogo). */
  rol: string;
  estado: EstadoMiembro;
  /** "Ene 2026" */
  desde: string;
  esDueno: boolean;
  /** Es la persona que está mirando la pantalla. */
  esYo: boolean;
  iniciales: string;
};

export type InfoRol = { label: string; corto: string; desc: string };

/** Etiqueta y descripción de un rol; si la clave no está en el catálogo se muestra tal cual. */
export function infoDeRol(clave: string): InfoRol {
  return (ROLES_EQUIPO_INFO as Record<string, InfoRol>)[clave] ?? { label: clave, corto: clave, desc: "" };
}

/**
 * Ruta del enlace de una invitación al equipo: lleva a la persona directo a esa institución (con su email ya puesto), sin
 * tener que elegir "Soy institución". El id es el de la invitación (un uuid que no se puede adivinar).
 */
export const rutaDeInvitacion = (invitacionId: string) => `/invitacion/${invitacionId}`;

/** Solo el dueño y los administradores invitan, cambian roles y quitan gente. */
export const esRolGestor = (rol: string | null | undefined) => rol === "dueno" || rol === "administrador";

/** "veronica.maidana@colegio.edu.ar" → "Veronica Maidana" (hasta que la persona entre y cargue su nombre). */
export function nombreDeEmail(email: string) {
  const local = email.split("@")[0] ?? email;
  const nombre = local
    .replace(/[._+-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((p) => p[0]!.toUpperCase() + p.slice(1))
    .join(" ");
  return nombre || email;
}

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

/** Fecha → "Ene 2026", en hora argentina (UTC-3). */
export function mesYAnio(fecha: Date) {
  const ar = new Date(fecha.getTime() - 3 * 3_600_000);
  return `${MESES[ar.getUTCMonth()]} ${ar.getUTCFullYear()}`;
}

export const invitacionSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(200, "Revisá el email: es demasiado largo")
    .pipe(z.email("Revisá el email: no parece válido")),
  rol: z.enum(ROLES_INVITABLES, { error: "Elegí un rol" }),
});

export const cambioRolSchema = z.object({ rol: z.enum(ROLES_INVITABLES, { error: "Elegí un rol" }) });
