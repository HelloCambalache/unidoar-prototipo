import { esUuid } from "@/lib/busquedas";
import { CATEGORIAS, DISPONIBILIDAD, NIVELES } from "@/lib/catalogo";
import type { CategoriaDocente } from "@/db/schema";
import type { FiltrosIA, Interpretacion } from "@/lib/busqueda-ia";

/*
 * Filtros del buscador de profesionales. Viven en la URL (searchParams): este módulo es la única
 * fuente de cómo se leen y se escriben, y lo usan tanto la página (servidor) como los controles (cliente).
 *
 *   q        frase para "Buscá con IA" (se interpreta en el servidor)
 *   f=1      los filtros de la URL ya son los definitivos: la frase solo se muestra, no se vuelve a aplicar
 *   cat, disc*, zona*, disp*, nivel, tipo, verif=1, fav=1, texto, orden, busqueda, pagina
 */

export const RUTA_BUSCADOR = "/institucion/buscar-docentes";
export const RUTA_RAPIDAS = "/institucion/busquedas-rapidas";

/** "Suplencia rápida" no está acá: es la pantalla /institucion/busquedas-rapidas. */
export const TIPOS_FILTRO = ["Titular", "Suplencia", "Temporada", "Freelance"] as const;

export const ORDENES = [
  { clave: "recomendados", etiqueta: "Recomendados" },
  { clave: "experiencia", etiqueta: "Más experiencia" },
  { clave: "cercania", etiqueta: "Más cerca de tu sede" },
  { clave: "nombre", etiqueta: "Nombre (A–Z)" },
] as const;
export type OrdenDocentes = (typeof ORDENES)[number]["clave"];

/** Palabras de rol que el buscador de texto sugiere además de las asignaturas y zonas del catálogo. */
export const TERMINOS_ROL = [
  "Profesor",
  "Profesora",
  "Educador",
  "Docente",
  "Maestra",
  "Maestro",
  "Entrenador",
  "Entrenadora",
  "Guardavidas",
];

export type FiltrosDocentes = {
  frase: string;
  categoria: CategoriaDocente | null;
  disciplinas: string[];
  zonas: string[];
  disponibilidad: string[];
  nivel: string | null;
  tipo: string | null;
  soloVerificados: boolean;
  soloFavoritos: boolean;
  texto: string;
  orden: OrdenDocentes;
  /** Búsqueda de la institución que da contexto (criterios de "coincide" y destino de la invitación). */
  busqueda: string | null;
  pagina: number;
};

type SearchParams = Record<string, string | string[] | undefined>;

const lista = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v : v === undefined ? [] : [v]).map((s) => s.trim()).filter(Boolean);
const uno = (v: string | string[] | undefined) => lista(v)[0];
const unicos = (xs: string[], max: number) => [...new Set(xs.map((x) => x.slice(0, 80)))].slice(0, max);
const enLista = <T extends string>(valores: readonly T[], v: string | undefined): T | null =>
  (valores as readonly string[]).includes(v ?? "") ? (v as T) : null;

/**
 * Filtros efectivos a partir de la URL. Si la URL trae una frase y todavía no se tocó ningún control
 * (sin `f=1`), la interpretación de la frase completa lo que la URL no dice explícitamente.
 */
export function leerFiltros(sp: SearchParams, ia?: Interpretacion | null): FiltrosDocentes {
  const base: FiltrosIA = sp.f !== "1" && ia ? ia.filtros : {};
  const disciplinas = lista(sp.disc);
  const zonas = lista(sp.zona);
  const disponibilidad = lista(sp.disp).filter((d) => (DISPONIBILIDAD as readonly string[]).includes(d));
  const busqueda = uno(sp.busqueda);
  const pagina = Number.parseInt(uno(sp.pagina) ?? "1", 10);
  return {
    frase: (uno(sp.q) ?? "").slice(0, 200),
    categoria: enLista(CATEGORIAS, uno(sp.cat)) ?? base.categoria ?? null,
    disciplinas: unicos(disciplinas.length ? disciplinas : (base.disciplinas ?? []), 12),
    zonas: unicos(zonas.length ? zonas : (base.zonas ?? []), 12),
    disponibilidad: disponibilidad.length ? unicos(disponibilidad, 4) : (base.disponibilidad ?? []),
    nivel: enLista(NIVELES, uno(sp.nivel)) ?? enLista(NIVELES, base.nivel) ?? null,
    tipo: enLista(TIPOS_FILTRO, uno(sp.tipo)) ?? enLista(TIPOS_FILTRO, base.tipo) ?? null,
    soloVerificados: sp.verif === "1" || !!base.soloVerificados,
    soloFavoritos: sp.fav === "1" || !!base.soloFavoritos,
    texto: (uno(sp.texto) ?? "").slice(0, 80),
    orden: ORDENES.find((o) => o.clave === uno(sp.orden))?.clave ?? "recomendados",
    busqueda: esUuid(busqueda) ? busqueda : null,
    pagina: Number.isFinite(pagina) && pagina > 0 ? pagina : 1,
  };
}

/** URL de la pantalla con estos filtros (más los `cambios`); siempre marca `f=1`. */
export function hrefBuscador(ruta: string, filtros: FiltrosDocentes, cambios: Partial<FiltrosDocentes> = {}) {
  const f: FiltrosDocentes = { ...filtros, ...cambios };
  if (cambios.pagina === undefined) f.pagina = 1;
  const p = new URLSearchParams();
  if (f.frase) p.set("q", f.frase);
  p.set("f", "1");
  if (f.categoria) p.set("cat", f.categoria);
  f.disciplinas.forEach((d) => p.append("disc", d));
  f.zonas.forEach((zona) => p.append("zona", zona));
  f.disponibilidad.forEach((d) => p.append("disp", d));
  if (f.nivel) p.set("nivel", f.nivel);
  if (f.tipo) p.set("tipo", f.tipo);
  if (f.soloVerificados) p.set("verif", "1");
  if (f.soloFavoritos) p.set("fav", "1");
  if (f.texto) p.set("texto", f.texto);
  if (f.orden !== "recomendados") p.set("orden", f.orden);
  if (f.busqueda) p.set("busqueda", f.busqueda);
  if (f.pagina > 1) p.set("pagina", String(f.pagina));
  return `${ruta}?${p.toString()}`;
}

/** URL para una frase nueva de "Buscá con IA": reemplaza todos los filtros y deja que el servidor interprete. */
export function hrefFrase(ruta: string, frase: string, busqueda: string | null) {
  const p = new URLSearchParams();
  if (frase.trim()) p.set("q", frase.trim());
  if (busqueda) p.set("busqueda", busqueda);
  const qs = p.toString();
  return qs ? `${ruta}?${qs}` : ruta;
}

/** Cantidad de condiciones que achican el listado (para el "Limpiar" y el estado vacío). */
export function filtrosActivos(f: FiltrosDocentes) {
  return (
    (f.categoria ? 1 : 0) +
    f.disciplinas.length +
    f.zonas.length +
    f.disponibilidad.length +
    (f.nivel ? 1 : 0) +
    (f.tipo ? 1 : 0) +
    (f.soloVerificados ? 1 : 0) +
    (f.soloFavoritos ? 1 : 0) +
    (f.texto ? 1 : 0)
  );
}
