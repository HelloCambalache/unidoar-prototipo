import { CATEGORIA_INFO } from "@/lib/catalogo";
import type { CategoriaDocente } from "@/db/schema";

/*
 * "Buscá con IA": convierte una frase libre ("profe de inglés para secundario, turno mañana")
 * en filtros del buscador. Hoy lo hace por reconocimiento de palabras, sin modelo detrás (no cuesta
 * nada ni sale ningún dato del servidor): entiende sinónimos ("gimnasia" es Educación Física, "pileta"
 * es Natación), errores de tipeo ("matematca"), niveles escritos de varias formas ("primer grado",
 * "sala de 4"), zonas y grupos de zonas ("capital", "zona norte") y avisa lo que NO pudo aplicar.
 * Está pensada para reemplazarse por una llamada a un modelo real: mientras devuelva la misma forma
 * ({ filtros, leido, sinEntender }), la página y los controles no cambian.
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
  /** Palabras de la frase que parecen un pedido pero no se pudieron convertir en ningún filtro ("noche", "zona oeste"). */
  sinEntender: string[];
};

/** Datos del catálogo (asignaturas y zonas de la base) para que la frase reconozca todo lo que existe. */
export type VocabularioBusqueda = { disciplinas?: string[]; zonas?: string[] };

/**
 * `buscaTrabajo`: la frase la escribe un profesional que busca una oferta (no una institución que busca gente). Los turnos
 * se leen como los de una oferta ("Mañana", "Noche", "Fin de semana": los valores de `TURNOS`) y `disponibilidad` los
 * devuelve con ese mismo nombre, no con los del perfil de un profesional.
 */
export type OpcionesDeBusqueda = { buscaTrabajo?: boolean };

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

/** Saca del texto la palabra o frase (completa) y deja un espacio. */
const sacar = (texto: string, termino: string) =>
  texto.replace(new RegExp(`(^|[^a-z0-9])${escaparRegex(termino)}(?=$|[^a-z0-9])`, "g"), "$1 ");

/** Saca del texto todo lo que coincida con la expresión. */
const sacarRe = (texto: string, re: RegExp) => texto.replace(new RegExp(re.source, "g"), " ");

/**
 * Cuántas letras hay que cambiar, sumar o quitar para pasar de una palabra a otra. Corta apenas supera `tope`
 * (devuelve `tope + 1`), así comparar contra todo el vocabulario sale barato.
 */
export function distanciaDeEdicion(a: string, b: string, tope: number): number {
  if (Math.abs(a.length - b.length) > tope) return tope + 1;
  let previa = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const actual = [i];
    let minimo = i;
    for (let j = 1; j <= b.length; j++) {
      const costo = a[i - 1] === b[j - 1] ? 0 : 1;
      const valor = Math.min(previa[j]! + 1, actual[j - 1]! + 1, previa[j - 1]! + costo);
      actual.push(valor);
      if (valor < minimo) minimo = valor;
    }
    if (minimo > tope) return tope + 1;
    previa = actual;
  }
  return previa[b.length]!;
}

/** Cuántos errores de tipeo se toleran según el largo: nada en palabras cortas (se confundirían con otras). */
const tolerancia = (largo: number) => (largo >= 11 ? 2 : largo >= 5 ? 1 : 0);

/** Disciplinas base del prototipo; el catálogo de la base se suma encima. */
const DISCIPLINAS_BASE = [
  "Inglés", "Matemática", "Lengua", "Historia", "Geografía", "Biología", "Química", "Física", "Música",
  "Plástica", "Teatro", "Danza", "Educación Física", "Natación", "Fútbol", "Vóley", "Básquet", "Tenis",
  "Yoga", "Pilates", "Informática", "Portugués",
];

/**
 * Cómo se suele pedir en lugar del nombre del catálogo (todo sin tildes ni mayúsculas). Un alias solo se usa si
 * la disciplina existe en el catálogo: si no, filtraría por algo que no hay.
 */
