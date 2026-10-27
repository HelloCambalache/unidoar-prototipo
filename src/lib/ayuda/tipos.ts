/*
 * Centro de ayuda: tres manuales, uno por perfil (profesionales, instituciones y el equipo de UNIDOAR), cada uno con guías por capítulos y preguntas
 * frecuentes. El contenido vive como datos (`profesionales.ts`, `instituciones.ts`, `equipo.ts`), no en las pantallas: así una guía se corrige en un solo
 * lugar, se busca con la misma regla y una prueba cuida que no queden enlaces rotos ni guías vacías.
 */

export type PerfilDeAyuda = "profesionales" | "instituciones" | "equipo";

/**
 * Un bloque de una guía. Los textos admiten **negrita** y [enlaces](/ruta-interna) (solo a rutas del sitio); nunca se interpretan como HTML.
 * - `p`: un párrafo · `pasos`: una lista numerada · `lista`: una lista con viñetas · `nota`: un consejo o aviso destacado.
 */
export type BloqueDeAyuda = { p: string } | { pasos: string[] } | { lista: string[] } | { nota: string };

export type ArticuloDeAyuda = {
  /** Va en la dirección (`/ayuda/profesionales/<slug>`): minúsculas, números y guiones. Único dentro del manual. */
  slug: string;
  titulo: string;
  /** Una línea que dice para qué sirve la guía (se ve en el índice y en los resultados de búsqueda). */
  resumen: string;
  bloques: BloqueDeAyuda[];
};

export type CapituloDeAyuda = { id: string; titulo: string; articulos: ArticuloDeAyuda[] };

export type PreguntaFrecuente = { pregunta: string; respuesta: BloqueDeAyuda[] };

export type ManualDeAyuda = {
  perfil: PerfilDeAyuda;
  /** "Profesionales", "Instituciones", "Equipo UNIDOAR": como se nombra en las tarjetas y las migas de pan. */
  nombre: string;
  /** "Manual para profesionales". */
  titulo: string;
  bajada: string;
  capitulos: CapituloDeAyuda[];
  preguntas: PreguntaFrecuente[];
};

/** Los manuales que ve cualquiera, sin cuenta. El del equipo documenta cómo se opera el backoffice y solo se abre desde adentro. */
export const PERFILES_PUBLICOS = ["profesionales", "instituciones"] as const satisfies readonly PerfilDeAyuda[];

export const esPerfilPublico = (valor: string): valor is (typeof PERFILES_PUBLICOS)[number] =>
  (PERFILES_PUBLICOS as readonly string[]).includes(valor);

/** Dónde vive cada manual. El del equipo está dentro del backoffice (solo cuentas admin). */
export function rutaDeManual(perfil: PerfilDeAyuda): string {
  return perfil === "equipo" ? "/backoffice/ayuda" : `/ayuda/${perfil}`;
}

export const rutaDeArticulo = (perfil: PerfilDeAyuda, slug: string) => `${rutaDeManual(perfil)}/${slug}`;

/** Todas las guías de un manual, en el orden en que se leen. */
export const articulosDe = (manual: ManualDeAyuda): ArticuloDeAyuda[] => manual.capitulos.flatMap((c) => c.articulos);

export function articuloPorSlug(manual: ManualDeAyuda, slug: string): { articulo: ArticuloDeAyuda; capitulo: CapituloDeAyuda } | null {
  for (const capitulo of manual.capitulos) {
    const articulo = capitulo.articulos.find((a) => a.slug === slug);
    if (articulo) return { articulo, capitulo };
  }
  return null;
}

/** La guía de antes y la de después (para "Anterior" y "Siguiente"). */
export function vecinosDe(manual: ManualDeAyuda, slug: string): { anterior: ArticuloDeAyuda | null; siguiente: ArticuloDeAyuda | null } {
  const todos = articulosDe(manual);
  const i = todos.findIndex((a) => a.slug === slug);
  if (i < 0) return { anterior: null, siguiente: null };
  return { anterior: todos[i - 1] ?? null, siguiente: todos[i + 1] ?? null };
}
