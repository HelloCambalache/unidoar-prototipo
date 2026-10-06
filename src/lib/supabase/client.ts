import { createBrowserClient } from "@supabase/ssr";
import { requerirSupabase } from "./env";

/** Cliente de Supabase para Client Components (la sesión vive en cookies, compartidas con el servidor). */
export function crearClienteNavegador() {
  const { url, clave } = requerirSupabase();
  return createBrowserClient(url, clave);
}
