import { z } from "zod";
import type { CategoriaDocente, EstadoCeldaDisponibilidad, GrillaDisponibilidad } from "@/db/schema";
import { CATEGORIAS, DISPONIBILIDAD, NIVELES } from "@/lib/catalogo";

/*
 * Lo que comparten el onboarding (servidor y cliente): pasos, copy, esquemas Zod y la lógica
 * pura de la grilla de disponibilidad. Sin acceso a base ni a `server-only`.
 */

export type RolAlta = "institucion" | "docente";
export const ROLES_ALTA = ["institucion", "docente"] as const satisfies readonly RolAlta[];

/** Estado que devuelven las acciones de formulario (para `useActionState`). `null` = todavía no se envió. */
export type EstadoFormulario = {
  ok: boolean;
  error?: string;
  campos?: Record<string, string>;
  /** Lo que escribió la persona, para no perderlo cuando React reinicia el formulario. */
  valores?: Record<string, string | string[]>;
  mensaje?: string;
} | null;

/** `id` del formulario de cada paso: "Guardar y salir" del marco lo envía desde el encabezado. */
export const ID_FORMULARIO_ONBOARDING = "form-onboarding";

/** Valores iniciales de un formulario (texto por campo). */
export type DatosForm = Record<string, string | undefined>;

/** Lo escrito en el envío anterior (si falló) gana sobre lo guardado. */
export function valorDe(estado: EstadoFormulario, inicial: DatosForm, campo: string) {
  const enviado = estado?.valores?.[campo];
  return typeof enviado === "string" ? enviado : (inicial[campo] ?? "");
}

