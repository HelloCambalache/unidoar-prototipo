import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  docentes,
  institucionMiembros,
  instituciones,
  usuarios,
  type Docente,
  type Institucion,
  type RolUsuario,
  type Usuario,
} from "@/db/schema";
import { RUTA_INICIO } from "@/lib/catalogo";
import { rutaPasoPendienteDocente } from "@/lib/onboarding";
import { sincronizarEmailDeCuenta } from "@/lib/queries/email-cuenta";
import { datosDeSesion } from "@/lib/sesion";
import { COOKIE_TERMINOS, EDAD_MAXIMA_COOKIE_MS, decodificarAceptacion } from "@/lib/terminos";
import { crearClienteServidor } from "@/lib/supabase/server";
import { supabaseConfigurado } from "@/lib/supabase/env";

/**
 * Identidad de la sesión de Supabase (id de auth.users y email), sin tocar la base propia.
 * Valida el JWT de la cookie (getClaims) en vez de preguntarle al servidor de Auth en cada render.
 * Devuelve null si no hay sesión o si Supabase todavía no está configurado.
 */
export const sesionActual = cache(async (): Promise<{ id: string; email: string | null } | null> => {
  if (!supabaseConfigurado()) return null;
  const supabase = await crearClienteServidor();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  return { id: claims.sub, email: typeof claims.email === "string" ? claims.email : null };
});

/** Usuario de la base ligado a la sesión de Supabase, o null si no inició sesión / no terminó el alta. */
export const usuarioActual = cache(async (): Promise<Usuario | null> => {
  const sesion = await sesionActual();
  if (!sesion) return null;
  const [fila] = await getDb().select().from(usuarios).where(eq(usuarios.id, sesion.id)).limit(1);
  if (!fila) return null;
  // Si la persona cambió su email y lo confirmó, la sesión ya trae el nuevo: la fila local se pone al día.
  if (sesion.email && sesion.email.toLowerCase() !== fila.email.toLowerCase()) {
    return (await sincronizarEmailDeCuenta(fila, sesion.email)) ?? fila;
  }
  return fila;
});

/**
 * Exige sesión y, opcionalmente, un rol. Sin sesión → /ingresar; con sesión pero sin alta → /registro;
 * con otro rol → a su propio inicio. Los admin pasan siempre.
 */
export async function requerirUsuario(rol?: RolUsuario): Promise<Usuario> {
  const sesion = await sesionActual();
  if (!sesion) redirect("/ingresar");
  const usuario = await usuarioActual();
  if (!usuario) redirect("/registro");
  if (rol && usuario.rol !== rol && usuario.rol !== "admin") redirect(RUTA_INICIO[usuario.rol]);
  return usuario;
}

/** Crea (o recupera) la fila local de la cuenta de Supabase, fijando el rol la primera vez. */
export async function asegurarUsuario(rol: Exclude<RolUsuario, "admin">): Promise<Usuario> {
  const sesion = await sesionActual();
  if (!sesion) redirect("/ingresar");
  const existente = await usuarioActual();
  if (existente) return existente;

  if (!sesion.email) throw new Error("La cuenta no tiene un email verificado.");

  // Si la persona aceptó los términos al registrarse, queda la constancia: viaja en los datos de la sesión (registro con
  // email) o en una cookie de corta vida (registro con Google, que no puede llevar datos propios).
  const aceptacion =
    (await datosDeSesion())?.terminos ??
    decodificarAceptacion((await cookies()).get(COOKIE_TERMINOS)?.value, { edadMaximaMs: EDAD_MAXIMA_COOKIE_MS });

  const [creado] = await getDb()
    .insert(usuarios)
    .values({
      id: sesion.id,
      email: sesion.email,
      rol,
      ...(aceptacion ? { terminosAceptadosEn: aceptacion.en, terminosVersion: aceptacion.version } : {}),
    })
    .onConflictDoNothing()
    .returning();
  if (creado) {
    // La constancia ya quedó en la fila: la cookie no hace falta más. Solo se puede borrar desde una acción; en una página falla y
    // queda hasta que vence (una hora), por eso `ingresarConGoogle` también la borra al empezar un ingreso sin términos.
    try {
      (await cookies()).delete(COOKIE_TERMINOS);
    } catch {
      // Estamos en una página: no se puede modificar la cookie desde acá.
    }
    return creado;
  }
  const [fila] = await getDb().select().from(usuarios).where(eq(usuarios.id, sesion.id)).limit(1);
  return fila!;
}

/** Institución de la sesión: la que posee, a la que pertenece como miembro activo o a la que la invitaron con su email. */
export const institucionActual = cache(async (): Promise<Institucion | null> => {
  const usuario = await usuarioActual();
  if (!usuario) return null;
  const db = getDb();
  const [propia] = await db.select().from(instituciones).where(eq(instituciones.propietarioId, usuario.id)).limit(1);
  if (propia) return propia;
  const [membresia] = await db
    .select({ institucion: instituciones })
    .from(institucionMiembros)
    .innerJoin(instituciones, eq(instituciones.id, institucionMiembros.institucionId))
    .where(and(eq(institucionMiembros.usuarioId, usuario.id), eq(institucionMiembros.estado, "activo")))
    .limit(1);
  // Una invitación pendiente no suma a nadie sola: la persona la acepta (o la rechaza) en el paso 2 del alta.
  return membresia?.institucion ?? null;
});

/** Perfil de docente de la sesión. */
export const docenteActual = cache(async (): Promise<Docente | null> => {
  const usuario = await usuarioActual();
  if (!usuario) return null;
  const [fila] = await getDb().select().from(docentes).where(eq(docentes.usuarioId, usuario.id)).limit(1);
  return fila ?? null;
});

/** Para páginas de institución: exige rol y que haya terminado el alta de su institución. */
export async function requerirInstitucion() {
  const usuario = await requerirUsuario("institucion");
  const institucion = await institucionActual();
  if (!institucion) redirect("/onboarding/institucion/2");
  if (institucion.suspendida && usuario.rol !== "admin") redirect("/cuenta-suspendida");
  return { usuario, institucion };
}

/** Para páginas de docente: exige rol y que exista su perfil. */
export async function requerirDocente() {
  const usuario = await requerirUsuario("docente");
  const docente = await docenteActual();
  if (!docente) redirect("/onboarding/docente/categoria");
  if (docente.suspendido && usuario.rol !== "admin") redirect("/cuenta-suspendida");
  if (!docente.onboardingCompleto) redirect(rutaPasoPendienteDocente(docente));
  return { usuario, docente };
}
