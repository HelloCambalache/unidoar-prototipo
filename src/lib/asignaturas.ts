import { normalizar } from "@/lib/coincidencia";

/*
 * Asignaturas que elige el profesional en el alta. Salen del catálogo (rubro → asignatura), pero el catálogo no puede
 * tenerlo todo (Pilates, Yoga, Crossfit…): al elegir «Otra» se escribe cuál y se guarda lo escrito. Mi perfil ya aceptaba
 * texto libre; esto es lo mismo para el alta, con las mismas reglas del lado del servidor y del navegador.
 * Todo es puro (sin base ni red) para poder probarlo.
 */

/** La opción que abre el campo «¿Cuál?». No es una asignatura: nunca se guarda. */
export const OTRA_ASIGNATURA = "__otra__";
export const ETIQUETA_OTRA_ASIGNATURA = "Otra (escribir cuál)";

/** Cuántas asignaturas escritas a mano puede sumar cada persona (el catálogo no tiene tope propio). */
export const MAX_ASIGNATURAS_PROPIAS = 3;
export const MAX_LARGO_ASIGNATURA = 60;
const MIN_LARGO_ASIGNATURA = 2;

/** Letras (con tildes), números, espacios y la puntuación de un nombre de disciplina: «Yoga (niños)», «Pre-deportivo», «Ed. Física». */
const PERMITIDO = /^[\p{L}\p{N} .,'’()/&+·-]+$/u;

/** Sin espacios de más y con el tope de largo. */
export const limpiarAsignatura = (texto: string) => texto.trim().replace(/\s+/g, " ").slice(0, MAX_LARGO_ASIGNATURA);

/** Por qué no sirve lo escrito (null = sirve). */
export function errorDeAsignaturaEscrita(texto: string): string | null {
  const limpio = limpiarAsignatura(texto);
  if (limpio.length < MIN_LARGO_ASIGNATURA) return "Escribí el nombre de la asignatura.";
  if (!PERMITIDO.test(limpio)) return "Usá solo letras y números.";
  return null;
}

type Resultado = { ok: true; asignaturas: string[] } | { ok: false; error: string };

/** Si lo escrito es una asignatura del catálogo (sin mirar mayúsculas ni tildes), la del catálogo: así queda una sola forma de escribirla. */
function delCatalogo(texto: string, catalogo: readonly string[]): string | undefined {
  const clave = normalizar(texto);
  return catalogo.find((c) => normalizar(c) === clave);
}

/** Cuántas de las elegidas no están en el catálogo. */
export const cantidadDePropias = (elegidas: readonly string[], catalogo: readonly string[]) =>
  elegidas.filter((a) => !delCatalogo(a, catalogo)).length;

/**
 * Suma una asignatura escrita a la lista de las elegidas (el botón «Agregar» del campo «¿Cuál?»). Si es una del catálogo se usa su
 * escritura canónica; si ya estaba, avisa; y las escritas a mano tienen tope.
 */
export function sumarAsignatura(elegidas: readonly string[], texto: string, catalogo: readonly string[]): Resultado {
  const error = errorDeAsignaturaEscrita(texto);
  if (error) return { ok: false, error };
  const limpio = limpiarAsignatura(texto);
  const canonica = delCatalogo(limpio, catalogo);
  const nueva = canonica ?? limpio;
  if (elegidas.some((a) => normalizar(a) === normalizar(nueva))) return { ok: false, error: "Ya la sumaste." };
  if (!canonica && cantidadDePropias(elegidas, catalogo) >= MAX_ASIGNATURAS_PROPIAS) {
    return { ok: false, error: `Podés sumar hasta ${MAX_ASIGNATURAS_PROPIAS} asignaturas que no estén en la lista.` };
  }
  return { ok: true, asignaturas: [...elegidas, nueva] };
}

/**
 * Lo que el servidor guarda a partir de lo que mandó el formulario: las del catálogo con su escritura canónica y, además, hasta
 * `MAX_ASIGNATURAS_PROPIAS` escritas a mano (limpias y sin repetir). Una repetida se descarta en silencio; algo que no sirve, o pasarse
 * del tope, es un error (el navegador ya lo había frenado: llega acá solo con un pedido armado a mano).
 */
export function validarAsignaturas(enviadas: readonly string[], catalogo: readonly string[]): Resultado {
  const vistas = new Set<string>();
  let lista: string[] = [];
  for (const cruda of enviadas) {
    const clave = normalizar(limpiarAsignatura(cruda));
    if (!clave || vistas.has(clave)) continue;
    const r = sumarAsignatura(lista, cruda, catalogo);
    if (!r.ok) return r;
    vistas.add(clave);
    lista = r.asignaturas;
  }
  return { ok: true, asignaturas: lista };
}

/**
 * Al cambiar de categoría en el alta, las asignaturas de la otra categoría dejan de tener sentido y se descartan; las escritas a mano
 * (que no están en ningún catálogo) se conservan: son del profesional, no de una categoría.
 */
export function conservarAlCambiarDeCategoria(elegidas: readonly string[], delaNueva: readonly string[], deTodas: readonly string[]): string[] {
  return elegidas.filter((a) => delCatalogo(a, delaNueva) !== undefined || delCatalogo(a, deTodas) === undefined);
}
