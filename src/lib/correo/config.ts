/*
 * Configuración de los mails de la app (los que manda nuestro código; los de Auth los manda Supabase con su propio SMTP).
 * Todo sale de variables de entorno y nada se evalúa al importar, para poder probarlo con un `env` armado a mano.
 *
 *   RESEND_API_KEY                  clave de Resend. Sin ella (y sin CORREO_MODO) la app no manda ni anota ningún mail.
 *   CORREO_MODO                     "consola" (solo imprime, para probar) | "apagado". Por defecto: resend si hay clave.
 *   CORREO_DE                       remitente de los mails automáticos. Por defecto "UNIDOAR <no-responder@unidoar.com.ar>".
 *   CORREO_RESPONDER_A              a dónde llegan las respuestas. Por defecto hola@unidoar.com.ar.
 *   CORREO_DE_FACTURACION           remitente de los mails de facturación. Por defecto "UNIDOAR Facturación <facturacion@…>".
 *   CORREO_RESPONDER_A_FACTURACION  respuestas de facturación. Por defecto facturacion@unidoar.com.ar.
 *   CORREO_EQUIPO                   destinatarios de los avisos internos (separados por coma). Sin esto, los admins.
 *   CORREO_AVISAR_DESCARTES         "si": también se le manda mail al docente al que se descarta (M28). Por defecto no.
 *   CORREO_SECRETO                  clave para firmar los enlaces de baja de avisos. Por defecto, la clave de servicio de Supabase.
 *   NEXT_PUBLIC_SITE_URL            origen de los enlaces de los mails (cuando cambie el dominio, cambiar esto y redeployar).
 */

export type ModoCorreo = "resend" | "consola" | "apagado";
export type Remitente = "app" | "facturacion";

type Entorno = Record<string, string | undefined>;

const valor = (env: Entorno, nombre: string) => env[nombre]?.trim() || undefined;

/** Cómo salen los mails. "apagado": no se anota ni se manda nada (así no se acumula una cola que nadie va a despachar). */
export function modoCorreo(env: Entorno = process.env): ModoCorreo {
  const pedido = valor(env, "CORREO_MODO")?.toLowerCase();
  if (pedido === "consola") return "consola";
  if (pedido === "apagado") return "apagado";
  return valor(env, "RESEND_API_KEY") ? "resend" : "apagado";
}

export function claveDeResend(env: Entorno = process.env) {
  return valor(env, "RESEND_API_KEY");
}

export function remitenteDe(tipo: Remitente, env: Entorno = process.env): { de: string; responderA: string } {
  if (tipo === "facturacion") {
    return {
      de: valor(env, "CORREO_DE_FACTURACION") ?? "UNIDOAR Facturación <facturacion@unidoar.com.ar>",
      responderA: valor(env, "CORREO_RESPONDER_A_FACTURACION") ?? "facturacion@unidoar.com.ar",
    };
  }
  return {
    de: valor(env, "CORREO_DE") ?? "UNIDOAR <no-responder@unidoar.com.ar>",
    responderA: valor(env, "CORREO_RESPONDER_A") ?? "hola@unidoar.com.ar",
  };
}

/** Los emails fijos del equipo para los avisos internos; vacío = usar los de las cuentas admin. */
export function destinatariosDelEquipo(env: Entorno = process.env): string[] {
  const lista = valor(env, "CORREO_EQUIPO");
  if (!lista) return [];
  return [...new Set(lista.split(/[,;\s]+/).map((e) => e.trim().toLowerCase()).filter((e) => e.includes("@")))];
}

export function avisarDescartesPorCorreo(env: Entorno = process.env) {
  return valor(env, "CORREO_AVISAR_DESCARTES")?.toLowerCase() === "si";
}

/** Origen (sin barra final) de los enlaces de los mails. */
export function origenDeLosMails(env: Entorno = process.env): string {
  const configurado = valor(env, "NEXT_PUBLIC_SITE_URL");
  if (configurado) return configurado.replace(/\/+$/, "");
  const produccion = valor(env, "VERCEL_PROJECT_PRODUCTION_URL");
  if (produccion) return `https://${produccion.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;
  return "http://localhost:3000";
}
