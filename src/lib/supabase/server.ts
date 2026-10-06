import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { requerirSupabase } from "./env";

/**
 * Cliente de Supabase para Server Components, server actions y route handlers.
 * Lee y escribe la sesión en las cookies de la request.
 */
export async function crearClienteServidor() {
  const { url, clave } = requerirSupabase();
  const almacen = await cookies();

  return createServerClient(url, clave, {
    cookies: {
      getAll: () => almacen.getAll(),
      setAll: (lista) => {
        try {
          for (const { name, value, options } of lista) almacen.set(name, value, options);
        } catch {
          // Desde un Server Component no se pueden escribir cookies; no pasa nada,
          // el proxy (src/proxy.ts) ya refresca la sesión en cada request.
        }
      },
    },
  });
}
