import { z } from "zod";
import type { CategoriaDocente, EtapaPostulacion, RolUsuario } from "@/db/schema";
import { esCuitValido, formatearCuit } from "@/lib/documentos";

/* Vocabularios compartidos entre formularios, filtros y validación del servidor. */

export const CATEGORIAS = ["educador", "entrenador", "guardavidas"] as const satisfies readonly CategoriaDocente[];

export const CATEGORIA_INFO: Record<
  CategoriaDocente,
  { label: string; labelDocente: string; color: string; tint: string; ink: string; plural: string }
> = {
  educador: { label: "Docente", labelDocente: "Docente", plural: "Docentes", color: "#DD553F", tint: "#FDE9E1", ink: "#8A2F1A" },
  entrenador: { label: "Entrenador/a", labelDocente: "Entrenador/a", plural: "Entrenadores", color: "#F59332", tint: "#FEF1DF", ink: "#8A4B07" },
  guardavidas: { label: "Guardavidas", labelDocente: "Guardavidas", plural: "Guardavidas", color: "#82D8E9", tint: "#E3F6FA", ink: "#14596A" },
};

export const NIVELES = ["Inicial", "Primario", "Secundario", "Terciario", "Adultos", "No formal (club)", "Otro"] as const;
export const TURNOS = ["Mañana", "Tarde", "Contraturno", "Mañana y tarde", "Noche", "Fin de semana"] as const;
export const DISPONIBILIDAD = ["Turno mañana", "Turno tarde", "Contraturno / sábados", "Full time"] as const;
export const TIPOS_BUSQUEDA = ["Titular", "Suplencia", "Suplencia rápida", "Temporada", "Freelance"] as const;

export const TIPOS_INSTITUCION = [
  "Colegio privado",
  "Colegio público",
  "Jardín de infantes",
  "Club o gimnasio",
  "Escuela deportiva",
  "Natatorio o colonia",
  "Instituto de idiomas",
  "Sociedad de fomento",
  "Instituto terciario",
  "Universidad",
  "Otro",
] as const;
/** Tipos que tienen código CUE (establecimientos educativos). */
export const TIPOS_CON_CUE: readonly string[] = [
  "Colegio privado",
  "Colegio público",
  "Jardín de infantes",
  "Instituto terciario",
];

export const ROLES_CONTACTO = ["Director/a", "Coordinador/a", "Docente", "Administrativo/a", "Otro"] as const;
/**
 * Roles del equipo de una institución. La clave es lo que se guarda en `institucion_miembros.rol`;
 * "colaborador" es el rol previo a estos y se sigue mostrando si quedó alguna fila vieja.
 */
/**
 * Los textos de los roles tienen que decir lo que el sistema hace de verdad: hoy solo el dueño y los administradores manejan el equipo,
 * el perfil público, las sedes y los pedidos de plan (`esRolGestor`); todo el resto del equipo puede lo mismo (publicar búsquedas, mover y
 * contratar postulantes, ver sus datos de contacto). Si algún día un rol restringe algo, se cambia la descripción junto con el permiso.
 */
export const ROLES_EQUIPO_INFO = {
  dueno: {
    label: "Dueño de la cuenta",
    corto: "Dueño",
    desc: "Acceso total: maneja el equipo, el perfil público, las sedes y el plan. Es único y no se puede invitar.",
  },
  administrador: {
    label: "Administrador/a",
    corto: "Admin",
    desc: "Además de publicar y contratar, maneja el equipo (invita, cambia roles y quita gente), edita el perfil público y las sedes, y pide cambios de plan.",
  },
  reclutador: {
    label: "Reclutador/a",
    corto: "Reclutador",
    desc: "Para quien se ocupa de las búsquedas y los postulantes: publica, mueve postulantes y contrata. No maneja el equipo, el perfil público ni el plan.",
  },
  coordinador: {
    label: "Coordinador/a de área",
    corto: "Coordinador",
    desc: "Para quien coordina un área. Hoy puede lo mismo que el resto del equipo (publicar, comentar y contratar) y no maneja el equipo, el perfil público ni el plan.",
  },
  director: {
    label: "Director/a",
    corto: "Director",
    desc: "Para la dirección de la institución. Puede lo mismo que el resto del equipo y no maneja el equipo, el perfil público ni el plan.",
  },
  secretario: {
    label: "Secretario/a",
    corto: "Secretario",
    desc: "Para quien carga las búsquedas y agenda las entrevistas. No maneja el equipo, el perfil público ni el plan.",
  },
  referente: {
    label: "Referente de nivel",
    corto: "Referente",
    desc: "Para quien referencia un nivel. Hoy puede lo mismo que el resto del equipo (publicar, comentar y contratar) y no maneja el equipo, el perfil público ni el plan.",
  },
  facturacion: {
    label: "Administración y facturación",
    corto: "Facturación",
    desc: "Para quien se ocupa de la administración: ve el plan y las facturas. Hoy también ve las búsquedas y los postulantes, como todo el equipo, y no maneja el equipo, el perfil público ni el plan.",
  },
  otro: {
    label: "Otro",
    corto: "Otro",
    desc: "Un rol a medida. Hoy puede lo mismo que el resto del equipo y no maneja el equipo, el perfil público ni el plan.",
  },
  colaborador: {
    label: "Colaborador/a",
    corto: "Colaborador",
    desc: "Participa de las contrataciones. No maneja el equipo, el perfil público ni el plan.",
  },
} as const;
export type RolEquipo = keyof typeof ROLES_EQUIPO_INFO;
/** Los que se pueden elegir al invitar o al cambiar el rol (el dueño es único y "colaborador" ya no se ofrece). */
export const ROLES_INVITABLES = [
  "administrador",
  "reclutador",
  "coordinador",
  "director",
  "secretario",
  "referente",
  "facturacion",
  "otro",
] as const satisfies readonly RolEquipo[];
/** Etiquetas de los roles invitables, en el orden del selector. */
export const ROLES_EQUIPO = ROLES_INVITABLES.map((r) => ROLES_EQUIPO_INFO[r].label);

