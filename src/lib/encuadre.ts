import { focoDeFoto } from "@/lib/fotos";

/*
 * Encuadre de la foto de portada de una institución (reglas puras, sin base ni Next: las usan el formulario, el servidor y las pruebas).
 *
 * La portada se muestra en cajas más anchas que altas (16:7, o más bajas en pantallas grandes) con `object-fit: cover`, así que siempre queda
 * una parte de la foto afuera. Antes el punto que se mostraba era fijo (`FOCO_POR_DEFECTO`) y la institución no podía elegir cuál: ahora arrastra
 * la foto dentro del marco y se guarda ese punto como un `object-position` ("30% 62%"), que se aplica igual en cualquier caja: es lo que ve la
 * institución, el profesional y quien entra al perfil público.
 */

/** Un encuadre guardado: "x% y%", cada uno un entero de 0 a 100. */
const FORMA = /^(\d{1,3})% (\d{1,3})%$/;

export type Encuadre = { x: number; y: number };

/** El centro de la foto: lo que pide "Centrar". */
export const ENCUADRE_CENTRADO: Encuadre = { x: 50, y: 50 };

const entre = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/** "30% 62%" → { x: 30, y: 62 }; null si no tiene esa forma o se pasa de 100. Nunca lanza. */
export function leerEncuadre(texto: unknown): Encuadre | null {
  if (typeof texto !== "string") return null;
  const m = FORMA.exec(texto.trim());
  if (!m) return null;
  const x = Number(m[1]);
  const y = Number(m[2]);
  return x <= 100 && y <= 100 ? { x, y } : null;
}

/** { x: 30.4, y: 61.7 } → "30% 62%" (enteros, dentro de 0 a 100). */
export function textoDeEncuadre(e: Encuadre): string {
  return `${Math.round(entre(e.x, 0, 100))}% ${Math.round(entre(e.y, 0, 100))}%`;
}

/**
 * Lo que se guarda de la portada: el encuadre en su forma normal si hay portada y es válido; si no, null (sin portada no hay qué encuadrar, y un
 * texto raro nunca llega a la base ni a un `style`).
 */
export function encuadreParaGuardar(texto: unknown, hayPortada: boolean): string | null {
  if (!hayPortada) return null;
  const e = leerEncuadre(texto);
  return e ? textoDeEncuadre(e) : null;
}

/**
 * El `object-position` con el que se muestra la portada: el encuadre que eligió la institución o, si no eligió ninguno (o no es válido), el
 * punto de siempre de esa foto (`focoDeFoto`).
 */
export function posicionDePortada(url: string | null | undefined, encuadre: string | null | undefined): string {
  const e = leerEncuadre(encuadre);
  return e ? textoDeEncuadre(e) : focoDeFoto(url);
}

/** El mismo punto de partida como número, para el que arrastra la foto. */
export function encuadreInicial(url: string | null | undefined, encuadre: string | null | undefined): Encuadre {
  return leerEncuadre(posicionDePortada(url, encuadre)) ?? ENCUADRE_CENTRADO;
}

type Medida = { ancho: number; alto: number };

/**
 * Cuánto de la foto queda afuera de la caja con `object-fit: cover`, en píxeles de pantalla y por eje: es lo que se puede mover. Con un eje en 0
 * (la foto tiene justo la proporción de la caja en ese sentido) arrastrar en él no hace nada.
 */
export function sobranteDeCover(natural: Medida, caja: Medida): { x: number; y: number } {
  if (!(natural.ancho > 0 && natural.alto > 0 && caja.ancho > 0 && caja.alto > 0)) return { x: 0, y: 0 };
  const escala = Math.max(caja.ancho / natural.ancho, caja.alto / natural.alto);
  return {
    x: Math.max(0, natural.ancho * escala - caja.ancho),
    y: Math.max(0, natural.alto * escala - caja.alto),
  };
}

/**
 * El encuadre que queda al arrastrar la foto `dx` píxeles a la derecha y `dy` hacia abajo desde `inicial`. Con `object-position: p%` el corrimiento
 * de la foto es `-sobrante × p / 100`: moverla hacia la derecha muestra más de su lado izquierdo (baja `x`), como cuando se la agarra con la mano.
 * Un eje sin sobrante no se mueve.
 */
export function moverEncuadre(inicial: Encuadre, dx: number, dy: number, sobrante: { x: number; y: number }): Encuadre {
  return {
    x: sobrante.x > 0 ? entre(inicial.x - (dx / sobrante.x) * 100, 0, 100) : inicial.x,
    y: sobrante.y > 0 ? entre(inicial.y - (dy / sobrante.y) * 100, 0, 100) : inicial.y,
  };
}