/** Minúsculas, sin tildes ni signos: para comparar nombres de zonas y partidos. */
export function normalizarTexto(t: string) {
  return t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/* ───────── Pasos, progreso y fotos del marco ───────── */

export type PasoMarco = { etiqueta: string; progreso: number; fondo: string };

const FONDO = (n: 1 | 2 | 3) => `/assets/onboarding-bg-${n}.jpg`;

export const PASOS_INSTITUCION = {
  "1": { etiqueta: "Paso 1 de 3 · Tu acceso", progreso: 33, fondo: FONDO(1) },
  "2": { etiqueta: "Paso 2 de 3 · Tu institución", progreso: 66, fondo: FONDO(2) },
  "3": { etiqueta: "Paso 3 de 3", progreso: 100, fondo: FONDO(3) },
} as const satisfies Record<string, PasoMarco>;

/** Orden real del alta de docente (el del prototipo): cuenta → qué sos → perfil → CV → niveles y horarios → documentación. */
export const PASOS_DOCENTE = {
  "1": { etiqueta: "Paso 1 de 6 · Tu cuenta", progreso: 17, fondo: FONDO(3) },
  categoria: { etiqueta: "Paso 2 de 6 · Qué sos", progreso: 33, fondo: FONDO(1) },
  "3": { etiqueta: "Paso 3 de 6 · Tu perfil", progreso: 50, fondo: FONDO(3) },
  "2": { etiqueta: "Paso 4 de 6 · Tu CV", progreso: 67, fondo: FONDO(2) },
  asignaturas: { etiqueta: "Paso 5 de 6 · Niveles y horarios", progreso: 83, fondo: FONDO(3) },
  "4": { etiqueta: "Paso 6 de 6 · Documentación", progreso: 100, fondo: FONDO(1) },
} as const satisfies Record<string, PasoMarco>;

export type PasoDocente = keyof typeof PASOS_DOCENTE;

export const PORTADA_ONBOARDING = {
  institucion: {
    titulo: "Cubrí tu próxima búsqueda en días",
    bajada: "Publicás una vez y ves quién está cerca, verificado y disponible.",
  },
  docente: {
    titulo: "Tu CV, una sola vez",
    bajada: "Elegí las zonas donde te movés y postulate en dos toques. Gratis siempre.",
  },
} as const;

export const rutaPasoDocente = (paso: PasoDocente) => `/onboarding/docente/${paso}`;

/**
 * A qué paso mandar a un docente que todavía no terminó el alta. Se deduce de lo que ya está
 * guardado (así `requerirDocente` no necesita otra consulta): sin teléfono falta el perfil;
 * sin niveles u horarios falta el tramo CV → niveles; si no, solo queda la documentación.
 */
export function rutaPasoPendienteDocente(
  d: { telefono: string | null; niveles: string[]; disponibilidad: string[] } | null,
) {
  if (!d) return rutaPasoDocente("categoria");
  if (!d.telefono) return rutaPasoDocente("3");
  if (d.niveles.length === 0 || d.disponibilidad.length === 0) return rutaPasoDocente("2");
  return rutaPasoDocente("4");
}

/* ───────── Copy por categoría ───────── */

export const CATEGORIA_ALTA: Record<
  CategoriaDocente,
  { label: string; desc: string; credencial: { nombre: string; vacio: string; corto: string } }
> = {
  educador: {
    label: "Docente",
    desc: "Nivel inicial, primario, secundario y superior.",
    credencial: {
      nombre: "Título docente",
      vacio: "PDF del título o certificado analítico",
      corto: "La institución lo valida al contratarte",
    },
  },
  entrenador: {
    label: "Entrenador/a / Instructor/a",
    desc: "Gimnasios, clubes, disciplinas deportivas y talleres.",
    credencial: {
      nombre: "Certificación deportiva",
      vacio: "PDF de la certificación vigente",
      corto: "De la federación o entidad que la emitió",
    },
  },
  guardavidas: {
    label: "Guardavidas",
    desc: "Natatorios, colonias y temporada de verano.",
    credencial: {
      nombre: "Libreta de guardavidas con reválida",
      vacio: "PDF de la libreta con la reválida del año",
      corto: "La reválida vence al cierre de la temporada",
    },
  },
};

export const SITUACIONES_ESTUDIO = [
  { clave: "recibido", etiqueta: "Ya me recibí", desc: "Tenés el título o la certificación" },
  { clave: "estudiante", etiqueta: "Estoy estudiando", desc: "Todavía no tenés el título" },
] as const;
export type SituacionEstudio = (typeof SITUACIONES_ESTUDIO)[number]["clave"];

/* ───────── Grilla de disponibilidad ───────── */

export const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"] as const;
export const DIAS_LARGO = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábados"] as const;
export const FRANJAS = [
  { clave: "manana", etiqueta: "Mañana" },
  { clave: "tarde", etiqueta: "Tarde" },
  { clave: "contraturno", etiqueta: "Contraturno" },
] as const;

export const grillaVacia = (): GrillaDisponibilidad => ({
  manana: Array(DIAS.length).fill("ocupada"),
  tarde: Array(DIAS.length).fill("ocupada"),
  contraturno: Array(DIAS.length).fill("ocupada"),
});

/** Un toque: disponible; dos: a convenir; tres: libre de nuevo. */
export function siguienteEstadoCelda(e: EstadoCeldaDisponibilidad): EstadoCeldaDisponibilidad {
  return e === "ocupada" ? "disponible" : e === "disponible" ? "convenir" : "ocupada";
}

const estadoCelda = z.enum(["disponible", "convenir", "ocupada"]);
const filaGrilla = z.array(estadoCelda).length(DIAS.length);
export const grillaSchema = z.object({ manana: filaGrilla, tarde: filaGrilla, contraturno: filaGrilla });

/** Lee la grilla guardada tolerando datos viejos o incompletos. */
export function grillaDesdeJson(valor: unknown): GrillaDisponibilidad {
  const r = grillaSchema.safeParse(valor);
  return r.success ? r.data : grillaVacia();
}

/** ¿Marcó al menos un casillero (disponible o a convenir)? */
export const grillaTieneHorarios = (g: GrillaDisponibilidad) =>
  FRANJAS.some((f) => g[f.clave].some((c) => c !== "ocupada"));

/**
 * Traduce la grilla al vocabulario de `docentes.disponibilidad` (el que filtra el buscador).
 * Cuenta "a convenir" como disponible. "Full time" = mañana y tarde casi toda la semana (≥ 5 de lunes a viernes).
 */
export function disponibilidadDesdeGrilla(g: GrillaDisponibilidad): string[] {
  const libre = (fila: EstadoCeldaDisponibilidad[]) => fila.some((c) => c !== "ocupada");
  const diasLaborables = (fila: EstadoCeldaDisponibilidad[]) => fila.slice(0, 5).filter((c) => c === "disponible").length;
  const sabado = FRANJAS.some((f) => g[f.clave][5] !== "ocupada");

  const salida: string[] = [];
  if (libre(g.manana)) salida.push("Turno mañana");
  if (libre(g.tarde)) salida.push("Turno tarde");
  if (libre(g.contraturno) || sabado) salida.push("Contraturno / sábados");
  if (diasLaborables(g.manana) >= 5 && diasLaborables(g.tarde) >= 5) salida.push("Full time");
  return DISPONIBILIDAD.filter((d) => salida.includes(d));
}

/** Frase legible de la grilla: "lunes y martes a la mañana · jueves a la tarde". */
export function resumenDisponibilidad(g: GrillaDisponibilidad) {
  const unir = (xs: string[]) => (xs.length === 1 ? xs[0]! : `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}`);
  const frase = (estado: EstadoCeldaDisponibilidad) =>
    FRANJAS.map((f) => {
      const dias = g[f.clave].flatMap((c, i) => (c === estado ? [DIAS_LARGO[i]!] : []));
      if (dias.length === 0) return null;
      return `${unir(dias)} a la ${f.clave === "contraturno" ? "tarde (contraturno)" : f.etiqueta.toLowerCase()}`;
    })
      .filter(Boolean)
      .join(" · ");

  const salida: { titulo: string; color: string; texto: string }[] = [];
  const disponible = frase("disponible");
  const convenir = frase("convenir");
  if (disponible) salida.push({ titulo: "Disponible", color: "#16214F", texto: disponible });
  if (convenir) salida.push({ titulo: "A convenir", color: "#8CA9BE", texto: convenir });
  return salida;
}

/* ───────── Niveles ───────── */

/** Niveles que se ofrecen como casillero (el resto del vocabulario, "Otro", abre un texto libre). */
export const NIVELES_ESTANDAR = [
  "Inicial",
  "Primario",
  "Secundario",
  "Terciario",
  "Adultos",
  "No formal (club)",
] as const satisfies readonly (typeof NIVELES)[number][];

/** Separa lo guardado en `docentes.niveles` en casilleros estándar y texto libre. */
export function separarNiveles(niveles: string[]) {
  const estandar = niveles.filter((n) => (NIVELES_ESTANDAR as readonly string[]).includes(n));
  const otros = niveles.filter((n) => n !== "Otro" && !(NIVELES_ESTANDAR as readonly string[]).includes(n));
  const marcaOtro = niveles.includes("Otro") || otros.length > 0;
  return { estandar, otros: otros.join(", "), marcaOtro };
}

/* ───────── Esquemas Zod del alta de docente ───────── */

const texto = (min: number, max: number, mensaje = "Completá este campo") => z.string().trim().min(min, mensaje).max(max);

/** Vacío → undefined; si hay algo, tiene que cumplir el esquema. */
const opcional = <T extends z.ZodType>(esquema: T) =>
  z.union([z.literal("").transform(() => undefined), esquema]).optional() as z.ZodType<z.output<T> | undefined>;

export const categoriaDocenteSchema = z.object({
  categoria: z.enum(CATEGORIAS, { error: "Elegí qué sos" }),
  asignaturas: z
    .array(z.string().trim().min(1).max(100))
    .min(1, "Elegí al menos una asignatura")
    .max(30, "Elegiste demasiadas asignaturas"),
  estudio: z.enum(["recibido", "estudiante"], { error: "Contanos si ya te recibiste" }),
});

const soloDigitos = (v: string) => v.replace(/[\s.\-]/g, "");

const fechaNacimiento = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida")
  .refine((f) => {
    const t = Date.parse(`${f}T00:00:00Z`);
    if (Number.isNaN(t)) return false;
    const anios = (Date.now() - t) / (365.25 * 24 * 3600 * 1000);
    return anios >= 16 && anios <= 100;
  }, "Revisá la fecha de nacimiento");

const telefono = texto(6, 40, "Dejanos un teléfono o WhatsApp");
const dni = z
  .string()
  .trim()
  .transform(soloDigitos)
  .pipe(z.string().regex(/^\d{7,9}$/, "El DNI tiene 7 u 8 números"));
const cuil = z
  .string()
  .trim()
  .transform(soloDigitos)
  .pipe(z.string().regex(/^\d{11}$/, "El CUIL tiene 11 números"));

/** Datos personales del paso "Tu perfil": cada campo es opcional, pero si viene tiene que tener buen formato. */
export const datosDocenteSchema = z.object({
  nombre: opcional(texto(2, 80, "Completá tu nombre")),
  apellido: opcional(texto(2, 80, "Completá tu apellido")),
  fechaNacimiento: opcional(fechaNacimiento),
  dni: opcional(dni),
  telefono: opcional(telefono),
  cuil: opcional(cuil),
  direccion: opcional(texto(3, 200)),
  partido: opcional(texto(2, 100)),
  provincia: opcional(texto(2, 100)),
  zonas: z.array(z.string().trim().min(1).max(80)).max(12, "Podés elegir hasta 12 zonas"),
});

/** Campos con asterisco: se exigen al tocar Continuar (no al guardar un borrador). */
export const OBLIGATORIOS_DATOS_DOCENTE = {
  nombre: "Completá tu nombre",
  apellido: "Completá tu apellido",
  dni: "Lo necesitamos para verificarte",
  telefono: "Dejanos un teléfono o WhatsApp",
} as const;

export const nivelesHorariosSchema = z.object({
  niveles: z.array(z.enum(NIVELES_ESTANDAR)).max(NIVELES_ESTANDAR.length),
  incluyeOtro: z.boolean(),
  otrosNiveles: opcional(texto(2, 120)),
  grilla: grillaSchema,
});

/** Un path del bucket privado: `<usuarioId>/<carpeta>/<uuid>.<ext>`. Se valida la pertenencia en el servidor. */
export const pathPrivadoSchema = opcional(z.string().trim().max(300));

/** "María José Pérez" → { nombre: "María José", apellido: "Pérez" } (solo para precargar: el docente lo corrige). */
export function partirNombre(completo: string, respaldo: string) {
  const palabras = completo.trim().split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return { nombre: respaldo, apellido: "" };
  if (palabras.length === 1) return { nombre: palabras[0]!, apellido: "" };
  return { nombre: palabras.slice(0, -1).join(" "), apellido: palabras[palabras.length - 1]! };
}
