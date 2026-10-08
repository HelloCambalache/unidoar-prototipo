import "server-only";
import { googleActivadoEn } from "@/lib/acceso";
import { supabaseClavePublica, supabaseUrl } from "@/lib/supabase/env";

/**
 * ¿Está activado el ingreso con Google en Supabase? Se lee de `/auth/v1/settings` (público, el mismo que usa el
 * navegador) y se guarda 5 minutos, así el botón "Continuar con Google" aparece solo cuando alguien activa el
 * proveedor en el panel, sin otra variable que cambiar. Ante cualquier falla se asume que no está activado.
 */
export async function googleHabilitado(): Promise<boolean> {
  const url = supabaseUrl();
  const clave = supabaseClavePublica();
  if (!url || !clave) return false;
  try {
    const respuesta = await fetch(`${url.replace(/\/$/, "")}/auth/v1/settings`, {
      headers: { apikey: clave },
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(3000),
    });
    return respuesta.ok && googleActivadoEn(await respuesta.json());
  } catch {
    return false;
  }
}