const ALIAS_DISCIPLINA: Record<string, string[]> = {
  "Educación Física": ["ed fisica", "ed. fisica", "edfisica", "gimnasia", "gym", "educacion fisica escolar"],
  Matemática: ["mate", "algebra", "geometria", "calculo"],
  Lengua: ["lenguaje", "castellano", "practicas del lenguaje", "lengua y literatura"],
  "Ciencias Naturales": ["naturales"],
  "Ciencias Sociales": ["sociales"],
  "Formación Ética": ["etica", "formacion etica y ciudadana", "civica", "ciudadania"],
  Informática: ["computacion", "programacion", "robotica", "sistemas", "tecnologia"],
  Natación: ["pileta", "nado", "nadar", "clases de nado"],
  Vóley: ["voley", "voleibol", "volleyball"],
  Básquet: ["basquet", "basket", "basketball", "basquetbol"],
  Handball: ["handbol", "balonmano"],
  Fútbol: ["futbol 5", "futbol 11", "soccer"],
  "Artes marciales": ["karate", "judo", "taekwondo", "kung fu", "jiu jitsu", "muay thai", "aikido"],
  Funcional: ["fitness", "crossfit", "entrenamiento funcional"],
  "Entrenamiento personal": ["personal trainer"],
  "Preparación física": ["preparador fisico", "preparadora fisica"],
  Danza: ["baile", "bailar", "folklore", "tango", "ritmos"],
  Teatro: ["actuacion", "teatral"],
  Plástica: ["dibujo", "pintura", "artes plasticas", "arte"],
  Audiovisuales: ["cine", "fotografia", "video"],
  Música: ["canto", "guitarra", "piano", "coro"],
  Psicopedagogía: ["psicopedagoga", "psicopedagogo", "psicopedagogica"],
  "Apoyo escolar": ["apoyo", "maestra particular", "maestro particular", "tutor", "tutora", "tutoria"],
  "Colonia de vacaciones": ["colonia"],
  Inglés: ["english"],
};

/** Zonas que se piden por un nombre distinto del que tienen en el catálogo, o por grupos de varias. */
const ALIAS_ZONA: Record<string, string[]> = {
  "capital federal": ["CABA"],
  "ciudad de buenos aires": ["CABA"],
  capital: ["CABA"],
  caba: ["CABA"],
  "zona norte": ["Vicente López", "San Isidro", "Tigre"],
  "gba norte": ["Vicente López", "San Isidro", "Tigre"],
};

const NIVELES_IA: [RegExp, string][] = [
  [/(^|[^a-z])(inicial|jardin|jardinera|preescolar|maternal|salita)($|[^a-z])|sala de \d/, "Inicial"],
  [/primari|(^|[^a-z])(\d[°º]?(ro|do|er|to|mo)?|primer|segundo|tercer|cuarto|quinto|sexto|septimo) grado|(^|[^a-z])(grado|egb)($|[^a-z])/, "Primario"],
  [/secundari|polimodal|ciclo basico|ciclo orientado/, "Secundario"],
  [/terciari|universitari|universidad|profesorado|facultad/, "Terciario"],
  [/adultos|adulto|tercera edad/, "Adultos"],
];

const TURNOS_IA: [RegExp, string][] = [
  [/(^|[^a-z])(a la |por la |de la |de |en la |turno )?manana($|[^a-z])/, "Turno mañana"],
  [/(^|[^a-z])(a la |por la |de la |de |en la |turno )?(tarde|tardecita)($|[^a-z])/, "Turno tarde"],
  [/sabado|contraturno|fin(es)? de semana/, "Contraturno / sábados"],
  [/full ?time|tiempo completo|jornada completa|doble turno/, "Full time"],
];

/** Turnos de una oferta (valores de `TURNOS`) y cómo se muestran al entenderlos. */
const TURNOS_DE_OFERTA: [RegExp, string, string][] = [
  [/(^|[^a-z])(a la |por la |de la |de |en la |turno )?manana($|[^a-z])/, "Mañana", "Turno mañana"],
  [/(^|[^a-z])(a la |por la |de la |de |en la |turno )?(tarde|tardecita)($|[^a-z])/, "Tarde", "Turno tarde"],
  [/contraturno|contra turno/, "Contraturno", "Contraturno"],
  [/(^|[^a-z])(a la |por la |de la |de |en la |turno )?(noche|nocturno)($|[^a-z])/, "Noche", "Turno noche"],
  [/sabado|fin(es)? de semana/, "Fin de semana", "Fin de semana"],
];

