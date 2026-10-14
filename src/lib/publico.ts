import type { CategoriaDocente } from "@/db/schema";

/** Cupos del plan Fundador: pasados estos, el precio es el de lista (ver PLANES). */
export const CUPOS_FUNDADOR = 20;

/** Paso 1 del alta de cada rol (el registro de la cuenta). */
export const RUTA_REGISTRO_INSTITUCION = "/onboarding/institucion/1";
export const RUTA_REGISTRO_DOCENTE = "/onboarding/docente/1";

/**
 * Datos de contacto que muestra /contacto. El WhatsApp es `null` hasta tener el número real: así no se muestra uno de ejemplo
 * (poner el número acá y la tarjeta aparece sola). El email tiene que ser un buzón que alguien lea.
 */
export const CONTACTO_SITIO: { email: string; whatsapp: string | null; horario: string } = {
  email: "hola@unidoar.com.ar",
  whatsapp: null,
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
