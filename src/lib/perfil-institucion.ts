import type { Institucion } from "@/db/schema";

/**
 * Qué falta completar en el perfil de una institución. Alimenta la tarjeta del dashboard
 * ("Completá tu perfil…") y el paso "Completá el perfil" de la primera vez.
 */
export function pasosDePerfilInstitucion(i: Institucion) {
  const pasos = [
    { clave: "logo", etiqueta: "el logo", ok: !!i.logoUrl },
    { clave: "portada", etiqueta: "la foto de portada", ok: !!i.portadaUrl },
    { clave: "descripcion", etiqueta: "la descripción", ok: !!i.descripcion?.trim() },
    { clave: "direccion", etiqueta: "la dirección", ok: !!i.direccion?.trim() },
    { clave: "telefono", etiqueta: "un teléfono de contacto", ok: !!i.telefono?.trim() },
  ];
  const hechos = pasos.filter((p) => p.ok).length;
  return {
    pasos,
    faltan: pasos.filter((p) => !p.ok).map((p) => p.etiqueta),
    porcentaje: Math.round((hechos / pasos.length) * 100),
  };
}

/** ["el logo", "la portada", "la descripción"] → "el logo, la portada y la descripción" */
export function enumerar(items: string[]) {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`;
}
