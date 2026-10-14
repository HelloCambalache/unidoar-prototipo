/*
 * Interruptor para ocultar los datos de ejemplo (las instituciones y los profesionales `es_demo` que sembró `pnpm db:seed`, y los
 * testimonios de ejemplo) de todo lo que ve la gente: sitio público, catálogo, buscadores, recomendaciones y las métricas del
 * backoffice. Se prende con la variable de entorno `OCULTAR_DATOS_DE_EJEMPLO=1` en Vercel el día que se abre al público, sin tocar la base.
 * Con la variable apagada (lo de hoy) los ejemplos se ven como siempre, que es lo que sirve para mostrar el producto.
 *
 * Ocultarlos no los borra: las cuentas de prueba que se ligaron a ellos (`pnpm db:vincular`) siguen entrando a su propia área.
 * Puro, sin base ni Next: lo usan `src/lib/visibilidad.ts` y las consultas, y se prueba solo.
 */

const VALORES_QUE_PRENDEN = new Set(["1", "true", "si", "sí", "yes", "on"]);

/** ¿El valor de la variable de entorno pide ocultar los datos de ejemplo? Cualquier otra cosa (o vacío) los deja a la vista. */
export const hayQueOcultarLosEjemplos = (valor: string | null | undefined): boolean => VALORES_QUE_PRENDEN.has((valor ?? "").trim().toLowerCase());
