import type { CategoriaDocente } from "@/db/schema";
import { fechaLarga } from "@/lib/fechas-curso";

/*
 * Ayuda para publicar una búsqueda: arma un título, una descripción y unos requisitos de partida con lo que la institución ya
 * completó en el formulario (categoría, disciplina, nivel, tipo, carga horaria, turno, inicio y zona). Es una plantilla, no un
 * modelo: no inventa nada que la institución no haya cargado (no propone beneficios ni sueldos) y siempre queda editable.
 * Funciones puras.
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

/** Disciplinas del catálogo que ya son un puesto en sí mismas: "Profe de Apoyo escolar" no se dice. */
const PUESTOS_PROPIOS = new Set(["Maestro/a de grado", "Nivel Inicial", "Apoyo escolar", "Psicopedagogía"]);

const SUFIJO_DE_TIPO: Record<string, string> = {
  Suplencia: "suplencia",
  "Suplencia rápida": "suplencia urgente",
  Temporada: "temporada",
  Freelance: "por horas",
};

const limpio = (t: string) => t.trim().replace(/\s+/g, " ");

/** "Profe de Inglés — Secundario (suplencia)" */
export function sugerirPuesto(d: DatosParaRedactar): string {
  const disciplina = limpio(d.disciplina);
  if (!disciplina) return "";
  let base: string;
  if (d.categoria === "guardavidas") base = `Guardavidas — ${disciplina}`;
  else if (PUESTOS_PROPIOS.has(disciplina)) base = disciplina;
  else if (d.categoria === "entrenador") base = `Entrenador/a de ${disciplina}`;
  else base = `Profe de ${disciplina}`;
  const nivel = limpio(d.nivel);
  // Un guardavidas o un puesto que ya nombra el nivel no lo repiten.
  if (nivel && d.categoria !== "guardavidas" && !base.includes(nivel)) base += ` — ${nivel}`;
  const sufijo = SUFIJO_DE_TIPO[d.tipo];
  return sufijo ? `${base} (${sufijo})` : base;
}

const FRASE_DE_TIPO: Record<string, string> = {
  Titular: "Es un cargo titular.",
  Suplencia: "Es una suplencia.",
  "Suplencia rápida": "Es una suplencia urgente: necesitamos cubrirla cuanto antes.",
  Temporada: "Es una contratación de temporada.",
  Freelance: "Se trabaja por hora, de forma independiente.",
};

const FRASE_DE_TURNO: Record<string, string> = {
  Mañana: "Se trabaja en turno mañana.",
  Tarde: "Se trabaja en turno tarde.",
  Contraturno: "Se trabaja en contraturno.",
  "Mañana y tarde": "Se trabaja en turno mañana y tarde.",
  Noche: "Se trabaja en turno noche.",
  "Fin de semana": "Se trabaja los fines de semana.",
};

/** Una descripción de partida con lo que ya se completó; cada dato que falta simplemente no aparece. */
export function sugerirDescripcion(d: DatosParaRedactar): string {
  const disciplina = limpio(d.disciplina);
  if (!disciplina) return "";
  const nivel = limpio(d.nivel).toLowerCase();
  const frases: string[] = [];

  if (d.categoria === "guardavidas") frases.push(`Buscamos guardavidas para ${disciplina.toLowerCase()}.`);
  else if (PUESTOS_PROPIOS.has(disciplina)) frases.push(`Buscamos ${disciplina.toLowerCase()}${nivel ? ` para nivel ${nivel}` : ""}.`);
  else {
    const rol = d.categoria === "entrenador" ? "entrenador/a" : "profesor/a";
    frases.push(`Buscamos ${rol} de ${disciplina}${nivel ? ` para nivel ${nivel}` : ""}.`);
  }

  if (FRASE_DE_TIPO[d.tipo]) frases.push(FRASE_DE_TIPO[d.tipo]!);
  const carga = limpio(d.cargaHoraria);
  if (carga) frases.push(`La carga horaria es de ${carga}.`);
  if (FRASE_DE_TURNO[d.turno]) frases.push(FRASE_DE_TURNO[d.turno]!);
  if (/^\d{4}-\d{2}-\d{2}$/.test(d.fechaInicio)) frases.push(`La fecha de inicio es el ${fechaLarga(d.fechaInicio)}.`);
  const zona = limpio(d.zona);
  if (zona) frases.push(`Zona de trabajo: ${zona}.`);
  frases.push("Si te interesa, postulate desde UNIDOAR.");
  return frases.join(" ");
}

/** Requisitos de partida (uno por línea) según la categoría. Son los habituales: la institución los ajusta. */
export function sugerirRequisitos(d: DatosParaRedactar): string {
  const disciplina = limpio(d.disciplina);
  if (!disciplina) return "";
  const nivel = limpio(d.nivel);
  const lineas =
    d.categoria === "guardavidas"
      ? ["Título de guardavidas vigente", "Curso de RCP y primeros auxilios al día"]
      : d.categoria === "entrenador"
        ? [`Título o certificación en ${disciplina}`, "Experiencia dictando clases o entrenando grupos"]
        : ["Título docente o en trámite", ...(nivel ? [`Experiencia en nivel ${nivel.toLowerCase()}`] : [])];
  return lineas.join("\n");
}
