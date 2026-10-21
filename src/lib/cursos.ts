import { z } from "zod";

/*
 * Reglas de dominio de los cursos que comparten el formulario (cliente), las server actions y las
 * pantallas de la institución. Sin acceso a base: se puede importar desde Client Components.
 */

export const MODALIDADES = ["Presencial", "Online"] as const;
export type Modalidad = (typeof MODALIDADES)[number];

/** Puntaje que suma un curso con certificado si la institución no lo cambia (el mismo que muestra el lado docente). */
export const PUNTAJE_POR_DEFECTO = 10;

/** "1 inscripto", "3 inscriptos", "Sin inscriptos". */
export const etiquetaInscriptos = (n: number) =>
  n === 0 ? "Sin inscriptos" : n === 1 ? "1 inscripto" : `${n} inscriptos`;

/* ───────────────────────────── Horario del curso ─────────────────────────────
   La base guarda `cursos.horario` como texto ("Lunes a viernes 9:00 a 11:00 · Sábados 10:00 a 12:00").
   El formulario lo arma desde una grilla de días: los días salen del rango de fechas y cada uno lleva su franja.
   `parsearHorario` hace el camino inverso para poder editar un curso ya guardado. */

/** Lunes → domingo, con el número de día de la semana de JavaScript (domingo = 0). */
export const ORDEN_DIAS = [1, 2, 3, 4, 5, 6, 0] as const;
const NOMBRES_DIA = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"] as const;
export const nombreDia = (n: number) => NOMBRES_DIA[n] ?? "";

export type DiaCurso = { activo: boolean; desde: string; hasta: string };
export type DiasCurso = Partial<Record<number, DiaCurso>>;

/** 7:00, 7:30 … 22:00 (el formato sin cero a la izquierda es el del prototipo). */
export const HORAS: string[] = Array.from({ length: 31 }, (_, i) => {
  const minutos = 7 * 60 + i * 30;
  return `${Math.floor(minutos / 60)}:${String(minutos % 60).padStart(2, "0")}`;
});

const FRANJA_POR_DEFECTO = { desde: "9:00", hasta: "11:00" };
const RE_FRANJA = /(\d{1,2}:\d{2})\s*a\s*(\d{1,2}:\d{2})/;

const hora = (h: string) => {
  const [hh, mm] = h.split(":");
  return `${Number(hh)}:${mm}`;
};

/** La franja que ya traía el texto ("17:00 a 19:00") o la de por defecto. */
export function franjaPorDefecto(horario: string | null | undefined) {
  const m = RE_FRANJA.exec(horario ?? "");
  return m ? { desde: hora(m[1]!), hasta: hora(m[2]!) } : FRANJA_POR_DEFECTO;
}

/**
 * Los días de la semana que caen dentro del rango de fechas (se recorre hasta una semana, que ya
 * cubre todos los casos), de lunes a domingo. Trabaja en UTC sobre "AAAA-MM-DD": sin husos horarios de por medio.
 */
export function diasDelRango(inicio?: string | null, fin?: string | null): number[] {
  if (!inicio) return [];
  const t = (s: string) => Date.parse(`${s}T00:00:00Z`);
  const d1 = t(inicio);
  const d2 = t(fin || inicio);
  if (Number.isNaN(d1) || Number.isNaN(d2) || d2 < d1) return [];
  const vistos = new Set<number>();
  for (let cursor = d1; cursor <= d2 && vistos.size < 7; cursor += 86_400_000) {
    vistos.add(new Date(cursor).getUTCDay());
  }
  return ORDEN_DIAS.filter((n) => vistos.has(n));
}

/** Conserva lo elegido para los días que siguen dentro del rango y da de alta los nuevos con la franja por defecto. */
export function recalcularDias(
  inicio: string | null | undefined,
  fin: string | null | undefined,
  previos: DiasCurso = {},
  franja = FRANJA_POR_DEFECTO,
): DiasCurso {
  const dias: DiasCurso = {};
  for (const n of diasDelRango(inicio, fin)) {
    dias[n] = previos[n] ?? { activo: true, ...franja };
  }
  return dias;
}

/** "Lunes a viernes 9:00 a 11:00 · Sábado 10:00 a 12:00"; sin ningún día activo, "A confirmar". */
export function armarHorario(dias: DiasCurso) {
  const activos = ORDEN_DIAS.filter((n) => dias[n]?.activo);
  if (activos.length === 0) return "A confirmar";
  const grupos: { rango: string; dias: number[] }[] = [];
  for (const n of activos) {
    const rango = `${dias[n]!.desde} a ${dias[n]!.hasta}`;
    const g = grupos.find((x) => x.rango === rango);
    if (g) g.dias.push(n);
    else grupos.push({ rango, dias: [n] });
  }
  return grupos
    .map((g) => {
      const clave = g.dias.join(",");
      let etiqueta: string;
      if (clave === "1,2,3,4,5") etiqueta = "Lunes a viernes";
      else if (clave === "1,2,3,4,5,6") etiqueta = "Lunes a sábado";
      else if (clave === "1,2,3,4,5,6,0") etiqueta = "Todos los días";
      else if (clave === "6,0") etiqueta = "Sábados y domingos";
      else {
        // En castellano los días van en minúscula; solo el primero abre la frase en mayúscula.
        const nombres = g.dias.map((n, i) => (i === 0 ? nombreDia(n) : nombreDia(n).toLowerCase()));
        etiqueta = nombres.length === 1 ? nombres[0]! : `${nombres.slice(0, -1).join(", ")} y ${nombres.at(-1)}`;
      }
      return `${etiqueta} ${g.rango}`;
    })
    .join(" · ");
}

