import type { RolUsuario } from "@/db/schema";

/*
 * Los botones de la parte pública pensados para instituciones ("Soy institución · Busco profesionales", "Publicar una
 * suplencia"…) llevan a /publicar-busqueda, que decide a dónde seguir según quién está ingresado. Reglas puras (sin base ni
 * Next) para poder probarlas.
 */

/** A dónde van los botones para publicar. `?urgente=1` es el de las suplencias rápidas. */
export const RUTA_PUBLICAR_BUSQUEDA = "/publicar-busqueda";
export const RUTA_PUBLICAR_URGENTE = "/publicar-busqueda?urgente=1";

/** La pantalla de publicar dentro del área de la institución. Con `urgente`, arranca como "Suplencia rápida". */
export const destinoDePublicar = (urgente: boolean) => (urgente ? "/institucion/publicar?urgente=1" : "/institucion/publicar");

/** ¿El pedido vino de un botón de suplencia urgente? Solo `?urgente=1` cuenta. */
export const esPedidoUrgente = (valor: string | string[] | undefined) => (Array.isArray(valor) ? valor[0] : valor) === "1";

/**
 * Qué hacer con quien toca un botón para publicar, según su cuenta:
 * - institución → directo a publicar;
 * - sin sesión → elegir entre ingresar con la cuenta de la institución o crear una;
 * - profesional → avisarle que hace falta una cuenta de institución (una misma cuenta no puede ser las dos cosas);
 * - admin → a su propia área (no tiene institución).
 */
export type AccionAlPublicar = "publicar" | "elegir" | "otra-cuenta" | "admin";

export function queHacerAlPublicar(rol: RolUsuario | null): AccionAlPublicar {
  if (rol === "institucion") return "publicar";
  if (rol === "docente") return "otra-cuenta";
  if (rol === "admin") return "admin";
  return "elegir";
}
