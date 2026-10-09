/*
 * Profesionales que todavía estudian ("Estoy estudiando"): en lugar del título presentan la constancia de alumno regular y
 * declaran el porcentaje de materias aprobadas; las instituciones lo ven en su perfil. Reglas puras (sin base ni Next) para
 * poder probarlas.
 */

/** Cuánto tiene aprobado, en %: un entero de 0 a 100. */
export const PORCENTAJE_MINIMO = 0;
export const PORCENTAJE_MAXIMO = 100;

export type LecturaDePorcentaje = { ok: true; valor: number } | { ok: false; error: string };

/**
 * Lee lo que escribió la persona: "80", "80%", " 80 % ". Solo enteros de 0 a 100; "80,5" o "ochenta" no valen (se pide un
 * número simple: no hace falta más precisión).
 */
export function leerPorcentaje(texto: unknown): LecturaDePorcentaje {
  const crudo = typeof texto === "number" ? String(texto) : typeof texto === "string" ? texto : "";
  const limpio = crudo.trim().replace(/\s*%$/, "").trim();
  if (limpio === "") return { ok: false, error: "Contanos qué porcentaje de las materias ya aprobaste." };
  if (!/^\d{1,3}$/.test(limpio)) return { ok: false, error: "Escribí un número entero entre 0 y 100." };
  const valor = Number(limpio);
  if (valor < PORCENTAJE_MINIMO || valor > PORCENTAJE_MAXIMO) return { ok: false, error: "Escribí un número entre 0 y 100." };
  return { ok: true, valor };
}

/** Cómo se muestra a las instituciones: "Estudiante · 80 % de la carrera" (o solo "Estudiante" si no cargó el porcentaje). */
export function etiquetaDeEstudiante(porcentaje: number | null | undefined) {
  return porcentaje == null ? "Estudiante" : `Estudiante · ${porcentaje} % de la carrera`;
}

/** ¿Es estudiante? `situacionEstudio` guarda "estudiante" o "recibido" (null en cuentas anteriores: cuenta como recibido). */
export const esEstudiante = (situacionEstudio: string | null | undefined) => situacionEstudio === "estudiante";

/**
 * Qué documento reemplaza al otro: quien se recibió presenta el título o la certificación (`credencial`); quien estudia, la
 * constancia de alumno regular (`constancia`).
 */
export const documentoDeEstudios = (situacionEstudio: string | null | undefined) =>
  esEstudiante(situacionEstudio) ? ("constancia" as const) : ("credencial" as const);

export type SituacionDeEstudio = "estudiante" | "recibido";

/** Lo guardado en `situacion_estudio`, siempre como una de las dos opciones (null o cualquier otra cosa = ya se recibió). */
export const situacionDeEstudio = (guardada: string | null | undefined): SituacionDeEstudio =>
  esEstudiante(guardada) ? "estudiante" : "recibido";

export type CambioDeEstudios =
  | { ok: true; situacion: SituacionDeEstudio; porcentaje: number | null }
  | { ok: false; error: string; campo: "situacionEstudio" | "porcentajeMaterias" };

/**
 * Qué pasa cuando desde Mi perfil alguien cambia (o confirma) sus estudios.
 * - Con la verificación rechazada no se cambia nada desde acá: lo atiende el equipo.
 * - Pasar de "ya me recibí" a "estoy estudiando" no se puede con el perfil verificado (sería sumar una constancia que nadie
 *   revisa y sacar el título de la vista): se escribe al equipo.
 * - Quien estudia tiene que declarar el porcentaje (lo puede ir actualizando, también con el perfil verificado); quien se
 *   recibió no guarda ninguno.
 */
export function decidirEstudios(entrada: {
  actual: string | null | undefined;
  /** Lo que pide el formulario; undefined = no tocó los estudios. */
  pedida: SituacionDeEstudio | undefined;
  porcentaje: unknown;
  verificacion: "pendiente" | "correccion" | "rechazado" | "verificado";
}): CambioDeEstudios {
  const actual = situacionDeEstudio(entrada.actual);
  const destino = entrada.pedida ?? actual;
  if (destino !== actual) {
    if (entrada.verificacion === "rechazado") {
      return { ok: false, campo: "situacionEstudio", error: "Rechazamos tu verificación: escribinos desde Contacto y lo revisamos." };
    }
    if (destino === "estudiante" && entrada.verificacion === "verificado") {
      return { ok: false, campo: "situacionEstudio", error: "Tu perfil ya está verificado: si seguís estudiando, escribinos desde Contacto." };
    }
  }
  if (destino === "recibido") return { ok: true, situacion: "recibido", porcentaje: null };
  const lectura = leerPorcentaje(entrada.porcentaje);
  if (!lectura.ok) return { ok: false, campo: "porcentajeMaterias", error: lectura.error };
  return { ok: true, situacion: "estudiante", porcentaje: lectura.valor };
}

/** Texto del documento de estudios que se pide, para el alta y Mi perfil. */
export const CONSTANCIA = {
  nombre: "Constancia de alumno regular",
  vacio: "PDF o foto de la constancia de tu facultad o instituto",
  corto: "La revisamos junto con tu DNI",
} as const;
