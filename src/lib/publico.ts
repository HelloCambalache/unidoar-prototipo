import type { CategoriaDocente } from "@/db/schema";

/** Paso 1 del alta de cada rol (el registro de la cuenta). */
export const RUTA_REGISTRO_INSTITUCION = "/onboarding/institucion/1";
export const RUTA_REGISTRO_DOCENTE = "/onboarding/docente/1";

/**
 * Datos de contacto reales de UNIDOAR (cargados el 2026-10-20 por pedido de la titular). Es la ÚNICA fuente: /contacto los muestra, y el
 * email también es a donde llegan las respuestas a los mails automáticos (`remitenteDe`, src/lib/correo/config.ts) y el contacto que
 * se declara a OpenStreetMap (src/lib/ubicacion-busqueda.ts). El email tiene que ser un buzón que alguien lea. El WhatsApp se escribe
 * como se dice en Argentina ("11 5473-5876"); el enlace wa.me sale de `enlaceWhatsapp`. Con `null` la tarjeta de WhatsApp no aparece.
 */
export const CONTACTO_SITIO: { email: string; whatsapp: string | null; horario: string } = {
  email: "unidoar@gmail.com",
  whatsapp: "11 5473-5876",
  // Fijo, definido por el cliente (2026-11-04): de lunes a viernes de 9 a 18 hs y nada más (antes también atendía sábados).
  horario: "Lunes a viernes, 9 a 18 hs",
};

/** Valor de `testimonios.pagina` de cada categoría. */
export const PAGINA_TESTIMONIOS: Record<CategoriaDocente, string> = {
  educador: "educadores",
  entrenador: "entrenadores",
  guardavidas: "guardavidas",
};

/** 1234 → "1.234" */
export const num = (n: number) => n.toLocaleString("es-AR");

/** Desde cuántos logos la tira "Confían en UNIDOAR" corre como un marquee; con menos se muestran quietos, una sola vez (repetir uno para llenar el ancho lo haría ver como varias instituciones). */
export const MINIMO_PARA_TIRA_EN_MOVIMIENTO = 6;
export const logosEnMovimiento = (cantidad: number) => cantidad >= MINIMO_PARA_TIRA_EN_MOVIMIENTO;

/**
 * Las cifras de la red que el sitio público puede mostrar (portada, tarjetas de categoría, landings). Mientras el equipo las tiene ocultas
 * (Backoffice → Sitio, pedido del cliente del 2026-11-25: la red todavía es chica) `sinCifrasDeLaRed` las pone en cero: los lugares que ya
 * no dibujan un número en cero (el mosaico del hero, las tarjetas de categoría y la pastilla de tipos de institución) se ocultan solos, y los
 * demás (la franja de la portada y el aside de las landings) preguntan por `cifrasVisibles`.
 */
export type CifrasDeLaRed = {
  docentesVerificados: number;
  institucionesVerificadas: number;
  busquedasActivas: number;
  /** Asignaturas y disciplinas del catálogo: no es un dato de la red, pero la franja de la portada la cuenta como una cifra más. */
  disciplinas: number;
  tiposInstitucion: number;
  categorias: Record<CategoriaDocente, { verificados: number; busquedasActivas: number; institucionesBuscando: number }>;
};

/**
 * El resumen con todas las cifras de la red en cero. **No toca lo que no es una cifra de la red**: las búsquedas urgentes abiertas (`urgentes`,
 * del resumen y de cada categoría) siguen como están, porque la portada las muestra como una promesa de servicio y no hubo pedido de ocultarlas.
 */
export function sinCifrasDeLaRed<T extends CifrasDeLaRed>(resumen: T): T {
  const categorias = Object.fromEntries(
    Object.entries(resumen.categorias).map(([categoria, conteo]) => [categoria, { ...conteo, verificados: 0, busquedasActivas: 0, institucionesBuscando: 0 }]),
  ) as T["categorias"];
  return { ...resumen, docentesVerificados: 0, institucionesVerificadas: 0, busquedasActivas: 0, disciplinas: 0, tiposInstitucion: 0, categorias };
}

/** plural(1, "búsqueda", "búsquedas") → "1 búsqueda" · plural(12, …) → "12 búsquedas" */
export const plural = (n: number, uno: string, otros: string) => `${num(n)} ${n === 1 ? uno : otros}`;

/** Nombre que se muestra en público: nombre + inicial del apellido ("Martina A."). */
export function nombrePublico(nombre: string, apellido: string) {
  const inicial = apellido.trim()[0];
  return inicial ? `${nombre.trim()} ${inicial.toUpperCase()}.` : nombre.trim();
}

/** Plazo de una búsqueda rápida: "Vence en 18 h", "Vence en 3 días". Null si no tiene plazo o ya pasó. */
export function venceEnLegible(fecha: Date | string | null | undefined, ahora = new Date()) {
  if (!fecha) return null;
  const ms = new Date(fecha).getTime() - ahora.getTime();
  if (ms <= 0) return null;
  const horas = Math.ceil(ms / 3_600_000);
  if (horas <= 1) return "Vence en menos de 1 h";
  if (horas < 48) return `Vence en ${horas} h`;
  return `Vence en ${Math.ceil(horas / 24)} días`;
}
