import "server-only";
import type { Docente } from "@/db/schema";
import { leerFiltrosOportunidades, type FiltrosOportunidades } from "@/lib/oportunidades";
import { leerFraseDeTrabajo } from "@/lib/oportunidades-ia";
import { listarOportunidades } from "@/lib/queries/oportunidades";
import { vocabularioBuscador } from "@/lib/queries/profesionales";

type Params = Record<string, string | string[] | undefined>;

/** Lo que se entendió de la frase escrita en el buscador (ver `leerFraseDeTrabajo`). */
export type LecturaDeLaFrase = {
  frase: string;
  leido: string[];
  reconocido: boolean;
  texto: string;
  /** `filtros.q` sin el texto: lo que se busca si la combinación con el texto no encuentra nada. */
  qSinTexto: string | undefined;
  sinEntender: string[];
};

/**
 * Los filtros de una pantalla de búsqueda de trabajo. Si la URL trae lo escrito en el buscador (`?frase=`), los filtros y el
 * texto salen de leerlo y reemplazan a los demás de la URL; si no, de los parámetros de siempre. Al tocar un filtro después, la URL se arma
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
  const lectura: LecturaDeLaFrase = {
    frase,
    leido: leida.leido,
    reconocido: leida.reconocido,
    texto: leida.texto,
    qSinTexto: leida.qSinTexto,
    sinEntender: leida.sinEntender,
  };
  return { filtros, lectura };
}

/**
 * Lista las ofertas de la consulta. Si la frase pidió filtros y además trajo un texto ("inglés Pérez") y la combinación no encuentra
 * nada, devuelve lo que dan los filtros solos y dice qué texto no se encontró: una palabra de más no deja la pantalla vacía. Si los
 * filtros solos tampoco encuentran nada, el vacío es por los filtros y no cambia nada.
 */
export async function listarOportunidadesConFrase(
  docente: Docente | null,
  usuarioId: string | null,
  consulta: FiltrosOportunidades,
  lectura: LecturaDeLaFrase | null,
) {
  const resultado = await listarOportunidades(docente, usuarioId, consulta);
  const sinCambios = { ...resultado, consulta, sinResultadosConTexto: null as string | null };
  if (resultado.ofertas.length > 0 || !lectura?.texto || !lectura.reconocido) return sinCambios;

  const soloFiltros: FiltrosOportunidades = { ...consulta, q: lectura.qSinTexto };
  const reintento = await listarOportunidades(docente, usuarioId, soloFiltros);
  if (reintento.ofertas.length === 0) return sinCambios;
  return { ...reintento, consulta: soloFiltros, sinResultadosConTexto: lectura.texto };
}