/** Palabras de relleno de una frase: lo que sobra de ellas no se cuenta como "no entendimos". */
const RELLENO = new Set(
  (
    "necesito necesitamos necesitaria busco buscamos buscaria quiero queremos quisiera estoy estamos alguien algun alguna algunos " +
    "algunas algo que sea sean para por con sin del los las una uno unos unas este esta estos estas esos esas como cuando donde " +
    "cual cuales muy mas menos tambien pero solo solamente hay tengo tenemos tener favor gracias hola buenas buenos dias tardes " +
    "noches profe profes profesor profesora profesores profesoras profesional profesionales persona personas gente chicos chicas " +
    "ninos ninas alumnos alumnas chicas clase clases dar dictar dicte dicten para entre sobre desde hasta hacia segun aunque " +
    "porque asi ahi aca aqui puede puedan pueda tiene tenga tengan sepa sepan trabajar trabajo cubrir cubra cubran persona " +
    "tenes tenia tenian queres tienen nivel niveles uno dos tres cuatro cinco seis siete ocho nueve diez toque toca tocar " +
    "contratar contrate contratamos incorporar sumar preferentemente preferiblemente ideal idealmente cerca zona zonas lugar lado nuestro nuestra nuestros nuestras " +
    "colegio escuela instituto club institucion buena bueno buen buenos experiencia horas hora semana semanas mes meses anos " +
    "ano dia dias vez veces cada todo toda todos todas otro otra otros otras nada demas incluso"
  ).split(" "),
);

