import type { CategoriaDocente } from "@/db/schema";
import { fechaLarga } from "@/lib/fechas-curso";

/*
 * Ayuda para publicar una búsqueda: arma un título, una descripción y unos requisitos de partida con lo que la institución ya
 * completó en el formulario (categoría, disciplina, nivel, tipo, carga horaria, turno, inicio y zona). Es una plantilla, no un
 * modelo: no hay ninguna IA detrás ni cuesta nada. Cada campo tiene varias redacciones (`VARIANTES`) y quien publica puede pedir
 * otra mientras no haya tocado el texto.
 *
 * Qué NO hace: no inventa condiciones ni promesas (no propone beneficios ni sueldos). Lo único que suma, además de los datos
 * cargados, son las tareas y los requisitos HABITUALES de cada categoría (como "Título de guardavidas vigente"), que la
 * institución siempre puede editar o borrar. Funciones puras.
 */

export type DatosParaRedactar = {
  categoria: CategoriaDocente;
  disciplina: string;
  nivel: string;
  tipo: string;
  cargaHoraria: string;
  turno: string;
  /** "2027-03-10" o vacío. */
  fechaInicio: string;
  zona: string;
};

/** Cuántas redacciones tiene cada campo. */
export const VARIANTES = { puesto: 3, descripcion: 3, requisitos: 2 } as const;

/** La variante pedida, siempre dentro de las que hay (0, 1, 2, 0, 1…). */
const variante = (n: number, total: number) => ((Math.trunc(n) % total) + total) % total;

/**
 * Disciplinas del catálogo que ya son un puesto en sí mismas ("Profe de Apoyo escolar" no se dice): cómo se nombran en una frase.
 */
const PUESTOS_PROPIOS: Record<string, string> = {
  "Maestro/a de grado": "maestro/a de grado",
  "Nivel Inicial": "docente de nivel inicial",
  "Apoyo escolar": "docente de apoyo escolar",
  Psicopedagogía: "psicopedagogo/a",
};

const SUFIJO_DE_TIPO: Record<string, string> = {
  Suplencia: "suplencia",
  "Suplencia rápida": "suplencia urgente",
  Temporada: "temporada",
  Freelance: "por horas",
};

const limpio = (t: string) => t.trim().replace(/\s+/g, " ");
const minusculaInicial = (t: string) => (t ? t[0]!.toLowerCase() + t.slice(1) : t);
/** Cómo se nombra una disciplina que ya es un puesto; `undefined` para cualquier otra (solo claves propias: una disciplina escrita a mano no puede pisar `Object`). */
const puestoPropio = (disciplina: string): string | undefined => (Object.hasOwn(PUESTOS_PROPIOS, disciplina) ? PUESTOS_PROPIOS[disciplina] : undefined);

/** "para nivel secundario", "para adultos"… o vacío si no se completó el nivel. */
function nivelEnFrase(nivel: string): string {
  const n = limpio(nivel);
  if (!n) return "";
  if (n === "Adultos") return "adultos";
  if (n === "No formal (club)") return "actividades de club";
  return `nivel ${n.toLowerCase()}`;
}

/** Cómo se dice el turno dentro de un título o una frase corta. */
function turnoCorto(turno: string): string {
  if (turno === "Contraturno") return "contraturno";
  if (turno === "Fin de semana") return "fines de semana";
  return turno ? `turno ${turno.toLowerCase()}` : "";
}

/* ───────────────────────────── Título ───────────────────────────── */

/** "Profe de Inglés — Secundario (suplencia)" */
function puestoBase(d: DatosParaRedactar): string {
  const disciplina = limpio(d.disciplina);
  let base: string;
  if (d.categoria === "guardavidas") base = `Guardavidas — ${disciplina}`;
  else if (puestoPropio(disciplina)) base = disciplina;
  else if (d.categoria === "entrenador") base = `Entrenador/a de ${disciplina}`;
  else base = `Profe de ${disciplina}`;
  const nivel = limpio(d.nivel);
  // Un guardavidas, un puesto que ya nombra el nivel o un club (sin nivel escolar) no lo repiten.
  if (nivel && nivel !== "No formal (club)" && d.categoria !== "guardavidas" && !base.includes(nivel)) base += ` — ${nivel}`;
  const sufijo = SUFIJO_DE_TIPO[d.tipo];
  return sufijo ? `${base} (${sufijo})` : base;
}

