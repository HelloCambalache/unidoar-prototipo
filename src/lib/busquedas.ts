import { z } from "zod";
import { busquedaSchema, CATEGORIAS, NIVELES, TURNOS } from "@/lib/catalogo";

/*
 * Reglas de dominio de las búsquedas que comparten el formulario (cliente), las server
 * actions y las listas. Sin acceso a base: se puede importar desde Client Components.
 */

export type Turno = (typeof TURNOS)[number];

/** plural(3, "postulante", "postulantes") → "3 postulantes" */
export const plural = (n: number, singular: string, plurales: string) => `${n} ${n === 1 ? singular : plurales}`;

/** Los ids llegan del cliente o de la URL: se validan antes de tocar la base (un uuid mal formado rompe la consulta). */
export const esUuid = (valor: unknown): valor is string => z.guid().safeParse(valor).success;

const vacioAUndefined = <T extends z.ZodType>(schema: T) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), schema);

/** Textarea "uno por línea" → arreglo de hasta 12 ítems cortos. */
const lista = z
  .string()
  .max(2000)
  .optional()
  .transform((v) =>
    (v ?? "")
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 12),
  )
  .pipe(z.array(z.string().max(160, "Cada ítem puede tener hasta 160 caracteres")));

/** Plazos que ofrece el formulario para una suplencia rápida. */
export const OPCIONES_VENCIMIENTO = [
  { horas: 12, etiqueta: "12 horas" },
  { horas: 24, etiqueta: "24 horas" },
  { horas: 48, etiqueta: "48 horas" },
  { horas: 72, etiqueta: "3 días" },
  { horas: 168, etiqueta: "1 semana" },
] as const;

/** busquedaSchema (catalogo.ts) más lo que el formulario también carga. */
export const busquedaFormularioSchema = busquedaSchema.extend({
  nivel: vacioAUndefined(z.enum(NIVELES).optional()),
  turno: vacioAUndefined(z.enum(TURNOS).optional()),
  requisitos: lista,
  beneficios: lista,
  /** Solo para "Suplencia rápida": hasta cuándo se acepta respuesta. Vacío = mantener el vencimiento actual. */
  venceEnHoras: vacioAUndefined(z.coerce.number().int().min(1).max(168).optional()),
  /** En qué sede es la búsqueda: el servidor comprueba que sea de la institución (vacío = la principal, o la que ya tenía). */
  sedeId: vacioAUndefined(z.guid().optional()),
});
export type BusquedaFormulario = z.infer<typeof busquedaFormularioSchema>;

/** Filtro de estado de la lista de Publicaciones (?estado=). */
export type EstadoFiltro = "todos" | "activa" | "rapida" | "pausada";
export const ESTADOS_FILTRO: readonly EstadoFiltro[] = ["todos", "activa", "rapida", "pausada"];

export type EstadoFormularioBusqueda = { ok: false; error: string; campos?: Record<string, string> } | null;

const TURNOS_CON_PREFIJO: readonly string[] = ["Mañana", "Tarde", "Mañana y tarde", "Noche"];

/** "Turno mañana · 18 hs semanales": mismo formato que usan las búsquedas de ejemplo. */
export function componerHorario(turno?: string | null, cargaHoraria?: string | null) {
  const t = turno ? (TURNOS_CON_PREFIJO.includes(turno) ? `Turno ${turno.toLowerCase()}` : turno) : null;
  return [t, cargaHoraria].filter(Boolean).join(" · ") || null;
}

/** El formulario a columnas de `busquedas`. "Suplencia rápida" se guarda como Suplencia + rapida. */
export function valoresDeBusqueda(d: BusquedaFormulario) {
  const rapida = d.tipo === "Suplencia rápida";
  return {
    puesto: d.puesto,
    categoria: d.categoria,
    disciplina: d.disciplina,
    nivel: d.nivel ?? null,
    tipo: rapida ? "Suplencia" : d.tipo,
    rapida,
    cargaHoraria: d.cargaHoraria ?? null,
    turno: d.turno ?? null,
    horario: componerHorario(d.turno, d.cargaHoraria),
    fechaInicio: d.fechaInicio ?? null,
    zona: d.zona ?? null,
    descripcion: d.descripcion ?? null,
    requisitos: d.requisitos,
    beneficios: d.beneficios,
  };
}