const sinTildes = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

const DIA_POR_NOMBRE: Record<string, number> = {
  lunes: 1,
  martes: 2,
  miercoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
  sabados: 6,
  domingo: 0,
  domingos: 0,
};

const GRUPOS_FIJOS: Record<string, number[]> = {
  "lunes a viernes": [1, 2, 3, 4, 5],
  "lunes a sabado": [1, 2, 3, 4, 5, 6],
  "todos los dias": [1, 2, 3, 4, 5, 6, 0],
  "sabados y domingos": [6, 0],
};

/**
 * Lo contrario de `armarHorario`: del texto guardado a los días con su franja. Entiende también el plural
 * ("Sábados 10:00 a 12:00") que traen los cursos cargados a mano. Devuelve null si no lo puede interpretar.
 */
export function parsearHorario(texto: string | null | undefined): Map<number, { desde: string; hasta: string }> | null {
  const limpio = (texto ?? "").trim();
  if (!limpio) return null;
  const resultado = new Map<number, { desde: string; hasta: string }>();
  for (const parte of limpio.split("·")) {
    const m = /^(.*?)\s+(\d{1,2}:\d{2})\s*a\s*(\d{1,2}:\d{2})\s*$/.exec(parte.trim());
    if (!m) return null;
    const etiqueta = sinTildes(m[1]!.trim());
    const dias =
      GRUPOS_FIJOS[etiqueta] ??
      etiqueta.split(/\s*,\s*|\s+y\s+/).map((nombre) => DIA_POR_NOMBRE[nombre.trim()]);
    if (dias.length === 0 || dias.some((d) => d === undefined)) return null;
    for (const d of dias as number[]) resultado.set(d, { desde: hora(m[2]!), hasta: hora(m[3]!) });
  }
  return resultado;
}

/** Los días con los que arranca el formulario: los del rango, con lo que ya decía el horario guardado. */
export function diasIniciales(inicio: string | null | undefined, fin: string | null | undefined, horario: string | null | undefined): DiasCurso {
  const franja = franjaPorDefecto(horario);
  const guardado = parsearHorario(horario);
  const dias: DiasCurso = {};
  for (const n of diasDelRango(inicio, fin)) {
    const propio = guardado?.get(n);
    dias[n] = guardado ? { activo: !!propio, ...(propio ?? franja) } : { activo: true, ...franja };
  }
  return dias;
}

/* ───────────────────────────── Formulario ───────────────────────────── */

/**
 * Los links de un curso se muestran como enlace a los docentes inscriptos: solo se aceptan http(s).
 * Sin esquema ("meet.google.com/abc") se asume https. Devuelve null si no es un link usable.
 */
/**
 * ¿Es un enlace que se puede mostrar como link? Solo http(s). Los links se guardan validados con `normalizarLink`, pero un dato viejo o
 * cargado por otro camino ("javascript:…") nunca tiene que llegar a un `href`: se vuelve a mirar al mostrarlo.
 */
