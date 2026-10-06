import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseUrl } from "./env";

/**
 * Cliente con la clave de servicio: saltea RLS y puede administrar Storage y usuarios.
 * Solo en servidor, nunca exponerlo al navegador ni devolver su resultado sin filtrar.
 */
export function clienteAdmin() {
  const url = supabaseUrl();
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !clave) {
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.");
  }
  return createClient(url, clave, { auth: { persistSession: false, autoRefreshToken: false } });
}