/**
 * Tres títulos: el directo, "Se busca …" y uno con el turno (o la zona) al final. Nunca pasan de 120 caracteres, el máximo del campo.
 * 0 · "Profe de Inglés — Secundario (suplencia)"  1 · "Se busca profe de Inglés — Secundario (suplencia)"
 * 2 · "Profe de Inglés — Secundario (suplencia) · turno mañana"
 */
export function sugerirPuesto(d: DatosParaRedactar, n = 0): string {
  if (!limpio(d.disciplina)) return "";
  const base = puestoBase(d);
  let texto: string;
  switch (variante(n, VARIANTES.puesto)) {
    case 1:
      texto = `Se busca ${minusculaInicial(base)}`;
      break;
    case 2: {
      const zonaCorta = limpio(d.zona).split(",")[0] ?? "";
      const detalle = turnoCorto(d.turno) || zonaCorta;
      texto = detalle ? `${base} · ${detalle}` : `Necesitamos ${minusculaInicial(base)}`;
      break;
    }
    default:
      texto = base;
  }
  return texto.length > 120 ? `${texto.slice(0, 117).trimEnd()}…` : texto;
}

/* ───────────────────────────── Descripción ───────────────────────────── */

const FRASE_DE_TIPO: Record<string, string> = {
  Titular: "Es un cargo titular.",
  Suplencia: "Es una suplencia.",
  "Suplencia rápida": "Es una suplencia urgente: necesitamos cubrirla cuanto antes.",
  Temporada: "Es una contratación de temporada.",
  Freelance: "Se trabaja por hora, de forma independiente.",
};

const NOMBRE_DE_TIPO: Record<string, string> = {
  Titular: "Cargo titular",
  Suplencia: "Suplencia",
  "Suplencia rápida": "Suplencia urgente",
  Temporada: "Temporada",
  Freelance: "Por hora (freelance)",
};

const FRASE_DE_TURNO: Record<string, string> = {
  Mañana: "Se trabaja en turno mañana.",
  Tarde: "Se trabaja en turno tarde.",
  Contraturno: "Se trabaja en contraturno.",
  "Mañana y tarde": "Se trabaja en turno mañana y tarde.",
  Noche: "Se trabaja en turno noche.",
  "Fin de semana": "Se trabaja los fines de semana.",
};

/** "profesor/a de Inglés para nivel secundario", "guardavidas para pileta cubierta"… (sin el verbo). */
function quienSeBusca(d: DatosParaRedactar): string {
  const disciplina = limpio(d.disciplina);
  if (d.categoria === "guardavidas") return `guardavidas para ${disciplina.toLowerCase()}`;
  const propio = puestoPropio(disciplina);
  const puesto = propio ?? `${d.categoria === "entrenador" ? "entrenador/a" : "profesor/a"} de ${disciplina}`;
  const nivel = nivelEnFrase(d.nivel);
  // "docente de nivel inicial" ya dice el nivel: no se repite.
  return nivel && !puesto.toLowerCase().includes(nivel) ? `${puesto} para ${nivel}` : puesto;
}

/** Las condiciones que sí se cargaron, una frase cada una; lo que falta no aparece. */
function frasesDeCondiciones(d: DatosParaRedactar): string[] {
  const frases: string[] = [];
  const carga = limpio(d.cargaHoraria);
  if (carga) frases.push(`La carga horaria es de ${carga}.`);
  if (FRASE_DE_TURNO[d.turno]) frases.push(FRASE_DE_TURNO[d.turno]!);
  if (/^\d{4}-\d{2}-\d{2}$/.test(d.fechaInicio)) frases.push(`La fecha de inicio es el ${fechaLarga(d.fechaInicio)}.`);
  const zona = limpio(d.zona);
  if (zona) frases.push(`Zona de trabajo: ${zona}.`);
  return frases;
}

