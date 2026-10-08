import "server-only";
import { cache } from "react";
import { crearClienteServidor } from "@/lib/supabase/server";
import { supabaseConfigurado } from "@/lib/supabase/env";
import { ROLES_ALTA, type RolAlta } from "@/lib/onboarding";
import { decodificarAceptacion, type AceptacionDeTerminos } from "@/lib/terminos";

export type DatosDeSesion = {
  id: string;
  email: string | null;
  /** Nombre que dejó al registrarse (formulario) o que informa Google. */
  nombre: string | null;
  fotoUrl: string | null;
  /** Rol elegido al registrarse: solo una pista; la fuente de verdad es `usuarios.rol`. */
  rolPista: RolAlta | null;
  /** Constancia de aceptación de los términos que dejó el registro con email del docente (en `user_metadata`). */
  terminos: AceptacionDeTerminos | null;
};

const texto = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

/**
 * Lo que dice la sesión de Supabase sobre la cuenta (claims del JWT: sin consultar la base ni el servidor de Auth).
 * Para saber solo si hay sesión y de quién, usar `sesionActual()` de src/lib/auth.ts.
 */
export const datosDeSesion = cache(async (): Promise<DatosDeSesion | null> => {
  if (!supabaseConfigurado()) return null;
  const supabase = await crearClienteServidor();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;

  const meta = (claims.user_metadata ?? {}) as Record<string, unknown>;
  const rol = texto(meta.rol);
  return {
    id: claims.sub,
    email: texto(claims.email),
    nombre: texto(meta.nombre) ?? texto(meta.full_name) ?? texto(meta.name),
    fotoUrl: texto(meta.avatar_url) ?? texto(meta.picture),
    rolPista: (ROLES_ALTA as readonly string[]).includes(rol ?? "") ? (rol as RolAlta) : null,
    terminos: decodificarAceptacion(meta.terminos),
  };
});