export const ETAPAS: { key: EtapaPostulacion; label: string; columna: string }[] = [
  { key: "nuevos", label: "Nuevo", columna: "Nuevos" },
  { key: "preseleccionados", label: "Preseleccionado", columna: "Preseleccionados" },
  { key: "entrevista", label: "Entrevista", columna: "Entrevista" },
  { key: "oferta", label: "Oferta enviada", columna: "Oferta" },
  { key: "examen_preocupacional", label: "Examen preocupacional", columna: "Examen preocupacional" },
  { key: "contratado", label: "Contratado", columna: "Contratados" },
];
export const ETAPA_LABEL: Record<EtapaPostulacion, string> = {
  nuevos: "Nuevo",
  preseleccionados: "Preseleccionado",
  entrevista: "Entrevista",
  oferta: "Oferta enviada",
  examen_preocupacional: "Examen preocupacional",
  contratado: "Contratado",
  descartado: "Archivado",
};

export const RUTA_INICIO: Record<RolUsuario, string> = {
  docente: "/docente/dashboard",
  institucion: "/institucion/dashboard",
  admin: "/backoffice/verificacion",
};

/* ───────── Esquemas Zod de formularios (los reusan cliente y server actions) ───────── */

const texto = (min = 1, max = 200) => z.string().trim().min(min, "Completá este campo").max(max);
const textoOpcional = (max = 500) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

export const MENSAJE_CUIT = "Revisá el CUIT: tienen que ser 11 números y el último no coincide con los demás";

/** CUIT opcional: vacío = sin dato; si viene, tiene que ser un CUIT real (11 números con su dígito verificador). Se guarda con guiones. */
const cuitOpcional = z
  .string()
  .trim()
  .max(20)
  .optional()
  .refine((v) => !v || esCuitValido(v), MENSAJE_CUIT)
  .transform((v) => (v ? formatearCuit(v) : undefined));

export const institucionDatosSchema = z.object({
  nombre: texto(2, 120),
  tipo: z.enum(TIPOS_INSTITUCION),
  /** Lo que escribe quien elige "Otro" (ver `valorElegido`, src/lib/otro.ts). */
  tipoOtro: textoOpcional(60),
  fundada: z.coerce.number().int().min(1800).max(new Date().getFullYear()).optional().or(z.literal("").transform(() => undefined)),
  contactoNombre: texto(2, 120),
  contactoRol: z.enum(ROLES_CONTACTO),
  contactoRolOtro: textoOpcional(60),
  telefono: texto(6, 40),
  /**
   * Cómo quiere usar UNIDOAR: con el abono de su tipo pagado mes a mes («abono»), con el mismo abono pagando el semestre por adelantado
   * («semestral», ver src/lib/forma-de-pago.ts) o pagando una sola búsqueda («puntual», solo si ese plan se ofrece). Sin el campo, el plan sigue
   * al tipo como siempre y la forma de pago no se toca (ver `planDelAlta`, src/lib/planes.ts).
   */
  modalidad: z.enum(["abono", "semestral", "puntual"]).optional(),
  cuit: cuitOpcional,
  cue: textoOpcional(20),
  direccion: texto(3, 200),
  partido: texto(2, 100),
  provincia: texto(2, 100),
  // La casilla solo se dibuja si la cuenta todavía no aceptó los términos (se aceptan en el paso 1 del alta). Quién la exige es
  // `crearInstitucion`, que mira la constancia de la cuenta: acá no puede ser obligatoria o el alta no se podría completar.
  aceptaTerminos: z.string().optional(),
});
export type InstitucionDatos = z.infer<typeof institucionDatosSchema>;

export const institucionPerfilSchema = z.object({
  descripcion: textoOpcional(1000),
  logoUrl: textoOpcional(500),
  portadaUrl: textoOpcional(500),
});

export const busquedaSchema = z.object({
  puesto: texto(3, 120),
  categoria: z.enum(CATEGORIAS),
  disciplina: texto(2, 100),
  // Un nivel de la lista o, con "Otro", el que escribió la institución.
  nivel: z.string().trim().max(60).optional(),
  tipo: z.enum(TIPOS_BUSQUEDA),
  cargaHoraria: textoOpcional(80),
  turno: z.enum(TURNOS).optional(),
  fechaInicio: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  zona: textoOpcional(160),
  // Obligatoria: una búsqueda sin descripción no le dice nada a quien la lee. El mínimo evita que pase una sola letra.
  descripcion: z.string().trim().min(10, "Contá en qué consiste el cargo (al menos unas palabras)").max(2000),
});
export type BusquedaInput = z.infer<typeof busquedaSchema>;

export const postulacionMensajeSchema = z.object({ mensaje: textoOpcional(1000) });
