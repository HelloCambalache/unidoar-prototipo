"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { sesionActual } from "@/lib/auth";
import {
  PRIMER_PASO_PROTEGIDO,
  destinoTrasConfirmar,
  esTipoDeConfirmacion,
  registrarFallaDeMail,
  rutaInternaSegura,
  traducirErrorAuth,
  type EstadoAuth,
} from "@/lib/acceso";
import { ROLES_ALTA, type RolAlta } from "@/lib/onboarding";
import { origenSitio, urlDeCallback } from "@/lib/sitio";
import { crearClienteServidor } from "@/lib/supabase/server";
import { COOKIE_RECUPERACION, VIDA_RECUPERACION_SEGUNDOS } from "@/lib/recuperacion";
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
  if (!rolValido.success) return { ok: false, error: "Elegí si sos institución o profesional." };
  if (!supabaseConfigurado()) return { ok: false, error: SIN_CONFIGURAR };

  const valores = {
    email: texto(formData.get("email")).trim(),
    nombre: texto(formData.get("nombre")).trim(),
    apellido: texto(formData.get("apellido")).trim(),
  };
  const esquema = z
    .object({
      email: emailCampo,
      password: passwordCampo,
      confirmacion: z.string(),
      nombre: z.string().trim().max(80),
      apellido: z.string().trim().max(80),
      aceptaTerminos: z.string().optional(),
    })
    .refine((v) => v.password === v.confirmacion, { path: ["confirmacion"], message: "Las contraseñas no coinciden" });
  const r = esquema.safeParse({
    email: texto(formData.get("email")),
    password: texto(formData.get("password")),
    confirmacion: texto(formData.get("confirmacion")),
    nombre: texto(formData.get("nombre")),
    apellido: texto(formData.get("apellido")),
    aceptaTerminos: texto(formData.get("aceptaTerminos")),
  });
  const campos = r.success ? {} : errores(r.error);
  if (rolValido.data === "docente" && r.success) {
    // El nombre y el apellido se piden por separado: el apellido no se adivina, y queda fijo cuando se verifica el DNI.
    if (r.data.nombre.length < 2) campos.nombre = "Completá tu nombre";
    if (r.data.apellido.length < 2) campos.apellido = "Completá tu apellido";
  }
  // Todos aceptan los términos acá, al crear la cuenta (el profesional, la institución y quien llega por una invitación al
  // equipo): así no existe una cuenta sin su constancia.
  if (r.success && r.data.aceptaTerminos !== "on") campos.aceptaTerminos = "Tenés que aceptar los términos y condiciones";
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
        ...(rolValido.data === "docente" && r.data.apellido ? { apellido: r.data.apellido } : {}),
        terminos: codificarAceptacion(),
      },
    },
  });
  registrarFallaDeMail(error, "registro");
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
  registrarFallaDeMail(error, "reenviar-confirmacion");
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
  if (!rolValido.success) return { ok: false, error: "Elegí si sos institución o profesional." };

  // Desde el alta (con rol) hay que aceptar los términos, sea profesional o institución; desde /ingresar (sin rol) no: ya tienen cuenta.
  if (rolValido.data && texto(formData.get("aceptaTerminos")) !== "on") {
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
  if (rolValido.data) {
    // Con Google no se pueden mandar datos propios: la constancia de la casilla viaja en una cookie de corta vida.
    (await cookies()).set(COOKIE_TERMINOS, codificarAceptacion(), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: VIDA_COOKIE_TERMINOS_SEGUNDOS,
    });
  } else {
    // Desde "Ingresar" nadie aceptó nada en este paso: si quedó una constancia de otra persona en este navegador (alguien que aceptó los
    // términos, empezó con Google y no terminó), no puede terminar valiéndole a esta cuenta nueva.
    (await cookies()).delete(COOKIE_TERMINOS);
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
  // Si el mail no sale, la persona ve el mismo aviso neutro (no se revela si el email existe) y el motivo queda en el log.
  registrarFallaDeMail(error, "recuperar-contrasena");
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

  // Sin la contraseña actual solo se puede si se llegó por el enlace del mail de recuperación (deja una cookie de unos minutos).
  const jar = await cookies();
  if (!(await sesionActual()) || !jar.has(COOKIE_RECUPERACION)) {
    return { ok: false, error: traducirErrorAuth({ code: "otp_expired" }), codigo: "otp_expired" };
  }

  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.updateUser({ password: r.data.password });
  if (error) return { ok: false, error: traducirErrorAuth(error), codigo: error.code };
  jar.delete(COOKIE_RECUPERACION);

  revalidatePath("/", "layout");
  redirect("/inicio");
}

/**
 * Segundo paso del enlace de un mail de confirmación de registro o de recuperación de contraseña (el primero es la página
 * /auth/confirmar, que solo muestra un botón). El token se gasta recién acá, cuando la persona toca el botón: los programas que
 * revisan los enlaces de los mails (antivirus, Outlook "vínculos seguros") abren la dirección pero no aprietan botones, así que ya no
 * consumen el enlace antes que quien lo recibió. El token viaja en un campo oculto y se verifica en el servidor (`verifyOtp`): anda desde
 * cualquier dispositivo y la sesión queda abierta en el que se tocó el botón.
 */
export async function confirmarEnlace(formData: FormData): Promise<void> {
  const tipo = texto(formData.get("type"));
  const tokenHash = texto(formData.get("token_hash"));
  if (!tokenHash || !esTipoDeConfirmacion(tipo) || !supabaseConfigurado()) redirect("/ingresar?error=enlace");

  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.verifyOtp({ type: tipo, token_hash: tokenHash });
  if (error) redirect("/ingresar?error=enlace");

  // Quien llegó por el enlace de recuperación puede elegir la contraseña nueva sin la actual, durante unos minutos.
  if (tipo === "recovery") {
    (await cookies()).set(COOKIE_RECUPERACION, "1", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: VIDA_RECUPERACION_SEGUNDOS,
    });
  }
  revalidatePath("/", "layout");
  redirect(destinoTrasConfirmar(tipo));
}
