import "server-only";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { docentes, instituciones, type Docente, type Institucion, type Usuario } from "@/db/schema";
import { asegurarUsuario, sesionActual } from "@/lib/auth";
import { RUTA_INICIO } from "@/lib/catalogo";
import type { RolAlta } from "@/lib/onboarding";

/*
 * Guardas de las pantallas y acciones del alta. Leen la base directo (no `docenteActual()` /
 * `institucionActual()`, que están cacheadas por request): una acción que acaba de crear la fila
 * del usuario tiene que verla en el mismo request.
 */

/**
 * Usuario del alta: exige sesión (si no, vuelve al paso 1 del rol, que es el registro) y crea la fila
 * `usuarios` con ese rol la primera vez. Quien ya tiene otro rol va a su propio inicio.
 */
export async function usuarioParaAlta(rol: RolAlta): Promise<Usuario> {
  if (!(await sesionActual())) redirect(`/onboarding/${rol}/1`);
  const usuario = await asegurarUsuario(rol);
  if (usuario.rol !== rol && usuario.rol !== "admin") redirect(RUTA_INICIO[usuario.rol]);
  return usuario;
}

/** Institución que posee la cuenta, o null si todavía no completó el paso 2. */
export async function institucionPropia(usuarioId: string): Promise<Institucion | null> {
  const [fila] = await getDb().select().from(instituciones).where(eq(instituciones.propietarioId, usuarioId)).limit(1);
  return fila ?? null;
}

/** Perfil de docente de la cuenta, o null si todavía no eligió categoría. */
export async function docenteDeUsuario(usuarioId: string): Promise<Docente | null> {
  const [fila] = await getDb().select().from(docentes).where(eq(docentes.usuarioId, usuarioId)).limit(1);
  return fila ?? null;
}

/** Para los pasos de la institución posteriores al 2: exige tener la institución creada. */
export async function institucionEnAlta() {
  const usuario = await usuarioParaAlta("institucion");
  const institucion = await institucionPropia(usuario.id);
  if (!institucion) redirect("/onboarding/institucion/2");
  // Suspendida o dada de baja: no sigue con el alta (editaría su perfil público por fuera de `requerirInstitucion`).
  if ((institucion.suspendida || institucion.bajaEn) && usuario.rol !== "admin") redirect("/cuenta-suspendida");
  return { usuario, institucion };
}

/**
 * Para los pasos del docente posteriores a "¿Qué sos?": exige tener el perfil creado y el alta sin
 * terminar (quien ya la terminó edita su perfil desde /docente/perfil, no repite el alta).
 */
export async function docenteEnAlta() {
  const usuario = await usuarioParaAlta("docente");
  const docente = await docenteDeUsuario(usuario.id);
  if (!docente) redirect("/onboarding/docente/categoria");
  if (docente.onboardingCompleto) redirect(RUTA_INICIO.docente);
  return { usuario, docente };
}
