import type { RolAlta } from "@/lib/onboarding";

/*
 * Lo común de las pantallas de acceso (registro, ingreso, recuperación): tipos de estado,
 * validación de destinos y traducción de los errores de Supabase Auth. Sin dependencias de servidor.
 */

/** Primer paso con sesión de cada alta: ahí se crea la fila `usuarios` (`asegurarUsuario(rol)`). */
export const PRIMER_PASO_PROTEGIDO: Record<RolAlta, string> = {
  institucion: "/onboarding/institucion/2",
  docente: "/onboarding/docente/categoria",
};

export type EstadoAuth =
  | {
      ok: false;
      error: string;
      /** Código de Supabase Auth, para que la UI ofrezca una salida (ej. reenviar el mail de confirmación). */
      codigo?: string;
      campos?: Record<string, string>;
      valores?: Record<string, string>;
    }
  | {
      ok: true;
      /** Se registró pero falta confirmar el mail: la UI muestra "Revisá tu mail". */
      confirmarEmail?: string;
      mensaje?: string;
    }
  | null;

/**
 * Acepta solo rutas internas ("/algo"): nunca URLs externas ni protocol-relative ("//sitio.com"),
 * así un `?next=` armado por un tercero no puede mandar a la persona a otro dominio.
 */
export function rutaInternaSegura(destino: string | null | undefined, porDefecto = "/inicio") {
  if (typeof destino !== "string" || !destino.startsWith("/") || destino.startsWith("//")) return porDefecto;
  if (destino.includes("\\") || /[\u0000-\u001f]/.test(destino)) return porDefecto;
  try {
    const url = new URL(destino, "http://interno.invalid");
    if (url.origin !== "http://interno.invalid") return porDefecto;
    const resultado = url.pathname + url.search + url.hash;
    // Normalizar puede dejar al principio un "//" que antes no estaba ("/..//sitio.com" → "//sitio.com"): sería otro dominio.
    return resultado.startsWith("//") ? porDefecto : resultado;
  } catch {
    return porDefecto;
  }
}

const MENSAJES_POR_CODIGO: Record<string, string> = {
  invalid_credentials: "El email o la contraseña no son correctos.",
  email_not_confirmed: "Todavía no confirmaste tu email. Revisá tu bandeja de entrada (y la carpeta de spam).",
  user_already_exists: "Ya hay una cuenta con ese email. Ingresá o recuperá tu contraseña.",
  email_exists: "Ya hay una cuenta con ese email. Ingresá o recuperá tu contraseña.",
  weak_password: "La contraseña es muy fácil de adivinar. Usá al menos 8 caracteres y combiná letras y números.",
  over_email_send_rate_limit: "Mandamos demasiados mails en poco tiempo. Esperá unos minutos y probá de nuevo.",
  over_request_rate_limit: "Hiciste demasiados intentos. Esperá unos minutos y probá de nuevo.",
  over_sms_send_rate_limit: "Hiciste demasiados intentos. Esperá unos minutos y probá de nuevo.",
  signup_disabled: "El registro está pausado por el momento.",
  email_address_invalid: "Revisá el email: no parece válido.",
  validation_failed: "Revisá los datos: algo no tiene el formato esperado.",
  same_password: "La nueva contraseña tiene que ser distinta de la anterior.",
  otp_expired: "El enlace venció o ya se usó. Pedí uno nuevo.",
  flow_state_expired: "El enlace venció o ya se usó. Pedí uno nuevo.",
  flow_state_not_found: "El enlace venció o ya se usó. Pedí uno nuevo.",
  bad_code_verifier: "Abrí el enlace desde el mismo navegador donde lo pediste, o pedí uno nuevo.",
  provider_disabled: "El ingreso con Google todavía no está disponible.",
  oauth_provider_not_supported: "El ingreso con Google todavía no está disponible.",
  session_not_found: "Tu sesión venció. Volvé a ingresar.",
  user_banned: "Esta cuenta está suspendida. Escribinos desde la página de contacto.",
};

/** Supabase no pudo entregar el mail al SMTP (clave, remitente o dominio mal configurados, o el proveedor caído). Llega como un 500 "unexpected_failure". */
const MENSAJE_FALLA_DE_MAIL = "No pudimos mandarte el mail en este momento. Probá de nuevo en unos minutos; si sigue pasando, escribinos desde la página de Contacto.";
const FALLA_DE_MAIL = /error sending .*email/i;

const MENSAJES_POR_TEXTO: [RegExp, string][] = [
  [FALLA_DE_MAIL, MENSAJE_FALLA_DE_MAIL],
  [/invalid login credentials/i, MENSAJES_POR_CODIGO.invalid_credentials!],
  [/email not confirmed/i, MENSAJES_POR_CODIGO.email_not_confirmed!],
  [/already (been )?registered|already exists/i, MENSAJES_POR_CODIGO.user_already_exists!],
  [/rate limit|too many requests|security purposes/i, MENSAJES_POR_CODIGO.over_request_rate_limit!],
  [/password should be|weak password/i, MENSAJES_POR_CODIGO.weak_password!],
  [/same password|different from the old/i, MENSAJES_POR_CODIGO.same_password!],
  [/session missing|session not found/i, MENSAJES_POR_CODIGO.session_not_found!],
];

/** ¿El error es que Supabase no pudo mandar el mail ("Error sending confirmation email", "…recovery email", etc.)? */
export function esFallaDeEnvioDeMail(error: { message?: string; code?: string } | null | undefined) {
  return FALLA_DE_MAIL.test(error?.message ?? "");
}

/**
 * Deja en el log del servidor una falla de envío de mail de Supabase, con la pista de dónde mirar. La persona ve un
 * mensaje claro (o ninguno, en la recuperación de contraseña, que no revela si el email existe); sin esto el motivo
 * real se perdería y el detalle del SMTP solo está en los logs de Auth de Supabase.
 */
export function registrarFallaDeMail(error: { message?: string; code?: string } | null | undefined, paso: string) {
  if (!esFallaDeEnvioDeMail(error)) return;
  console.error("Supabase Auth no pudo mandar un mail: revisar el SMTP (Authentication → Emails) y los logs de Auth", {
    paso,
    codigo: error?.code,
    mensaje: error?.message,
  });
}

/** Convierte un error de Supabase Auth en un mensaje claro en español. */
export function traducirErrorAuth(error: { message?: string; code?: string } | null | undefined) {
  const porCodigo = error?.code ? MENSAJES_POR_CODIGO[error.code] : undefined;
  if (porCodigo) return porCodigo;
  const mensaje = error?.message ?? "";
  const porTexto = MENSAJES_POR_TEXTO.find(([patron]) => patron.test(mensaje));
  return porTexto?.[1] ?? "No pudimos completar la operación. Probá de nuevo en un rato.";
}

/**
 * ¿Google figura como activado en la respuesta pública de Supabase (`/auth/v1/settings`)? Cualquier otra forma
 * de respuesta cuenta como "no": es mejor ocultar el botón que mostrar uno que falla.
 */
export function googleActivadoEn(settings: unknown): boolean {
  if (typeof settings !== "object" || settings === null) return false;
  const externos = (settings as { external?: unknown }).external;
  if (typeof externos !== "object" || externos === null) return false;
  return (externos as { google?: unknown }).google === true;
}

/** Mensajes de ?error= que deja /auth/callback en /ingresar. */
export const ERRORES_DE_INGRESO: Record<string, string> = {
  enlace: "El enlace venció o ya se usó. Ingresá con tu email y contraseña, o pedí uno nuevo.",
  oauth: "No pudimos completar el ingreso con Google. Probá de nuevo.",
};
