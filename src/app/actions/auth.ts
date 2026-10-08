"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { sesionActual } from "@/lib/auth";
import { PRIMER_PASO_PROTEGIDO, rutaInternaSegura, traducirErrorAuth, type EstadoAuth } from "@/lib/acceso";
import { ROLES_ALTA, type RolAlta } from "@/lib/onboarding";
import { origenSitio, urlDeCallback } from "@/lib/sitio";
import { crearClienteServidor } from "@/lib/supabase/server";
import { COOKIE_TERMINOS, VIDA_COOKIE_TERMINOS_SEGUNDOS, codificarAceptacion } from "@/lib/terminos";
import { supabaseConfigurado } from "@/lib/supabase/env";

/*
 * Acceso con Supabase Auth: registro, ingreso (email + contraseña o Google), recuperación y salida.
 * Las acciones que alimentan un formulario con `useActionState` reciben (estadoPrevio, formData);
 * las que se atan a un rol (`registrarse`, `ingresarConGoogle`) reciben el rol como primer argumento.
 */

const SIN_CONFIGURAR = "El acceso con cuenta todavía no está configurado. Probá de nuevo más tarde.";

const emailCampo = z.string().trim().toLowerCase().pipe(z.email("Revisá el email: no parece válido"));
const passwordCampo = z.string().min(8, "Usá al menos 8 caracteres").max(72, "Usá hasta 72 caracteres");

const texto = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");

function errores(error: z.ZodError) {
  const campos: Record<string, string> = {};
  for (const issue of error.issues) campos[String(issue.path[0] ?? "_")] ??= issue.message;
  return campos;
}

/* ───────────────────────── Registro ───────────────────────── */

/**
 * Crea la cuenta con email + contraseña. Si Supabase pide confirmar el mail, devuelve
 * `{ ok: true, confirmarEmail }` (la UI muestra "Revisá tu mail"); si ya hay sesión, sigue al
 * primer paso protegido del alta. El rol viaja en `user_metadata.rol` solo como pista.
 */
export async function registrarse(rol: RolAlta, _previo: EstadoAuth, formData: FormData): Promise<EstadoAuth> {
  const rolValido = z.enum(ROLES_ALTA).safeParse(rol);
  if (!rolValido.success) return { ok: false, error: "Elegí si sos institución o docente." };
  if (!supabaseConfigurado()) return { ok: false, error: SIN_CONFIGURAR };

  const valores = { email: texto(formData.get("email")).trim(), nombre: texto(formData.get("nombre")).trim() };
  const esquema = z
    .object({
      email: emailCampo,
      password: passwordCampo,
      confirmacion: z.string(),
      nombre: z.string().trim().max(120),
      aceptaTerminos: z.string().optional(),
    })
    .refine((v) => v.password === v.confirmacion, { path: ["confirmacion"], message: "Las contraseñas no coinciden" });
  const r = esquema.safeParse({
    email: texto(formData.get("email")),
    password: texto(formData.get("password")),
    confirmacion: texto(formData.get("confirmacion")),
    nombre: texto(formData.get("nombre")),
    aceptaTerminos: texto(formData.get("aceptaTerminos")),
  });
  const campos = r.success ? {} : errores(r.error);
  if (rolValido.data === "docente") {
    if (r.success && r.data.nombre.length < 2) campos.nombre = "Completá tu nombre";
    if (r.success && r.data.aceptaTerminos !== "on") campos.aceptaTerminos = "Tenés que aceptar los términos y condiciones";
  }
  if (!r.success || Object.keys(campos).length > 0) {
    return { ok: false, error: "Revisá los campos marcados.", campos, valores };
  }

  const supabase = await crearClienteServidor();
  const siguiente = PRIMER_PASO_PROTEGIDO[rolValido.data];
  const { data, error } = await supabase.auth.signUp({
    email: r.data.email,
    password: r.data.password,
    options: {
      emailRedirectTo: urlDeCallback(await origenSitio(), siguiente),
      data: {
        rol: rolValido.data,
        ...(r.data.nombre ? { nombre: r.data.nombre } : {}),
        // El docente acepta los términos en este formulario (la institución, en el paso 2 del alta).
        ...(rolValido.data === "docente" ? { terminos: codificarAceptacion() } : {}),
      },
    },
  });
  if (error) return { ok: false, error: traducirErrorAuth(error), codigo: error.code, valores };

  // Con confirmación de mail activa, Supabase no avisa que el email ya existe: devuelve un usuario sin identidades.
  if (data.user && data.user.identities && data.user.identities.length === 0) {
    return { ok: false, error: traducirErrorAuth({ code: "user_already_exists" }), codigo: "user_already_exists", valores };
  }
  if (!data.session) return { ok: true, confirmarEmail: r.data.email };

  revalidatePath("/", "layout");
  redirect(siguiente);
}

/** Vuelve a mandar el mail de confirmación (Supabase limita la frecuencia: el error ya viene traducido). */
export async function reenviarConfirmacion(
  rol: RolAlta | null,
  email: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!supabaseConfigurado()) return { ok: false, error: SIN_CONFIGURAR };
  const e = emailCampo.safeParse(email);
  if (!e.success) return { ok: false, error: "Revisá el email: no parece válido." };
  const rolValido = z.enum(ROLES_ALTA).nullable().safeParse(rol);
  const siguiente = rolValido.success && rolValido.data ? PRIMER_PASO_PROTEGIDO[rolValido.data] : "/inicio";

  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: e.data,
    options: { emailRedirectTo: urlDeCallback(await origenSitio(), siguiente) },
  });
  return error ? { ok: false, error: traducirErrorAuth(error) } : { ok: true };
}

