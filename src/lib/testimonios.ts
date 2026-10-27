import { z } from "zod";

/*
 * Testimonios de la parte pública (portada y landings de categoría), que carga el equipo desde el backoffice (Testimonios).
 * Reglas puras, sin base: las usan el formulario del backoffice, las server actions y las consultas, y se prueban solas.
 */

/** Dónde se muestra un testimonio: el valor de `testimonios.pagina` y cómo se llama en el backoffice. */
export const PAGINAS_DE_TESTIMONIOS = [
  { clave: "home", etiqueta: "Portada" },
  { clave: "educadores", etiqueta: "Docentes" },
  { clave: "entrenadores", etiqueta: "Entrenadores" },
  { clave: "guardavidas", etiqueta: "Guardavidas" },
] as const;

export type PaginaDeTestimonio = (typeof PAGINAS_DE_TESTIMONIOS)[number]["clave"];

const CLAVES = PAGINAS_DE_TESTIMONIOS.map((p) => p.clave) as [PaginaDeTestimonio, ...PaginaDeTestimonio[]];

export const etiquetaDePagina = (clave: string) => PAGINAS_DE_TESTIMONIOS.find((p) => p.clave === clave)?.etiqueta ?? clave;

/** Con más testimonios que esto el carrusel se vuelve interminable: se pide sacar alguno antes de sumar otro. */
export const MAX_TESTIMONIOS_POR_PAGINA = 12;

export const LARGO_DE_CITA = { min: 10, max: 280 } as const;

const espaciosSimples = (s: string) => s.replace(/\s+/g, " ").trim();

/** Comillas que alguien puede haber pegado alrededor de la cita: la página ya la pone entre comillas y se verían dobles. */
const COMILLAS = /^["“”«»'‘’]+|["“”«»'‘’]+$/g;

/** La cita sin comillas pegadas de más y con los espacios en orden (es una frase: los saltos de línea se vuelven espacios). */
export const limpiarCita = (texto: string) => espaciosSimples(texto.replace(COMILLAS, "")).replace(COMILLAS, "").trim();

export const testimonioSchema = z.object({
  pagina: z.enum(CLAVES, { error: "Elegí dónde se muestra." }),
  cita: z
    .string()
    .transform(limpiarCita)
    .pipe(
      z
        .string()
        .min(LARGO_DE_CITA.min, `Escribí el testimonio (mínimo ${LARGO_DE_CITA.min} letras).`)
        .max(LARGO_DE_CITA.max, `Máximo ${LARGO_DE_CITA.max} caracteres: el carrusel muestra una frase corta.`),
    ),
  autor: z.string().transform(espaciosSimples).pipe(z.string().min(2, "Falta el nombre.").max(80, "Máximo 80 caracteres.")),
  cargo: z
    .string()
    .transform(espaciosSimples)
    .pipe(z.string().min(2, "Falta el cargo y la institución.").max(120, "Máximo 120 caracteres.")),
  /** URL de la foto (la subió quien guarda) o null. Se vuelve a validar en el servidor. */
  fotoUrl: z
    .string()
    .trim()
    .max(600)
    .nullish()
    .transform((v) => v || null),
});

export type TestimonioNuevo = z.input<typeof testimonioSchema>;

/** El lugar que le toca a uno nuevo en su página: después del último. */
export const siguienteOrden = (ordenes: number[]) => (ordenes.length === 0 ? 0 : Math.max(...ordenes) + 1);

/** ¿Se puede sumar uno más a esta página? (`cantidad` cuenta también los ocultos: siguen ocupando lugar hasta que se eliminan.) */
export const hayLugarEnPagina = (cantidad: number) => cantidad < MAX_TESTIMONIOS_POR_PAGINA;

/**
 * Una foto se acepta si no hay (null), si es la que ya tenía (puede ser de otra cuenta del equipo, o una de las del sitio en `/assets`) o si
 * es una que subió quien guarda. `esPropia` es `esUrlPublicaPropia(url, admin.id)`.
 */
export function fotoAceptada(nueva: string | null, actual: string | null, esPropia: (url: string) => boolean): boolean {
  if (!nueva) return true;
  if (nueva === actual) return true;
  return esPropia(nueva);
}
