import type { RolUsuario } from "@/db/schema";
import type { RolAlta } from "@/lib/onboarding";

/*
 * Quién puede hacer cada alta. Puro (sin base ni Next) para poder probarlo; lo usa `usuarioParaAlta` (src/lib/alta.ts).
 */

/** Adonde va una cuenta del equipo que intenta crear un perfil de profesional (página con la explicación). */
export const RUTA_CUENTA_DEL_EQUIPO = "/cuenta-del-equipo";

/**
 * ¿Esta cuenta puede hacer el alta de este rol? La del mismo rol, sí. Una cuenta del equipo (admin) entra a todo MENOS a crear un
 * perfil de profesional: ese perfil saldría en el catálogo que ven las instituciones y su baja no se podría procesar (la baja no
 * alcanza a una cuenta del equipo), con lo que quedaría un perfil de prueba colgado para siempre. El equipo prueba la app como
 * profesional con una cuenta aparte, con otro email.
 */
export function puedeHacerElAlta(rolDelAlta: RolAlta, rolDeLaCuenta: RolUsuario): boolean {
  if (rolDeLaCuenta === rolDelAlta) return true;
  return rolDeLaCuenta === "admin" && rolDelAlta !== "docente";
}

/** A dónde manda el alta a quien no puede hacerla: el equipo, a la explicación; el resto, a su propio inicio. */
export function destinoSiNoPuedeHacerElAlta(rolDeLaCuenta: RolUsuario, rutaDeInicio: Record<RolUsuario, string>): string {
  return rolDeLaCuenta === "admin" ? RUTA_CUENTA_DEL_EQUIPO : rutaDeInicio[rolDeLaCuenta];
}
