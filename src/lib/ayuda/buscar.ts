import { normalizarTexto } from "@/lib/busqueda-ia";
import { rutaDeArticulo, rutaDeManual, type BloqueDeAyuda, type ManualDeAyuda } from "./tipos";

/** El texto de unos bloques sin las marcas (**negrita**, [enlace](/ruta)): lo que se lee, para buscar adentro. */
export function textoDeBloques(bloques: BloqueDeAyuda[]): string {
  const partes = bloques.flatMap((b) => ("p" in b ? [b.p] : "nota" in b ? [b.nota] : "pasos" in b ? b.pasos : b.lista));
  return partes.join(" ").replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\[([^\]]+)\]\(\/[^)\s]*\)/g, "$1");
}

export type ResultadoDeAyuda = {
  tipo: "guia" | "pregunta";
  perfil: ManualDeAyuda["perfil"];
  manual: string;
  titulo: string;
  resumen: string;
  /** Dónde abre: la guía, o la lista de preguntas frecuentes del manual. */
  href: string;
  puntaje: number;
};

export const MAX_RESULTADOS_DE_AYUDA = 24;
export const MAX_PALABRAS_DE_BUSQUEDA_EN_AYUDA = 6;

/**
 * Busca en las guías y en las preguntas frecuentes de los manales que se le pasan (el sitio público no pasa el del equipo). Sin tildes ni
 * mayúsculas, y cada palabra de la consulta tiene que estar en la guía o la pregunta (título, resumen o texto). Primero lo que coincide en el
 * título. Las preguntas llevan a la sección de preguntas del manual.
 */
export function buscarEnAyuda(manuales: ManualDeAyuda[], consulta: string): ResultadoDeAyuda[] {
  const palabras = normalizarTexto(consulta)
    .split(/[^a-z0-9ñ]+/)
    .filter((p) => p.length >= 2)
    .slice(0, MAX_PALABRAS_DE_BUSQUEDA_EN_AYUDA);
  if (palabras.length === 0) return [];

  const resultados: ResultadoDeAyuda[] = [];
  const evaluar = (titulo: string, resto: string) => {
    const enTitulo = normalizarTexto(titulo);
    const enTodo = `${enTitulo} ${normalizarTexto(resto)}`;
    if (!palabras.every((p) => enTodo.includes(p))) return null;
    return palabras.reduce((n, p) => n + (enTitulo.includes(p) ? 3 : 1), 0);
  };

  for (const manual of manuales) {
    for (const capitulo of manual.capitulos) {
      for (const articulo of capitulo.articulos) {
        const puntaje = evaluar(articulo.titulo, `${articulo.resumen} ${textoDeBloques(articulo.bloques)}`);
        if (puntaje !== null) {
          resultados.push({
            tipo: "guia",
            perfil: manual.perfil,
            manual: manual.nombre,
            titulo: articulo.titulo,
            resumen: articulo.resumen,
            href: rutaDeArticulo(manual.perfil, articulo.slug),
            puntaje,
          });
        }
      }
    }
    for (const pregunta of manual.preguntas) {
      const puntaje = evaluar(pregunta.pregunta, textoDeBloques(pregunta.respuesta));
      if (puntaje !== null) {
        resultados.push({
          tipo: "pregunta",
          perfil: manual.perfil,
          manual: manual.nombre,
          titulo: pregunta.pregunta,
          resumen: textoDeBloques(pregunta.respuesta).slice(0, 140).trim(),
          href: `${rutaDeManual(manual.perfil)}#preguntas`,
          puntaje,
        });
      }
    }
  }
  // Estable: a igual puntaje se conserva el orden de los manuales y de las guías.
  return resultados
    .map((r, i) => ({ r, i }))
    .sort((a, b) => b.r.puntaje - a.r.puntaje || a.i - b.i)
    .slice(0, MAX_RESULTADOS_DE_AYUDA)
    .map(({ r }) => r);
}