export const esEnlaceWeb = (valor: string | null | undefined): valor is string => Boolean(valor && /^https?:\/\//i.test(valor.trim()));

/**
 * Dónde se dicta un curso, en una línea, para mostrarlo siempre (tarjeta, agenda, detalle, Mis cursos). Online: "Online".
 * Presencial: la dirección que cargó la institución con el partido y la provincia que se ubicaron, salvo que ya estén escritos
 * en la dirección ("Maipú 1234, Vicente López" no repite el partido). `null` si es presencial y todavía no hay dirección: la
 * pantalla lo avisa con su propio texto en vez de dejar el lugar en blanco.
 */
export function lugarDeCurso(c: {
  modalidad: string;
  direccion: string | null;
  partido?: string | null;
  provincia?: string | null;
}): string | null {
  if (c.modalidad === "Online") return "Online";
  const direccion = c.direccion?.trim();
  if (!direccion) return null;
  const clave = (t: string) => t.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  const escrita = clave(direccion);
  const faltan = [c.partido, c.provincia]
    .map((t) => t?.trim())
    .filter((t): t is string => !!t && !escrita.includes(clave(t)));
  return [direccion, ...faltan].join(", ");
}

export function normalizarLink(valor: string): string | null {
  const v = valor.trim();
  if (!v) return null;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(v)) {
    // Con esquema explícito: solo http(s).
    if (!/^https?:\/\//i.test(v)) return null;
  } else if (/^[a-z][a-z0-9+.-]*:(?!\d)/i.test(v)) {
    // "javascript:…", "mailto:…", "data:…": no son un link a una sala.
    return null;
  }
  const conEsquema = /^https?:\/\//i.test(v) ? v : `https://${v}`;
  try {
    const url = new URL(conEsquema);
    if ((url.protocol !== "http:" && url.protocol !== "https:") || !url.hostname.includes(".")) return null;
    return conEsquema;
  } catch {
    return null;
  }
}

const texto = (min = 1, max = 200) =>
  z
    .string()
    .trim()
    .min(min, min <= 1 ? "Completá este campo" : `Mínimo ${min} caracteres`)
    .max(max, `Máximo ${max} caracteres`);
const textoOpcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo ${max} caracteres`)
    .optional()
    .transform((v) => (v ? v : undefined));

const fechaOpcional = z
  .union([z.literal("").transform(() => undefined), z.iso.date({ error: "La fecha no es válida" })])
  .optional();

const linkOpcional = z
  .string()
  .trim()
  .max(500, "Máximo 500 caracteres")
  .optional()
  .transform((v, ctx) => {
    if (!v) return undefined;
    const link = normalizarLink(v);
    if (!link) {
      ctx.issues.push({ code: "custom", message: "Ingresá un link válido, por ejemplo https://meet.google.com/…", input: v });
      return z.NEVER;
    }
    return link;
  });

const puntajeOpcional = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.coerce.number({ error: "Ingresá un número" }).int("Tiene que ser un número entero").min(0, "Mínimo 0").max(100, "Máximo 100").optional(),
);

/** Lo que carga el formulario de crear / editar un curso (el mismo schema para las dos acciones). */
export const cursoSchema = z
  .object({
    titulo: texto(3, 120),
    subtitulo: textoOpcional(160),
    descripcion: textoOpcional(2000),
    modalidad: z.enum(MODALIDADES, { error: "Elegí la modalidad" }),
    profesor: textoOpcional(120),
    certifica: z
      .string()
      .optional()
      .transform((v) => v === "on"),
    puntaje: puntajeOpcional,
    fechaInicio: fechaOpcional,
    fechaFinal: fechaOpcional,
    horario: textoOpcional(200),
    direccion: textoOpcional(200),
    /** Firma de la sugerencia de ubicación que eligió la persona (/api/ubicacion); el servidor la verifica antes de usarla. */
    ubicacion: textoOpcional(4000),
    link: linkOpcional,
    /** Contraseña o código de acceso de la sala (p. ej. Zoom): se guarda solo si hay link. */
    linkClave: textoOpcional(100),
    fotoUrl: textoOpcional(500),
  })
  .superRefine((d, ctx) => {
    // Un curso presencial sin lugar no le sirve a quien se inscribe: sin dirección no se publica.
    if (d.modalidad === "Presencial" && !d.direccion) {
      ctx.addIssue({ code: "custom", path: ["direccion"], message: "Indicá dónde se dicta el curso" });
    }
    if (d.fechaInicio && d.fechaFinal && d.fechaFinal < d.fechaInicio) {
      ctx.addIssue({ code: "custom", path: ["fechaFinal"], message: "No puede ser anterior a la fecha de inicio" });
    }
  });
export type CursoFormulario = z.infer<typeof cursoSchema>;

/**
 * El formulario a columnas de `cursos`. La dirección solo vale en un curso presencial y el link solo en
 * uno online; el puntaje solo existe si el curso certifica.
 */
export function valoresDeCurso(d: CursoFormulario) {
  return {
    titulo: d.titulo,
    subtitulo: d.subtitulo ?? null,
    descripcion: d.descripcion ?? null,
    modalidad: d.modalidad,
    profesor: d.profesor ?? null,
    fechaInicio: d.fechaInicio ?? null,
    fechaFinal: d.fechaFinal ?? null,
    horario: d.horario ?? null,
    direccion: d.modalidad === "Presencial" ? (d.direccion ?? null) : null,
    link: d.modalidad === "Online" ? (d.link ?? null) : null,
    linkClave: d.modalidad === "Online" && d.link ? (d.linkClave ?? null) : null,
    certifica: d.certifica,
    puntaje: d.certifica ? (d.puntaje ?? PUNTAJE_POR_DEFECTO) : null,
    fotoUrl: d.fotoUrl ?? null,
  };
}

/** Valores con los que arranca el formulario (todo texto, tal como lo editan los inputs). */
export type ValoresCurso = {
  titulo: string;
  subtitulo: string;
  descripcion: string;
  modalidad: Modalidad;
  profesor: string;
  certifica: boolean;
  puntaje: string;
  fechaInicio: string;
  fechaFinal: string;
  horario: string;
  direccion: string;
  link: string;
  linkClave: string;
  fotoUrl: string;
};

export type EstadoFormularioCurso = { ok: false; error: string; campos?: Record<string, string> } | null;
