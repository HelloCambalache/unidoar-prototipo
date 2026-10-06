import "server-only";
import { cache } from "react";
import { unstable_rethrow } from "next/navigation";
import type { RolUsuario } from "@/db/schema";
import { usuarioActual } from "@/lib/auth";

/** Lo mínimo que necesitan las páginas públicas saber de la sesión. */
export type SesionPublica = { rol: RolUsuario | null };

/**
 * Sesión para el sitio público (cabecera, botones de postularse). Una vez por request.
 * Si no se puede resolver, el sitio se muestra como para una visita en vez de caerse:
 * lo público tiene que seguir andando aunque falle el servicio de cuentas.
 */
export const sesionPublica = cache(async (): Promise<SesionPublica> => {
  try {
    const usuario = await usuarioActual();
    return { rol: usuario?.rol ?? null };
  } catch (e) {
    // Los errores internos de Next (render dinámico, redirects) no se tragan.
    unstable_rethrow(e);
    console.error("No se pudo resolver la sesión en el sitio público", e);
    return { rol: null };
  }
});

export type AccionPostular = { href: string; etiqueta: string };

/**
 * A dónde lleva "Postularme" desde el sitio público: sin sesión al registro, un docente a la
 * oferta dentro de su panel, y para instituciones/admin no se ofrece (no se postulan).
 */
export function accionPostular(sesion: SesionPublica, busquedaId: string): AccionPostular | null {
  if (!sesion.rol) return { href: "/registro", etiqueta: "Postularme" };
  if (sesion.rol === "docente") return { href: `/docente/oferta/${busquedaId}`, etiqueta: "Ver oferta" };
  return null;
}
