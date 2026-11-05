import { palabrasDeBusqueda, textoPlano } from "@/lib/sql-texto";

/**
 * Las filas cuyo nombre tiene todas las palabras que se escribieron, sin importar mayúsculas ni tildes ni el orden («san andres» encuentra «Colegio San
 * Andrés del Norte»; «norte andres» también). Sin texto (o con solo espacios) devuelve todas. Lo usa la lupa de Cobros: las listas del backoffice
 * son chicas y se filtran en memoria.
 */
export function filtrarPorNombre<T extends { nombre: string }>(filas: T[], texto: string): T[] {
  const palabras = palabrasDeBusqueda(texto);
  if (palabras.length === 0) return filas;
  return filas.filter((f) => {
    const nombre = textoPlano(f.nombre);
    return palabras.every((p) => nombre.includes(p));
  });
}
