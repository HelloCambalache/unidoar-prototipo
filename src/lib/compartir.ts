/*
 * Compartir desde UNIDOAR: los canales, el mensaje y el enlace de cada cosa que se comparte (la búsqueda de una institución, el perfil de una institución y
 * el perfil de un profesional). Reglas puras, sin base ni Next: las usan el menú «Compartir» y las pruebas. El perfil del profesional tiene además su
 * enlace propio y apagable (`src/lib/compartir-perfil.ts`).
 */

/** Los canales que ofrece el menú, en orden. El compartir nativo del celular (`navigator.share`) se suma aparte cuando el dispositivo lo tiene. */
export const CANALES = [
  { canal: "whatsapp", etiqueta: "WhatsApp" },
  { canal: "facebook", etiqueta: "Facebook" },
  { canal: "linkedin", etiqueta: "LinkedIn" },
  { canal: "x", etiqueta: "X" },
  { canal: "correo", etiqueta: "Correo" },
] as const;

export type Canal = (typeof CANALES)[number]["canal"];

/** Lo que se comparte: el enlace completo (con el origen del sitio), una frase corta que lo acompaña y el asunto (para el correo y el compartir nativo). */
export type Mensaje = { url: string; texto: string; asunto: string };

const cod = encodeURIComponent;

/** La dirección a la que se abre cada canal con el mensaje ya armado (la persona elige a quién o dónde publicarlo). */
export function enlaceDeCanal(canal: Canal, m: Mensaje): string {
  switch (canal) {
    case "whatsapp":
      return `https://wa.me/?text=${cod(`${m.texto} ${m.url}`)}`;
    case "facebook":
      return `https://www.facebook.com/sharer/sharer.php?u=${cod(m.url)}`;
    case "linkedin":
      return `https://www.linkedin.com/sharing/share-offsite/?url=${cod(m.url)}`;
    case "x":
      return `https://x.com/intent/post?text=${cod(m.texto)}&url=${cod(m.url)}`;
    case "correo":
      return `mailto:?subject=${cod(m.asunto)}&body=${cod(`${m.texto}\n\n${m.url}`)}`;
  }
}

/** Una dirección completa a partir del origen del sitio y una ruta interna, sin barra doble. */
export const urlCompleta = (origen: string, ruta: string) => `${origen.replace(/\/+$/, "")}${ruta}`;

/** Ruta pública de una búsqueda: la puede abrir cualquiera, con o sin cuenta. */
export const rutaDeOferta = (busquedaId: string) => `/ofertas/${busquedaId}`;

/** Ruta pública del perfil de una institución. */
export const rutaDeInstitucion = (slug: string) => `/instituciones/${slug}`;

/** Se comparte una búsqueda: la institución para atraer candidatos, o un profesional para pasársela a alguien que le sirva. */
export function mensajeDeBusqueda(b: { puesto: string; institucion: string; url: string }): Mensaje {
  return {
    url: b.url,
    texto: `Búsqueda en UNIDOAR: ${b.puesto} en ${b.institucion}.`,
    asunto: `${b.puesto} · ${b.institucion} (UNIDOAR)`,
  };
}

/** Se comparte el perfil público de una institución. */
export function mensajeDeInstitucion(i: { nombre: string; url: string }): Mensaje {
  return { url: i.url, texto: `Conocé a ${i.nombre} en UNIDOAR.`, asunto: `${i.nombre} en UNIDOAR` };
}

/** El profesional comparte su propio perfil (la página pública que él prende en Mi perfil). */
export function mensajeDePerfil(url: string): Mensaje {
  return { url, texto: "Mirá mi perfil profesional en UNIDOAR.", asunto: "Mi perfil profesional en UNIDOAR" };
}

/** La descripción corta de una búsqueda para la vista previa al compartir: la primera frase de lo que escribió la institución, sin saltos de línea y de hasta 160 caracteres. */
export function resumenDeBusqueda(b: { descripcion: string | null; tipo: string; zona: string | null; institucion: string }): string {
  const limpia = (b.descripcion ?? "").replace(/\s+/g, " ").trim();
  if (limpia) return limpia.length > 160 ? `${limpia.slice(0, 157).trimEnd()}…` : limpia;
  return [b.tipo, b.zona, b.institucion].filter(Boolean).join(" · ");
}