export function interpretarBusqueda(
  texto: string,
  vocabulario: VocabularioBusqueda = {},
  opciones: OpcionesDeBusqueda = {},
): Interpretacion {
  const original = normalizarTexto(texto);
  const filtros: FiltrosIA = {};
  const leido: string[] = [];
  if (!original) return { filtros, leido, reconocido: false, sinEntender: [] };

  // "Mañana" puede ser el turno o el "para mañana mismo" de una urgencia: lo segundo se saca antes.
  const urgente =
    /(^|[^a-z])(urgente|urgentes|urgencia|rapid[oa]s?|hoy|ya)($|[^a-z])|cuanto antes|lo antes posible|(para|desde|hasta) manana|manana mismo/.test(
      original,
    );
  let q = sacarRe(original, /(para|desde|hasta) manana|manana mismo|cuanto antes|lo antes posible/);
  q = sacarRe(q, /(^|[^a-z])(urgente|urgentes|urgencia|rapid[oa]s?|hoy|ya)(?=$|[^a-z])/);

  /* ───────────── Disciplinas: exactas, por sinónimo y con errores de tipeo ───────────── */
  const catalogo = new Map<string, string>();
  for (const d of [...DISCIPLINAS_BASE, ...(vocabulario.disciplinas ?? [])]) catalogo.set(normalizarTexto(d), d);
  const candidatas = new Map<string, string>(catalogo);
  for (const [nombre, alias] of Object.entries(ALIAS_DISCIPLINA)) {
    const canonico = catalogo.get(normalizarTexto(nombre));
    if (canonico) for (const a of alias) if (!candidatas.has(a)) candidatas.set(a, canonico);
  }
  // Las más largas primero y se quitan del texto al reconocerlas ("educación física" no suma también "física").
  const porLargo = [...candidatas.entries()].sort((a, b) => b[0].length - a[0].length);
  const encontradas: { nombre: string; posicion: number }[] = [];
  const sumarDisciplina = (nombre: string, termino: string) => {
    if (encontradas.length < 3 && !encontradas.some((d) => d.nombre === nombre)) {
      encontradas.push({ nombre, posicion: Math.max(0, original.search(new RegExp(escaparRegex(termino)))) });
    }
  };
  for (const [clave, nombre] of porLargo) {
    if (contiene(q, clave)) {
      sumarDisciplina(nombre, clave);
      q = sacar(q, clave);
    }
  }
  // Errores de tipeo: una palabra de la frase casi igual a una disciplina de una sola palabra ("matematca", "natacion").
  if (encontradas.length < 3) {
    for (const palabra of q.match(/[a-z0-9]{5,}/g) ?? []) {
      if (RELLENO.has(palabra)) continue;
      const tope = tolerancia(palabra.length);
      const parecida = porLargo.find(
        ([clave]) => !clave.includes(" ") && clave[0] === palabra[0] && clave.length >= 5 && distanciaDeEdicion(palabra, clave, tope) <= tope,
      );
      if (parecida) {
        sumarDisciplina(parecida[1], palabra);
        q = sacar(q, palabra);
      }
    }
  }
  // En el orden en que la persona las nombró: la primera es la que manda cuando una pantalla solo puede usar una.
  const disciplinas = encontradas.sort((a, b) => a.posicion - b.posicion).map((d) => d.nombre);
  if (disciplinas.length) {
    filtros.disciplinas = disciplinas;
    leido.push(...disciplinas);
  }

  /* ───────────── Zonas: del catálogo, "capital", "zona norte" y con errores de tipeo ───────────── */
  const zonasCatalogo = vocabulario.zonas ?? [];
  const delCatalogo = (nombre: string) => zonasCatalogo.find((z) => normalizarTexto(z) === normalizarTexto(nombre));
  const zonas: string[] = [];
  /** Lo que se muestra como entendido: el nombre del grupo ("Zona norte") o de cada zona suelta. */
  const etiquetasDeZona: string[] = [];
  const sumarZona = (z: string) => {
    if (zonas.length < 6 && !zonas.includes(z)) zonas.push(z);
  };
  // Grupos y nombres alternativos primero (los más largos antes: "zona norte" antes que "norte").
  for (const [frase, destino] of Object.entries(ALIAS_ZONA).sort((a, b) => b[0].length - a[0].length)) {
    if (!contiene(q, frase)) continue;
    const existentes = destino.map(delCatalogo).filter((z): z is string => Boolean(z));
    if (existentes.length === 0) continue;
    for (const z of existentes) sumarZona(z);
    etiquetasDeZona.push(existentes.length > 1 ? frase.charAt(0).toUpperCase() + frase.slice(1) : existentes[0]!);
    q = sacar(q, frase);
  }
  const zonasPorLargo = [...zonasCatalogo].sort((a, b) => b.length - a.length);
  for (const zona of zonasPorLargo) {
    const clave = normalizarTexto(zona);
    if (!clave || zonas.length >= 6 || zonas.includes(zona)) continue;
    if (contiene(q, clave)) {
      sumarZona(zona);
      etiquetasDeZona.push(zona);
      q = sacar(q, clave);
    }
  }
  // Errores de tipeo en zonas de una sola palabra ("martines", "tigree").
  for (const palabra of q.match(/[a-z]{6,}/g) ?? []) {
    if (RELLENO.has(palabra) || zonas.length >= 6) continue;
    const tope = tolerancia(palabra.length);
    const parecida = zonasPorLargo.find((z) => {
      const clave = normalizarTexto(z);
      return !clave.includes(" ") && clave[0] === palabra[0] && !zonas.includes(z) && distanciaDeEdicion(palabra, clave, tope) <= tope;
    });
    if (parecida) {
      sumarZona(parecida);
      etiquetasDeZona.push(parecida);
      q = sacar(q, palabra);
    }
  }
  if (zonas.length) {
    filtros.zonas = zonas;
    leido.push(...new Set(etiquetasDeZona));
  }

  /* ───────────── Categoría: solo con palabras inequívocas ("profe de natación" no alcanza para fijarla) ───────────── */
  let categoria: CategoriaDocente | undefined;
  if (/guardavida|salvavida|socorrista/.test(q)) categoria = "guardavidas";
  else if (/entrenador|entrenadora|instructor|instructora|preparador|(^|[^a-z])coach($|[^a-z])|personal trainer/.test(q)) categoria = "entrenador";
  else if (/maestr[oa]|docente/.test(q)) categoria = "educador";
  if (categoria) {
    filtros.categoria = categoria;
    leido.push(CATEGORIA_INFO[categoria].label);
    q = sacarRe(q, /guardavidas?|salvavidas?|socorrista|entrenador(a|es|as)?|instructor(a|es|as)?|preparador(a|es|as)?|coach|maestr[oa]s?|docentes?/);
  }

  /* ───────────── Nivel ───────────── */
  for (const [re, nivel] of NIVELES_IA) {
    if (re.test(q)) {
      filtros.nivel = nivel;
      leido.push(nivel);
      q = sacarRe(q, re);
      break;
    }
  }

  /* ───────────── Tipo de búsqueda ───────────── */
  if (urgente) {
    filtros.rapidas = true;
    leido.push("Búsqueda rápida");
  } else if (/suplencia|suplente|reemplazo|licencia/.test(q)) {
    filtros.tipo = "Suplencia";
    leido.push("Suplencia");
    q = sacarRe(q, /suplencias?|suplentes?|reemplazos?|licencias?/);
  } else if (/titular|de planta|cargo estable/.test(q)) {
    filtros.tipo = "Titular";
    leido.push("Titular");
    q = sacarRe(q, /titular(es)?|de planta|cargo estable/);
  } else if (/temporada|verano/.test(q)) {
    filtros.tipo = "Temporada";
    leido.push("Temporada");
    q = sacarRe(q, /temporada|verano/);
  } else if (/freelance|por hora|independiente/.test(q)) {
    filtros.tipo = "Freelance";
    leido.push("Freelance");
    q = sacarRe(q, /freelance|por hora|independiente/);
  }

  /* ───────────── Turnos ───────────── */
  if (opciones.buscaTrabajo) {
    const turnos = TURNOS_DE_OFERTA.filter(([re]) => re.test(q));
    if (turnos.length) {
      for (const [re] of TURNOS_DE_OFERTA) q = sacarRe(q, re);
      filtros.disponibilidad = turnos.map(([, valor]) => valor);
      leido.push(...turnos.map(([, , etiqueta]) => etiqueta));
    }
  } else {
    const disponibilidad = TURNOS_IA.filter(([re]) => re.test(q)).map(([, turno]) => turno);
    if (disponibilidad.length) {
      for (const [re] of TURNOS_IA) q = sacarRe(q, re);
      filtros.disponibilidad = disponibilidad;
      leido.push(...disponibilidad);
    }
  }

  /* ───────────── Verificados y favoritos ───────────── */
  if (/verificad|con titulo|titulad|graduad|recibid/.test(q)) {
    filtros.soloVerificados = true;
    leido.push("Sólo verificados");
    q = sacarRe(q, /verificad[oa]s?|con titulo|titulad[oa]s?|graduad[oa]s?|recibid[oa]s?/);
  }
  if (/favorit|guardados/.test(q)) {
    filtros.soloFavoritos = true;
    leido.push("Favoritos");
    q = sacarRe(q, /favorit[oa]s?|guardad[oa]s?/);
  }

  /* ───────────── Lo que no se pudo aplicar ───────────── */
  // Las palabras que quedaron y no son relleno, con la forma en que las escribió la persona.
  const sobrantes = new Set((q.match(/[a-z0-9]+/g) ?? []).filter((p) => p.length >= 4 && !/^\d+$/.test(p) && !RELLENO.has(p)));
  const sinEntender: string[] = [];
  for (const palabra of texto.match(/[\p{L}\p{N}]+/gu) ?? []) {
    const clave = normalizarTexto(palabra);
    if (sobrantes.has(clave) && !sinEntender.some((s) => normalizarTexto(s) === clave)) sinEntender.push(palabra);
    if (sinEntender.length >= 4) break;
  }

  return { filtros, leido, reconocido: leido.length > 0, sinEntender };
}
