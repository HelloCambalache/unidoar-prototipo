import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Conoce los radios de la escala (ver globals.css): sin esto no los reconoce como radios y, si un componente trae
// `rounded-tarjeta` y quien lo usa pasa `rounded-panel`, quedan los dos y gana el que el CSS emite último.
const twMerge = extendTailwindMerge({
  extend: { theme: { radius: ["marco", "panel", "tarjeta", "interno", "caja"] } },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** "Luciana Prieto" → "LP" */
export function iniciales(nombre: string) {
  return nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

/** "Educación Física" → "educacion-fisica" */
export function slugify(texto: string) {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

const RTF = new Intl.RelativeTimeFormat("es-AR", { numeric: "auto" });

/** Fecha → "hace 5 min", "ayer", etc. */
export function haceCuanto(fecha: Date | string, ahora = new Date()) {
  const diffSeg = Math.round((new Date(fecha).getTime() - ahora.getTime()) / 1000);
  const abs = Math.abs(diffSeg);
  if (abs < 60) return "ahora";
  if (abs < 3600) return RTF.format(Math.round(diffSeg / 60), "minute");
  if (abs < 86400) return RTF.format(Math.round(diffSeg / 3600), "hour");
  return RTF.format(Math.round(diffSeg / 86400), "day");
}