/** Las tareas habituales de cada categoría: son de partida y la institución las ajusta, como los requisitos. */
function tareasHabituales(d: DatosParaRedactar): string[] {
  const disciplina = limpio(d.disciplina);
  const deLaMateria = puestoPropio(disciplina) ? "" : ` de ${disciplina}`;
  if (d.categoria === "guardavidas") {
    return [
      "Vigilar el espacio acuático durante toda la actividad.",
      "Actuar ante una emergencia con primeros auxilios y RCP.",
      "Hacer cumplir las normas de seguridad del lugar.",
    ];
  }
  if (d.categoria === "entrenador") {
    return [
      `Planificar y dirigir las clases y entrenamientos${deLaMateria}.`,
      "Acompañar el progreso de cada persona o grupo.",
      "Cuidar la seguridad en la actividad y en el uso del equipamiento.",
    ];
  }
  return [
    `Planificar y dictar las clases${deLaMateria}.`,
    "Evaluar y acompañar el avance del grupo.",
    "Trabajar en equipo con el resto del plantel.",
  ];
}

const CIERRE = "Si te interesa, postulate desde UNIDOAR.";

/**
 * Tres redacciones de la descripción, todas con lo que se completó y nada más que eso (más las tareas habituales de la primera):
 * 0 · completa: quién se busca, condiciones y "Qué vas a hacer".  1 · breve: un solo párrafo.  2 · en lista: datos con su título.
 * Sin disciplina no hay nada que redactar.
 */
export function sugerirDescripcion(d: DatosParaRedactar, n = 0): string {
  if (!limpio(d.disciplina)) return "";
  const quien = quienSeBusca(d);
  const frasesTipo = FRASE_DE_TIPO[d.tipo] ? [FRASE_DE_TIPO[d.tipo]!] : [];
  const condiciones = frasesDeCondiciones(d);

  switch (variante(n, VARIANTES.descripcion)) {
    case 1:
      return [`Buscamos ${quien}.`, ...frasesTipo, ...condiciones, CIERRE].join(" ");
    case 2: {
      const datos: [string, string][] = [];
      if (NOMBRE_DE_TIPO[d.tipo]) datos.push(["Tipo de cargo", NOMBRE_DE_TIPO[d.tipo]!]);
      if (limpio(d.cargaHoraria)) datos.push(["Carga horaria", limpio(d.cargaHoraria)]);
      if (d.turno) datos.push(["Turno", d.turno]);
      if (/^\d{4}-\d{2}-\d{2}$/.test(d.fechaInicio)) datos.push(["Inicio", fechaLarga(d.fechaInicio)]);
      if (limpio(d.zona)) datos.push(["Zona", limpio(d.zona)]);
      const bloques = [`Se busca ${quien}.`];
      if (datos.length > 0) bloques.push(datos.map(([titulo, valor]) => `• ${titulo}: ${valor}`).join("\n"));
      bloques.push(CIERRE);
      return bloques.join("\n\n");
    }
    default: {
      const apertura = [`Buscamos ${quien}.`, ...frasesTipo, ...condiciones].join(" ");
      const tareas = tareasHabituales(d).map((t) => `• ${t}`).join("\n");
      return [apertura, `Qué vas a hacer:\n${tareas}`, CIERRE].join("\n\n");
    }
  }
}

/* ───────────────────────────── Requisitos ───────────────────────────── */

/**
 * Requisitos de partida (uno por línea) según la categoría. Son los habituales: la institución los ajusta.
 * 0 · esenciales (los de siempre).  1 · ampliados: suma el certificado de buena conducta, la disponibilidad y las referencias.
 */
export function sugerirRequisitos(d: DatosParaRedactar, n = 0): string {
  const disciplina = limpio(d.disciplina);
  if (!disciplina) return "";
  const nivel = limpio(d.nivel);
  const lineas =
    d.categoria === "guardavidas"
      ? ["Título de guardavidas vigente", "Curso de RCP y primeros auxilios al día"]
      : d.categoria === "entrenador"
        ? [`Título o certificación en ${disciplina}`, "Experiencia dictando clases o entrenando grupos"]
        : ["Título docente o en trámite", ...(nivel ? [`Experiencia en nivel ${nivel.toLowerCase()}`] : [])];

  if (variante(n, VARIANTES.requisitos) === 1) {
    lineas.push("Certificado de buena conducta vigente");
    if (d.categoria === "guardavidas") lineas.push("Apto médico al día");
    else if (d.categoria === "entrenador") lineas.push("Conocimientos de primeros auxilios (deseable)");
    const turno = turnoCorto(d.turno);
    if (turno) lineas.push(`Disponibilidad horaria para ${turno}`);
    lineas.push("Referencias de trabajos anteriores");
  }
  return lineas.join("\n");
}
