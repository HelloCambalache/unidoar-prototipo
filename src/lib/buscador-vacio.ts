/*
 * Cuando Buscar profesionales no encuentra a nadie, la pantalla dice POR QUÉ en lugar de un «probá con menos condiciones» genérico (2026-11-05: el cliente
 * buscó «profesor de hockey» e «inglés» por zona y creyó que la búsqueda estaba pausada o mal hecha; en realidad todavía no había profesionales de
 * hockey en UNIDOAR). Reglas puras, sin base ni Next: la pantalla cuenta lo que hace falta y esta función decide qué decir.
 */

export type DatosDelVacio = {
  /** Las disciplinas que se pidieron ("Hockey"). */
  disciplinas: string[];
  /** Las zonas que se pidieron ("Olivos"). */
  zonas: string[];
  /** Cuántos profesionales hay de esa disciplina en toda la plataforma, sin zona ni otros filtros. Null si no se pidió ninguna disciplina. */
  deLaDisciplina: number | null;
  /** Cuántos hay con todo lo pedido pero sin la zona. Null si no se pidió ninguna zona. */
  sinLaZona: number | null;
};

export type ExplicacionDelVacio =
  | { tipo: "sin-profesionales-de-la-disciplina"; titulo: string; texto: string }
  | { tipo: "ninguno-en-la-zona"; titulo: string; texto: string; cantidad: number }
  | null;

const lista = (xs: string[]) => (xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}`);
const profesionales = (n: number) => (n === 1 ? "1 profesional" : `${n} profesionales`);

/**
 * Qué explicación darle a quien no encontró a nadie. Null si no hay una causa que se pueda decir (el vacío es por otros filtros: entonces vale el
 * mensaje genérico). La causa más fuerte va primero: si no existe nadie de esa disciplina, quitar la zona no sirve de nada.
 */
export function explicarVacio(d: DatosDelVacio): ExplicacionDelVacio {
  if (d.disciplinas.length > 0 && d.deLaDisciplina === 0) {
    const que = lista(d.disciplinas);
    return {
      tipo: "sin-profesionales-de-la-disciplina",
      titulo: `Todavía no hay profesionales de ${que} en UNIDOAR`,
      texto: `La búsqueda está bien hecha: nadie cargó ${que} en su perfil. Si necesitás cubrir el puesto, publicá una búsqueda: los profesionales que se sumen la van a ver al entrar a buscar trabajo.`,
    };
  }
  if (d.zonas.length > 0 && d.sinLaZona !== null && d.sinLaZona > 0) {
    const donde = lista(d.zonas);
    const que = d.disciplinas.length > 0 ? ` de ${lista(d.disciplinas)}` : "";
    return {
      tipo: "ninguno-en-la-zona",
      cantidad: d.sinLaZona,
      titulo: `Hay ${profesionales(d.sinLaZona)}${que}, pero ninguno en ${donde}`,
      texto: `Probá sin elegir zona para ${d.sinLaZona === 1 ? "ver al profesional" : "verlos"}.`,
    };
  }
  return null;
}