/* ───────────────────────── Ingreso ───────────────────────── */

export async function ingresar(_previo: EstadoAuth, formData: FormData): Promise<EstadoAuth> {
  if (!supabaseConfigurado()) return { ok: false, error: SIN_CONFIGURAR };

  const valores = { email: texto(formData.get("email")).trim() };
  const r = z
    .object({ email: emailCampo, password: z.string().min(1, "Escribí tu contraseña") })
    .safeParse({ email: texto(formData.get("email")), password: texto(formData.get("password")) });
  if (!r.success) return { ok: false, error: "Revisá los campos marcados.", campos: errores(r.error), valores };

  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.signInWithPassword({ email: r.data.email, password: r.data.password });
  if (error) return { ok: false, error: traducirErrorAuth(error), codigo: error.code, valores };

  revalidatePath("/", "layout");
  redirect(rutaInternaSegura(texto(formData.get("next")), "/inicio"));
}

/**
 * Ingreso o registro con Google. Con `rol` (desde el paso 1 del alta) vuelve al primer paso
 * protegido de ese rol; sin rol (desde /ingresar) vuelve a `next` o a /inicio.
 */
export async function ingresarConGoogle(rol: RolAlta | null, formData: FormData): Promise<EstadoAuth> {
  if (!supabaseConfigurado()) return { ok: false, error: SIN_CONFIGURAR };
  const rolValido = z.enum(ROLES_ALTA).nullable().safeParse(rol);
  if (!rolValido.success) return { ok: false, error: "Elegí si sos institución o docente." };

  if (rolValido.data === "docente" && texto(formData.get("aceptaTerminos")) !== "on") {
    return {
      ok: false,
      error: "Revisá los campos marcados.",
      campos: { aceptaTerminos: "Tenés que aceptar los términos y condiciones" },
    };
  }

  const siguiente = rolValido.data
    ? PRIMER_PASO_PROTEGIDO[rolValido.data]
    : rutaInternaSegura(texto(formData.get("next")), "/inicio");

  const supabase = await crearClienteServidor();
  if (rolValido.data === "docente") {
    // Con Google no se pueden mandar datos propios: la constancia de la casilla viaja en una cookie de corta vida.
    (await cookies()).set(COOKIE_TERMINOS, codificarAceptacion(), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: VIDA_COOKIE_TERMINOS_SEGUNDOS,
    });
  }
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: urlDeCallback(await origenSitio(), siguiente) },
  });
  if (error || !data.url) {
    return { ok: false, error: error ? traducirErrorAuth(error) : "No pudimos iniciar el ingreso con Google.", codigo: error?.code };
  }
  redirect(data.url);
}

export async function salir() {
  if (supabaseConfigurado()) {
    const supabase = await crearClienteServidor();
    await supabase.auth.signOut();
  }
  revalidatePath("/", "layout");
  redirect("/");
}

/* ───────────────────────── Recuperación de contraseña ───────────────────────── */

/**
 * Manda el mail para elegir una contraseña nueva. Responde siempre lo mismo exista o no la cuenta,
 * para que el formulario no sirva para averiguar qué emails están registrados.
 */
export async function recuperarContrasena(_previo: EstadoAuth, formData: FormData): Promise<EstadoAuth> {
  if (!supabaseConfigurado()) return { ok: false, error: SIN_CONFIGURAR };

  const valores = { email: texto(formData.get("email")).trim() };
  const e = emailCampo.safeParse(texto(formData.get("email")));
  if (!e.success) return { ok: false, error: "Revisá los campos marcados.", campos: { email: e.error.issues[0]!.message }, valores };

  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.resetPasswordForEmail(e.data, {
    redirectTo: urlDeCallback(await origenSitio(), "/ingresar/nueva-contrasena"),
  });
  if (error && (error.code === "over_email_send_rate_limit" || error.code === "over_request_rate_limit")) {
    return { ok: false, error: traducirErrorAuth(error), codigo: error.code, valores };
  }
  return {
    ok: true,
    mensaje: "Si hay una cuenta con ese email, te mandamos un enlace para elegir una contraseña nueva. Puede tardar un par de minutos.",
  };
}

/** Paso final de la recuperación: la sesión la dejó /auth/callback al abrir el enlace del mail. */
export async function cambiarContrasena(_previo: EstadoAuth, formData: FormData): Promise<EstadoAuth> {
  if (!supabaseConfigurado()) return { ok: false, error: SIN_CONFIGURAR };

  const r = z
    .object({ password: passwordCampo, confirmacion: z.string() })
    .refine((v) => v.password === v.confirmacion, { path: ["confirmacion"], message: "Las contraseñas no coinciden" })
    .safeParse({ password: texto(formData.get("password")), confirmacion: texto(formData.get("confirmacion")) });
  if (!r.success) return { ok: false, error: "Revisá los campos marcados.", campos: errores(r.error) };

  if (!(await sesionActual())) {
    return { ok: false, error: traducirErrorAuth({ code: "otp_expired" }), codigo: "otp_expired" };
  }

  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.updateUser({ password: r.data.password });
  if (error) return { ok: false, error: traducirErrorAuth(error), codigo: error.code };

  revalidatePath("/", "layout");
  redirect("/inicio");
}
