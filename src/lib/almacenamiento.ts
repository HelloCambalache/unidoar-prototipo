import "server-only";
import { clienteAdmin } from "@/lib/supabase/admin";
import { supabaseUrl } from "@/lib/supabase/env";

/** ¿Hay lo necesario para subir y leer archivos? (URL de Supabase + clave de servicio). */
export function almacenamientoConfigurado() {
  return Boolean(supabaseUrl() && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/**
 * URL firmada (temporal) de un archivo del bucket `privado`: CV, DNI, certificados.
 * Los paths se guardan en la base; la URL se genera recién al mostrarlos. Devuelve null si
 * no hay almacenamiento configurado o el archivo ya no existe.
 */
export async function urlFirmada(path: string | null | undefined, segundos = 3600) {
  if (!path || !almacenamientoConfigurado()) return null;
  const { data, error } = await clienteAdmin().storage.from("privado").createSignedUrl(path, segundos);
  return error ? null : data.signedUrl;
}