/** Lo contrario: qué opción de "Tipo" corresponde a una búsqueda guardada. */
export function tipoDeFormulario(b: { tipo: string; rapida: boolean }) {
  return b.rapida ? "Suplencia rápida" : b.tipo;
}

/** "Titular · 18 hs semanales · turno mañana" */
export function metaDeBusqueda(b: { tipo: string; rapida: boolean; cargaHoraria: string | null; turno: string | null }) {
  return [tipoDeFormulario(b), b.cargaHoraria, b.turno ? `turno ${b.turno.toLowerCase()}` : null]
    .filter(Boolean)
    .join(" · ");
}

/* ───────── Coincidencias de docentes (panel lateral del formulario y aviso al publicar) ───────── */

/** Disponibilidad que declara un docente (DISPONIBILIDAD en catalogo.ts) que sirve para cada turno. */
export const TURNO_A_DISPONIBILIDAD: Record<Turno, string[]> = {
  Mañana: ["Turno mañana", "Full time"],
  Tarde: ["Turno tarde", "Full time"],
  Contraturno: ["Contraturno / sábados", "Full time"],
  "Mañana y tarde": ["Turno mañana", "Turno tarde", "Full time"],
  Noche: ["Full time"],
  "Fin de semana": ["Contraturno / sábados", "Full time"],
};

/** Turno que se "pide también" en el escenario del panel (solo mañana ↔ tarde). */
export const TURNO_COMPLEMENTARIO: Partial<Record<Turno, Turno>> = { Mañana: "Tarde", Tarde: "Mañana" };

const textoLibre = (max: number) =>
  z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().trim().max(max).optional(),
  );

export const filtrosCoincidenciaSchema = z.object({
  categoria: z.enum(CATEGORIAS),
  disciplina: textoLibre(100),
  nivel: vacioAUndefined(z.enum(NIVELES).optional()),
  turno: vacioAUndefined(z.enum(TURNOS).optional()),
  zona: textoLibre(160),
  /** Incluir partidos linderos (zonas cercanas a las de la institución). */
  ampliarZona: z.boolean().default(false),
  /** Incluir perfiles con identidad todavía sin verificar. */
  incluirSinVerificar: z.boolean().default(false),
  /** Exigir también el turno complementario (mañana ↔ tarde). */
  turnoExtra: z.boolean().default(false),
});
export type FiltrosCoincidenciaEntrada = z.input<typeof filtrosCoincidenciaSchema>;
/** Los criterios del formulario que alimentan el panel de coincidencias (sin los interruptores). */
export type CriteriosCoincidencia = {
  categoria: (typeof CATEGORIAS)[number];
  disciplina?: string;
  nivel?: string;
  turno?: Turno;
  zona?: string;
};
export type FiltrosCoincidencia = z.output<typeof filtrosCoincidenciaSchema>;

export type ResumenCoincidencias = {
  /** Docentes que coinciden con los criterios (con los interruptores tal como están). */
  total: number;
  verificados: number;
  conTitulo: number;
  /** Los que tienen cuenta y recibirán la notificación al publicar. */
  conCuenta: number;
  /** Cuántos de `total` declaran disponibilidad en el turno elegido (null si no se eligió turno). */
  disponiblesTurno: number | null;
  /** Iniciales de hasta 4 coincidencias, para los avatares. */
  iniciales: string[];
  /** Cuánto suma (o resta) cada interruptor sobre el resto de los criterios. null = no aplica. */
  escenarios: {
    zona: number | null;
    sinVerificar: number;
    turnoExtra: { delta: number; turno: string } | null;
  };
  /** false si el texto de zona no se pudo ubicar en el catálogo (no se filtra por zona). */
  zonaResuelta: boolean;
};

/** Tope de notificaciones que dispara una publicación. */
export const TOPE_AVISOS = 50;
