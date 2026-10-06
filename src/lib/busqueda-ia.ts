import { CATEGORIA_INFO } from "@/lib/catalogo";
import type { CategoriaDocente } from "@/db/schema";

/*
 * "Buscá con IA": convierte una frase libre ("profe de inglés para secundario, turno mañana")
 * en filtros del buscador. Hoy lo hace por reconocimiento de palabras clave, sin modelo detrás
 * (igual que el prototipo). Está pensada para reemplazarse por una llamada a un modelo real:
 * mientras devuelva la misma forma ({ filtros, leido }), la página y los controles no cambian.
 * Es una función pura y se llama siempre del lado del servidor, leyendo ?q=.
 */

export type FiltrosIA = {
  categoria?: CategoriaDocente;
  disciplinas?: string[];
  zonas?: string[];
  disponibilidad?: string[];
  nivel?: string;
  tipo?: string;
  soloVerificados?: true;
  soloFavoritos?: true;
  /** Pide docentes disponibles ya: la página la resuelve yendo a /institucion/busquedas-rapidas. */
  rapidas?: true;
};

export type Interpretacion = {
  filtros: FiltrosIA;
  /** Lo que se entendió, listo para mostrar como chips ("Inglés", "Secundario", "Turno mañana"…). */
  leido: string[];
  reconocido: boolean;
};

/** Datos del catálogo (asignaturas y zonas de la base) para que la frase reconozca todo lo que existe. */
export type VocabularioBusqueda = { disciplinas?: string[]; zonas?: string[] };

/** "Educación Física" → "educacion fisica": minúsculas y sin tildes, para comparar. */
export function normalizarTexto(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const escaparRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Palabra o frase completa dentro del texto ya normalizado. */
const contiene = (texto: string, termino: string) =>
  new RegExp(`(^|[^a-z0-9])${escaparRegex(termino)}($|[^a-z0-9])`).test(texto);

/** Disciplinas base del prototipo; el catálogo de la base se suma encima. */
const DISCIPLINAS_BASE = [
  "Inglés", "Matemática", "Lengua", "Historia", "Geografía", "Biología", "Química", "Física", "Música",
  "Plástica", "Teatro", "Danza", "Educación Física", "Natación", "Fútbol", "Vóley", "Básquet", "Tenis",
  "Yoga", "Pilates", "Informática", "Portugués",
];

/** Cómo se suele escribir en lugar del nombre del catálogo. */
const ALIAS_DISCIPLINA: Record<string, string> = {
  "ed fisica": "Educación Física",
  "ed. fisica": "Educación Física",
  mate: "Matemática",
  voley: "Vóley",
  basquet: "Básquet",
};

const NIVELES_IA: [string, string][] = [
  ["inicial", "Inicial"],
  ["jardin", "Inicial"],
  ["sala de", "Inicial"],
  ["primari", "Primario"],
  ["secundari", "Secundario"],
  ["terciari", "Terciario"],
  ["adultos", "Adultos"],
];

const TURNOS_IA: [RegExp, string][] = [
  [/(^|[^a-z])manana($|[^a-z])/, "Turno mañana"],
  [/(^|[^a-z])tarde($|[^a-z])/, "Turno tarde"],
  [/sabado|contraturno|fin(es)? de semana/, "Contraturno / sábados"],
  [/full ?time|tiempo completo|jornada completa|doble turno/, "Full time"],
];

export function interpretarBusqueda(texto: string, vocabulario: VocabularioBusqueda = {}): Interpretacion {
  const original = normalizarTexto(texto);
  const filtros: FiltrosIA = {};
  const leido: string[] = [];
  if (!original) return { filtros, leido, reconocido: false };

  // "Mañana" puede ser el turno o el "para mañana mismo" de una urgencia: lo segundo se saca antes.
  const urgente =
    /(^|[^a-z])(urgente|urgentes|urgencia|rapid[oa]s?|hoy|ya)($|[^a-z])|cuanto antes|lo antes posible|(para|desde|hasta) manana|manana mismo/.test(
      original,
    );
  let q = original.replace(/(para|desde|hasta) manana|manana mismo/g, " ");

  // Disciplinas: las más largas primero, y se quitan del texto al reconocerlas
  // ("educación física" no tiene que sumar también "física").
  const catalogo = new Map<string, string>();
  for (const d of [...DISCIPLINAS_BASE, ...(vocabulario.disciplinas ?? [])]) catalogo.set(normalizarTexto(d), d);
  const candidatas: [string, string][] = [...catalogo.entries(), ...Object.entries(ALIAS_DISCIPLINA)];
  candidatas.sort((a, b) => b[0].length - a[0].length);
  const disciplinas: string[] = [];
  for (const [clave, nombre] of candidatas) {
    if (disciplinas.length >= 3 || disciplinas.includes(nombre)) continue;
    if (contiene(q, clave)) {
      disciplinas.push(nombre);
      q = q.replace(new RegExp(escaparRegex(clave), "g"), " ");
    }
  }
  if (disciplinas.length) {
    filtros.disciplinas = disciplinas;
    leido.push(...disciplinas);
  }

  // Zonas del catálogo.
  const zonas: string[] = [];
  const porLargo = [...(vocabulario.zonas ?? [])].sort((a, b) => b.length - a.length);
  for (const zona of porLargo) {
    const clave = normalizarTexto(zona);
    if (!clave || zonas.length >= 3 || zonas.includes(zona)) continue;
    if (contiene(q, clave)) {
      zonas.push(zona);
      q = q.replace(new RegExp(escaparRegex(clave), "g"), " ");
    }
  }
  if (zonas.length) {
    filtros.zonas = zonas;
    leido.push(...zonas);
  }

  // Categoría: solo con palabras inequívocas ("profe de natación" no alcanza para fijarla).
  let categoria: CategoriaDocente | undefined;
  if (/guardavida|salvavida/.test(q)) categoria = "guardavidas";
  else if (/entrenador|instructor|(^|[^a-z])coach($|[^a-z])/.test(q)) categoria = "entrenador";
  else if (/maestr[oa]|docente/.test(q)) categoria = "educador";
  if (categoria) {
    filtros.categoria = categoria;
    leido.push(CATEGORIA_INFO[categoria].label);
  }

  for (const [clave, nivel] of NIVELES_IA) {
    if (q.includes(clave)) {
      filtros.nivel = nivel;
      leido.push(nivel);
      break;
    }
  }

  if (urgente) {
    filtros.rapidas = true;
    leido.push("Búsqueda rápida");
  } else if (/suplencia/.test(q)) {
    filtros.tipo = "Suplencia";
    leido.push("Suplencia");
  } else if (/titular/.test(q)) {
    filtros.tipo = "Titular";
    leido.push("Titular");
  } else if (/temporada|verano/.test(q)) {
    filtros.tipo = "Temporada";
    leido.push("Temporada");
  } else if (/freelance|por hora/.test(q)) {
    filtros.tipo = "Freelance";
    leido.push("Freelance");
  }

  const disponibilidad = TURNOS_IA.filter(([re]) => re.test(q)).map(([, turno]) => turno);
  if (disponibilidad.length) {
    filtros.disponibilidad = disponibilidad;
    leido.push(...disponibilidad);
  }

  if (/verificad|con titulo/.test(q)) {
    filtros.soloVerificados = true;
    leido.push("Sólo verificados");
  }
  if (/favorit/.test(q)) {
    filtros.soloFavoritos = true;
    leido.push("Favoritos");
  }

  return { filtros, leido, reconocido: leido.length > 0 };
}
