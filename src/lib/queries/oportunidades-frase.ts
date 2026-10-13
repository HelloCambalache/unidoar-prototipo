import "server-only";
import { leerFiltrosOportunidades, type FiltrosOportunidades } from "@/lib/oportunidades";
import { leerFraseDeTrabajo } from "@/lib/oportunidades-ia";
import { vocabularioBuscador } from "@/lib/queries/profesionales";

type Params = Record<string, string | string[] | undefined>;

/**
 * Los filtros de una pantalla de búsqueda de trabajo. Si la URL trae una frase de "Buscá con IA" (`?frase=`), los filtros salen
 * de leerla (y reemplazan a los demás de la URL); si no, de los parámetros de siempre. Al tocar un filtro después, la URL se arma
 * desde esos filtros y la frase ya no viaja: el ajuste manual manda.
 */
export async function filtrosConFrase(params: Params, opciones: { publico?: boolean } = {}) {
  const normales = leerFiltrosOportunidades(params);
  const cruda = Array.isArray(params.frase) ? params.frase[0] : params.frase;
  const frase = cruda?.trim().slice(0, 200) ?? "";
  if (!frase) return { filtros: normales, lectura: null };

  const { disciplinas } = await vocabularioBuscador();
  const leida = leerFraseDeTrabajo(frase, disciplinas, opciones);
  const filtros: FiltrosOportunidades = { ...leida.filtros, ...(normales.vista ? { vista: normales.vista } : {}) };
  return { filtros, lectura: { frase, leido: leida.leido, reconocido: leida.reconocido, sinEntender: leida.sinEntender } };
}
