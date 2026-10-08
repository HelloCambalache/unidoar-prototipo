import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { urlApp } from "@/db/conexion";
import { modoCorreo, type ModoCorreo } from "@/lib/correo/config";
import { supabaseClavePublica, supabaseUrl } from "@/lib/supabase/env";

/*
 * Chequeo de salud para /api/salud. Es público, así que nunca devuelve valores de variables ni
 * hosts ni mensajes crudos: solo si cada variable está presente, qué tipo de conexión es la
 * configurada y un código de error clasificado.
 */

export type TipoConexion = "pooler-sesion" | "pooler-transacciones" | "directa" | "otra" | "ausente";

export type Salud = {
  ok: boolean;
  variables: Record<string, boolean>;
  /** Tareas programadas (Vercel Cron): si falta el secreto, el cron recibe 401 y no hace nada. No cuenta para `ok`. */
  tareasProgramadas: { CRON_SECRET: boolean };
  /** Cómo salen los mails de la app: resend (envío real), consola (solo pruebas) o apagado (no se manda ni se anota nada). No cuenta para `ok`. */
  correo: ModoCorreo;
  baseDeDatos: {
    conecta: boolean;
    conexion: TipoConexion;
    /** Código del error (p. ej. ENOTFOUND, 28P01); ausente si conectó. */
    codigo?: string;
    /** Qué suele significar ese error y qué revisar. */
    causa?: string;
  };
};

const presente = (v: string | undefined) => Boolean(v && v.trim());

/** Forma de la conexión configurada, sin revelar host, usuario ni contraseña. */
export function tipoDeConexion(url: string | undefined): TipoConexion {
  if (!url) return "ausente";
  try {
    const u = new URL(url);
    if (u.hostname.endsWith(".pooler.supabase.com")) return u.port === "6543" ? "pooler-transacciones" : "pooler-sesion";
    if (/^db\..+\.supabase\.co$/.test(u.hostname)) return "directa";
    return "otra";
  } catch {
    return "otra";
  }
}

const CAUSAS: Record<string, string> = {
  ENOTFOUND: "El host no existe o no resuelve. Si la conexión es la directa (db.<ref>.supabase.co) no sirve en Vercel (solo IPv6): usar el pooler de sesión.",
  ENETUNREACH: "No hay ruta al host. La conexión directa de Supabase es solo IPv6 y Vercel es IPv4: usar el pooler de sesión (puerto 5432).",
  ECONNREFUSED: "El host rechazó la conexión: revisar el puerto (5432 para el pooler de sesión).",
  ETIMEDOUT: "La conexión no llegó a destino a tiempo: revisar host y puerto.",
  CONNECT_TIMEOUT: "La conexión no llegó a destino a tiempo: revisar host y puerto.",
  CONNECTION_CLOSED: "El servidor cerró la conexión: revisar usuario y contraseña, y que no haya espacios o comillas en el valor.",
  CONNECTION_ENDED: "La conexión se cortó antes de terminar.",
  "28P01": "Contraseña rechazada: revisar la contraseña de la base (si tiene caracteres especiales, va codificada en la URL).",
  "28000": "Usuario o contraseña rechazados por el servidor.",
  XX000: "El pooler no encontró el proyecto o el usuario: el usuario debe ser postgres.<ref-del-proyecto> y la región del host la correcta.",
  "3D000": "La base indicada en la URL no existe (debería ser /postgres).",
  "42P01": "La conexión funciona pero faltan tablas: correr pnpm db:setup contra esta base.",
};

/** El error de Drizzle envuelve al de postgres-js en `cause`; el código está en el interior. */
function codigoDe(err: unknown): string | undefined {
  let e: unknown = err;
  for (let i = 0; i < 3 && e; i++) {
    const c = (e as { code?: unknown }).code;
    if (typeof c === "string" && c) return c;
    e = (e as { cause?: unknown }).cause;
  }
  return undefined;
}

export function clasificarErrorDeBase(err: unknown) {
  const codigo = codigoDe(err) ?? (err instanceof Error && err.message === "timeout" ? "TIMEOUT" : "DESCONOCIDO");
  const causa =
    CAUSAS[codigo] ??
    (codigo === "TIMEOUT" ? "La base no respondió en 8 segundos." : "Error no clasificado: ver los logs de Vercel (Runtime Logs).");
  return { codigo, causa };
}

export async function revisarSalud(): Promise<Salud> {
  const url = urlApp();
  const variables = {
    NEXT_PUBLIC_SUPABASE_URL: presente(supabaseUrl()),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: presente(supabaseClavePublica()),
    SUPABASE_SERVICE_ROLE_KEY: presente(process.env.SUPABASE_SERVICE_ROLE_KEY),
    DATABASE_URL: presente(process.env.DATABASE_URL),
  };
  const tareasProgramadas = { CRON_SECRET: presente(process.env.CRON_SECRET) };
  const correo = modoCorreo();
  const conexion = tipoDeConexion(url);

  if (!url) {
    return {
      ok: false,
      variables,
      tareasProgramadas,
      correo,
      baseDeDatos: { conecta: false, conexion, codigo: "SIN_URL", causa: "No hay DATABASE_URL (ni POSTGRES_URL) en este entorno: cargarla en Vercel para Production y redeployar." },
    };
  }

  try {
    await Promise.race([
      getDb().execute(sql`select 1`),
      new Promise<never>((_, rechazar) => setTimeout(() => rechazar(new Error("timeout")), 8000)),
    ]);
  } catch (err) {
    return { ok: false, variables, tareasProgramadas, correo, baseDeDatos: { conecta: false, conexion, ...clasificarErrorDeBase(err) } };
  }

  const ok = Object.values(variables).every(Boolean);
  return { ok, variables, tareasProgramadas, correo, baseDeDatos: { conecta: true, conexion } };
}
