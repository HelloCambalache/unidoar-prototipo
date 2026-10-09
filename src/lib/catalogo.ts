import { z } from "zod";
import type { CategoriaDocente, EtapaPostulacion, RolUsuario } from "@/db/schema";

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
  "Natatorio o colonia",
  "Instituto de idiomas",
  "Instituto terciario",
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
export const ROLES_EQUIPO_INFO = {
  dueno: {
    label: "Dueño de la cuenta",
    corto: "Dueño",
    desc: "Acceso total, incluido el plan y la facturación. Es único y no se puede invitar: se transfiere.",
  },
  administrador: {
    label: "Administrador/a",
    corto: "Admin",
    desc: "Hace todo salvo tocar el plan y la facturación: publica, contrata, edita la vitrina y maneja el equipo.",
  },
  reclutador: {
    label: "Reclutador/a",
    corto: "Reclutador",
    desc: "Publica búsquedas, mueve postulantes y contrata. No accede al equipo, al plan ni a la vitrina.",
  },
  coordinador: {
    label: "Coordinador/a de área",
    corto: "Coordinador",
    desc: "Ve las búsquedas de su área y deja comentarios en los postulantes. No publica ni contrata.",
  },
  director: {
    label: "Director/a",
    corto: "Director",
    desc: "Ve todo y aprueba contrataciones. No toca el plan ni la facturación.",
  },
  secretario: {
    label: "Secretario/a",
    corto: "Secretario",
    desc: "Carga y edita búsquedas, agenda entrevistas y responde postulantes.",
  },
  referente: {
    label: "Referente de nivel",
    corto: "Referente",
    desc: "Ve las búsquedas de su nivel y comenta en los postulantes. No publica ni contrata.",
  },
  facturacion: {
    label: "Administración y facturación",
    corto: "Facturación",
    desc: "Accede al plan, los comprobantes y los datos de facturación. No ve las búsquedas.",
  },
  otro: {
    label: "Otro",
    corto: "Otro",
    desc: "Los permisos los definís vos cuando acepte la invitación.",
  },
  colaborador: {
    label: "Colaborador/a",
    corto: "Colaborador",
    desc: "Participa de las contrataciones.",
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

export const institucionDatosSchema = z.object({
  nombre: texto(2, 120),
  tipo: z.enum(TIPOS_INSTITUCION),
  fundada: z.coerce.number().int().min(1800).max(new Date().getFullYear()).optional().or(z.literal("").transform(() => undefined)),
  contactoNombre: texto(2, 120),
  contactoRol: z.enum(ROLES_CONTACTO),
  telefono: texto(6, 40),
  cuit: textoOpcional(20),
  cue: textoOpcional(20),
  direccion: texto(3, 200),
  partido: texto(2, 100),
  provincia: texto(2, 100),
  aceptaTerminos: z.literal("on", { error: "Tenés que aceptar los términos y condiciones" }),
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
  nivel: z.enum(NIVELES).optional(),
  tipo: z.enum(TIPOS_BUSQUEDA),
  cargaHoraria: textoOpcional(80),
  turno: z.enum(TURNOS).optional(),
  fechaInicio: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  zona: textoOpcional(160),
  descripcion: textoOpcional(2000),
});
export type BusquedaInput = z.infer<typeof busquedaSchema>;

export const postulacionMensajeSchema = z.object({ mensaje: textoOpcional(1000) });
