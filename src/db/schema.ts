import { relations, sql } from "drizzle-orm";
import { authUsers } from "drizzle-orm/supabase";
import {
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/* ───────────────────────────── Enums ─────────────────────────────
   Solo máquinas de estado y roles. Los vocabularios abiertos (turno, nivel,
   tipo de contrato…) viven como texto validado con Zod en src/lib/catalogo.ts,
   así sumar una opción no exige migración. */

export const rolUsuario = pgEnum("rol_usuario", ["docente", "institucion", "admin"]);
export const categoriaDocente = pgEnum("categoria_docente", ["educador", "entrenador", "guardavidas"]);
export const estadoVerificacion = pgEnum("estado_verificacion", [
  "pendiente",
  "verificado",
  "correccion",
  "rechazado",
]);
export const estadoBusqueda = pgEnum("estado_busqueda", ["activa", "pausada", "cerrada"]);
export const etapaPostulacion = pgEnum("etapa_postulacion", [
  "nuevos",
  "preseleccionados",
  "entrevista",
  "oferta",
  "examen_preocupacional",
  "contratado",
  "descartado",
]);
export const origenPostulacion = pgEnum("origen_postulacion", ["postulacion", "invitacion"]);

const marcasDeTiempo = {
  creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  actualizadoEn: timestamp("actualizado_en", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

/* ───────────────────────────── Cuentas ───────────────────────────── */

/** Una fila por cuenta de Supabase Auth: guarda el rol y lo que la app necesita saber de la cuenta. */
export const usuarios = pgTable("usuarios", {
  /** Mismo uuid que auth.users de Supabase: borrar la cuenta de Auth borra esta fila. */
  id: uuid("id").primaryKey().references(() => authUsers.id, { onDelete: "cascade" }),
  email: text("email").notNull().unique(),
  rol: rolUsuario("rol").notNull(),
  /** Cuándo aceptó los términos y condiciones y qué versión (`src/lib/terminos.ts`). Null: sin constancia (cuentas anteriores a este registro). */
  terminosAceptadosEn: timestamp("terminos_aceptados_en", { withTimezone: true }),
  terminosVersion: text("terminos_version"),
  /** Si recibe por mail los avisos de búsquedas y postulaciones. Los de cuenta, verificación y facturación se mandan siempre. */
  avisosPorCorreo: boolean("avisos_por_correo").notNull().default(true),
  ...marcasDeTiempo,
});

export const instituciones = pgTable(
  "instituciones",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Clave pública estable: /instituciones/[slug]. */
    slug: text("slug").notNull().unique(),
    propietarioId: uuid("propietario_id").references(() => usuarios.id, { onDelete: "set null" }),
    nombre: text("nombre").notNull(),
    tipo: text("tipo").notNull(),
    fundada: integer("fundada"),
    contactoNombre: text("contacto_nombre"),
    contactoRol: text("contacto_rol"),
    telefono: text("telefono"),
    cuit: text("cuit"),
    cue: text("cue"),
    direccion: text("direccion"),
    partido: text("partido"),
    provincia: text("provincia"),
    /** Texto de zona para mostrar, ej. "Villa Adelina, Vicente López". */
    zona: text("zona"),
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
    logoUrl: text("logo_url"),
    portadaUrl: text("portada_url"),
    descripcion: text("descripcion"),
    alumnos: integer("alumnos"),
    niveles: text("niveles"),
    turnos: text("turnos"),
    docentesPlanta: integer("docentes_planta"),
    verificada: boolean("verificada").notNull().default(false),
    plan: text("plan").notNull().default("fundador"),
    /* Vitrina pública */
    mision: text("mision"),
    vision: text("vision"),
    valores: text("valores").array().notNull().default(sql`'{}'::text[]`),
    horarioAdministracion: text("horario_administracion"),
    /* Facturación (los medios de pago reales los guarda el proveedor de cobro; acá solo la etiqueta) */
    medioPago: text("medio_pago"),
    diaCobro: integer("dia_cobro"),
    condicionFiscal: text("condicion_fiscal"),
    /** Backoffice: una cuenta suspendida no puede entrar a su área (ver requerirInstitucion). */
    suspendida: boolean("suspendida").notNull().default(false),
    /**
     * Cuándo el equipo procesó la baja de la cuenta (src/lib/queries/baja-institucion.ts). Una institución dada de baja queda como
     * un registro mínimo para lo fiscal (nombre, CUIT, domicilio y sus facturas) y siempre `suspendida = true`: nunca se reactiva.
     * Columna agregada a mano: `alter table instituciones add column if not exists baja_en timestamptz`.
     */
    bajaEn: timestamp("baja_en", { withTimezone: true }),
    /** Datos de ejemplo sembrados: se pueden borrar sin tocar cuentas reales. */
    esDemo: boolean("es_demo").notNull().default(false),
    ...marcasDeTiempo,
  },
  (t) => [index("instituciones_propietario_idx").on(t.propietarioId)],
);

/**
 * Sedes: los lugares físicos de una institución (un colegio con sede Olivos y sede Pilar). Toda institución tiene siempre una
 * sede principal (índice único parcial). Las columnas de ubicación de `instituciones` (dirección, partido, provincia, zona,
 * lat, lng y CUE) son un ESPEJO de la sede principal: se mantienen juntas (`src/lib/queries/sedes.ts`) y sirven a lo que lee
 * "la institución" sin pensar en sedes. Lo que depende de DÓNDE es la búsqueda (km, mapa, dirección) lee `busquedas.sede_id`.
 * Tabla creada a mano en la base (con RLS), como la columna `busquedas.sede_id`: ver CLAUDE.md.
 */
export const institucionSedes = pgTable(
  "institucion_sedes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    institucionId: uuid("institucion_id")
      .notNull()
      .references(() => instituciones.id, { onDelete: "cascade" }),
    /** "Olivos", "Sede Pilar": cómo la llama la institución. La principal arranca como "Sede principal". */
    nombre: text("nombre").notNull(),
    direccion: text("direccion"),
    partido: text("partido"),
    provincia: text("provincia"),
    /** Texto de zona para mostrar y cruzar con las zonas de los profesionales, ej. "Villa Adelina, Vicente López". */
    zona: text("zona"),
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
    /** Código del establecimiento (escuelas): identifica a la sede, no a toda la organización. Lo carga el equipo. */
    cue: text("cue"),
    esPrincipal: boolean("es_principal").notNull().default(false),
    ...marcasDeTiempo,
  },
  (t) => [
    index("institucion_sedes_institucion_idx").on(t.institucionId),
    uniqueIndex("institucion_sedes_principal_uq").on(t.institucionId).where(sql`${t.esPrincipal}`),
  ],
);
export type InstitucionSede = typeof institucionSedes.$inferSelect;

export const institucionMiembros = pgTable(
  "institucion_miembros",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    institucionId: uuid("institucion_id")
      .notNull()
      .references(() => instituciones.id, { onDelete: "cascade" }),
    /** Null mientras la invitación no fue aceptada. */
    usuarioId: uuid("usuario_id").references(() => usuarios.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    nombre: text("nombre"),
    rol: text("rol").notNull().default("administrador"), // dueno | administrador | colaborador
    estado: text("estado").notNull().default("invitado"), // activo | invitado
    ...marcasDeTiempo,
  },
  (t) => [uniqueIndex("miembros_inst_email_uq").on(t.institucionId, t.email)],
);

export const docentes = pgTable(
  "docentes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Null en perfiles de ejemplo sin cuenta. */
    usuarioId: uuid("usuario_id")
      .unique()
      .references(() => usuarios.id, { onDelete: "set null" }),
    nombre: text("nombre").notNull(),
    apellido: text("apellido").notNull().default(""),
    categoria: categoriaDocente("categoria").notNull().default("educador"),
    subtitulo: text("subtitulo"),
    resumen: text("resumen"),
    fotoUrl: text("foto_url"),
    telefono: text("telefono"),
    email: text("email"),
    zonas: text("zonas").array().notNull().default(sql`'{}'::text[]`),
    asignaturas: text("asignaturas").array().notNull().default(sql`'{}'::text[]`),
    /** "Turno mañana", "Turno tarde", "Contraturno / sábados"… */
    disponibilidad: text("disponibilidad").array().notNull().default(sql`'{}'::text[]`),
    niveles: text("niveles").array().notNull().default(sql`'{}'::text[]`),
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
    radioKm: integer("radio_km").notNull().default(30),
    aniosExperiencia: integer("anios_experiencia"),
    experiencia: jsonb("experiencia")
      .$type<{ titulo: string; fechas: string; desc: string }[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    formacion: jsonb("formacion")
      .$type<{ titulo: string; detalle: string }[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    cvUrl: text("cv_url"),
    verificacion: estadoVerificacion("verificacion").notNull().default("pendiente"),
    tituloVerificado: boolean("titulo_verificado").notNull().default(false),
    antecedentesVerificados: boolean("antecedentes_verificados").notNull().default(false),
    /** Motivo cuando el backoffice pide una corrección o rechaza (se le muestra al docente). */
    verificacionNota: text("verificacion_nota"),
    verificacionRevisadaEn: timestamp("verificacion_revisada_en", { withTimezone: true }),
    /** Backoffice: una cuenta suspendida no puede entrar a su área (ver requerirDocente). */
    suspendido: boolean("suspendido").notNull().default(false),
    /**
     * "Compartir mi perfil": con valor, el perfil tiene página pública en /profesional/<token> (sin contacto ni documentos);
     * null = apagado (lo decide la persona en Mi perfil). Apagarlo borra el token y prenderlo de nuevo crea uno nuevo.
     * Agregada a mano en la base (alter table … add column), como el examen preocupacional.
     */
    compartirToken: text("compartir_token").unique(),
    onboardingCompleto: boolean("onboarding_completo").notNull().default(false),
    esDemo: boolean("es_demo").notNull().default(false),
    ...marcasDeTiempo,
  },
  (t) => [index("docentes_categoria_idx").on(t.categoria), index("docentes_verificacion_idx").on(t.verificacion)],
);

/* ───────────────────────────── Núcleo del marketplace ───────────────────────────── */

export const busquedas = pgTable(
  "busquedas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    institucionId: uuid("institucion_id")
      .notNull()
      .references(() => instituciones.id, { onDelete: "cascade" }),
    puesto: text("puesto").notNull(),
    categoria: categoriaDocente("categoria").notNull().default("educador"),
    disciplina: text("disciplina").notNull(),
    nivel: text("nivel"),
    /** Titular | Suplencia | Temporada | Freelance */
    tipo: text("tipo").notNull().default("Titular"),
    /** Suplencia rápida / urgente: aparece en "Búsquedas rápidas". */
    rapida: boolean("rapida").notNull().default(false),
    cargaHoraria: text("carga_horaria"),
    turno: text("turno"),
    horario: text("horario"),
    fechaInicio: date("fecha_inicio"),
    zona: text("zona"),
    /**
     * En qué sede es la búsqueda: de ahí salen los km, el mapa y la dirección. Null en búsquedas viejas o si se borró la sede
     * (cerrada): se lee como la sede principal. Columna agregada a mano en la base.
     */
    sedeId: uuid("sede_id").references(() => institucionSedes.id, { onDelete: "set null" }),
    descripcion: text("descripcion"),
    requisitos: text("requisitos").array().notNull().default(sql`'{}'::text[]`),
    beneficios: text("beneficios").array().notNull().default(sql`'{}'::text[]`),
    estado: estadoBusqueda("estado").notNull().default("activa"),
    /** Para las rápidas: hasta cuándo se acepta respuesta. */
    venceEn: timestamp("vence_en", { withTimezone: true }),
    cerradaEn: timestamp("cerrada_en", { withTimezone: true }),
    ...marcasDeTiempo,
  },
  (t) => [
    index("busquedas_institucion_idx").on(t.institucionId),
    index("busquedas_estado_idx").on(t.estado),
    index("busquedas_rapida_idx").on(t.rapida),
  ],
);

export const postulaciones = pgTable(
  "postulaciones",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    busquedaId: uuid("busqueda_id")
      .notNull()
      .references(() => busquedas.id, { onDelete: "cascade" }),
    docenteId: uuid("docente_id")
      .notNull()
      .references(() => docentes.id, { onDelete: "cascade" }),
    etapa: etapaPostulacion("etapa").notNull().default("nuevos"),
    origen: origenPostulacion("origen").notNull().default("postulacion"),
    mensaje: text("mensaje"),
    entrevistaEn: timestamp("entrevista_en", { withTimezone: true }),
    entrevistaTitulo: text("entrevista_titulo"),
    /**
     * La respuesta del profesional a la entrevista que agendó la institución: "voy" o "no_puedo" (con un mensaje opcional, p. ej.
     * otro día que le quede bien). Se borra cuando la institución cambia la fecha o la quita. Agregadas a mano con `pnpm db:entrevista`.
     */
    entrevistaRespuesta: text("entrevista_respuesta").$type<"voy" | "no_puedo">(),
    entrevistaRespuestaEn: timestamp("entrevista_respuesta_en", { withTimezone: true }),
    entrevistaRespuestaMensaje: text("entrevista_respuesta_mensaje"),
    /**
     * La agenda PERSONAL del profesional (un recordatorio propio: "llamar a la directora"). Es aparte de `entrevistaEn`, que es la
     * entrevista que agenda la institución: si compartieran columna, el profesional podría borrarla o la institución verla como suya.
     * Agregadas a mano (alter table … add column).
     */
    agendaDocenteEn: timestamp("agenda_docente_en", { withTimezone: true }),
    agendaDocenteTitulo: text("agenda_docente_titulo"),
    /** Cuándo la institución anotó que el docente hizo el examen preocupacional (etapa `examen_preocupacional`); null = pendiente. */
    examenPreocupacionalEn: timestamp("examen_preocupacional_en", { withTimezone: true }),
    /** Archivos del estudio (paths del bucket privado + nombre original): ver src/lib/examen-preocupacional.ts. */
    examenPreocupacionalArchivos: jsonb("examen_preocupacional_archivos").$type<{ path: string; nombre: string }[]>().notNull().default(sql`'[]'::jsonb`),
    /** Cuándo entró a la etapa actual (para "3 días acá"). */
    etapaDesde: timestamp("etapa_desde", { withTimezone: true }).notNull().defaultNow(),
    ...marcasDeTiempo,
  },
  (t) => [
    uniqueIndex("postulaciones_busqueda_docente_uq").on(t.busquedaId, t.docenteId),
    index("postulaciones_docente_idx").on(t.docenteId),
    index("postulaciones_etapa_idx").on(t.busquedaId, t.etapa),
  ],
);

/** Notas privadas sobre una postulación: cada lado ve solo las suyas ("Mis notas"). */
export const postulacionNotas = pgTable(
  "postulacion_notas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    postulacionId: uuid("postulacion_id")
      .notNull()
      .references(() => postulaciones.id, { onDelete: "cascade" }),
    autor: text("autor").notNull(), // docente | institucion
    usuarioId: uuid("usuario_id").references(() => usuarios.id, { onDelete: "set null" }),
    texto: text("texto").notNull(),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("postulacion_notas_idx").on(t.postulacionId, t.autor)],
);

export const notificaciones = pgTable(
  "notificaciones",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    usuarioId: uuid("usuario_id")
      .notNull()
      .references(() => usuarios.id, { onDelete: "cascade" }),
    /** postulacion | invitacion | entrevista | urgente | vista | verificacion | sistema */
    tipo: text("tipo").notNull(),
    titulo: text("titulo").notNull(),
    texto: text("texto").notNull(),
    enlace: text("enlace"),
    leida: boolean("leida").notNull().default(false),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("notificaciones_usuario_idx").on(t.usuarioId, t.leida)],
);

/** Favoritos genéricos: un docente guarda instituciones/búsquedas; una institución guarda docentes. */
export const favoritos = pgTable(
  "favoritos",
  {
    usuarioId: uuid("usuario_id")
      .notNull()
      .references(() => usuarios.id, { onDelete: "cascade" }),
    tipo: text("tipo").notNull(), // institucion | docente | busqueda
    refId: uuid("ref_id").notNull(),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.usuarioId, t.tipo, t.refId] })],
);

/* ───────────────────────────── Cursos ───────────────────────────── */

export const cursos = pgTable(
  "cursos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    institucionId: uuid("institucion_id")
      .notNull()
      .references(() => instituciones.id, { onDelete: "cascade" }),
    titulo: text("titulo").notNull(),
    subtitulo: text("subtitulo"),
    descripcion: text("descripcion"),
    modalidad: text("modalidad").notNull().default("Presencial"), // Presencial | Online
    profesor: text("profesor"),
    fechaInicio: date("fecha_inicio"),
    fechaFinal: date("fecha_final"),
    horario: text("horario"),
    direccion: text("direccion"),
    // Dónde queda la dirección (se ubica sola al guardar un curso presencial): sirve para mostrar a cuántos km está.
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
    partido: text("partido"),
    provincia: text("provincia"),
    link: text("link"),
    certifica: boolean("certifica").notNull().default(true),
    puntaje: integer("puntaje"),
    fotoUrl: text("foto_url"),
    ...marcasDeTiempo,
  },
  (t) => [index("cursos_institucion_idx").on(t.institucionId)],
);

export const inscripcionesCurso = pgTable(
  "inscripciones_curso",
  {
    cursoId: uuid("curso_id")
      .notNull()
      .references(() => cursos.id, { onDelete: "cascade" }),
    docenteId: uuid("docente_id")
      .notNull()
      .references(() => docentes.id, { onDelete: "cascade" }),
    terminoEn: date("termino_en"),
    certificadoEnviado: boolean("certificado_enviado").notNull().default(false),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.cursoId, t.docenteId] })],
);

/* ───────────────────────────── Catálogos y contenido ───────────────────────────── */

/** categoría → rubro → asignatura. Lo edita el backoffice (Categorías). */
export const asignaturas = pgTable(
  "asignaturas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    categoria: categoriaDocente("categoria").notNull(),
    rubro: text("rubro").notNull(),
    nombre: text("nombre").notNull(),
    orden: integer("orden").notNull().default(0),
  },
  (t) => [uniqueIndex("asignaturas_categoria_nombre_uq").on(t.categoria, t.nombre)],
);

export const zonas = pgTable("zonas", {
  id: uuid("id").primaryKey().defaultRandom(),
  nombre: text("nombre").notNull().unique(),
  partido: text("partido"),
  provincia: text("provincia").notNull().default("Buenos Aires"),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  orden: integer("orden").notNull().default(0),
});

export const testimonios = pgTable("testimonios", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** home | educadores | entrenadores | guardavidas */
  pagina: text("pagina").notNull().default("home"),
  cita: text("cita").notNull(),
  autor: text("autor").notNull(),
  cargo: text("cargo").notNull(),
  fotoUrl: text("foto_url"),
  orden: integer("orden").notNull().default(0),
});

/* ───────────────────────────── Relaciones ───────────────────────────── */

export const usuariosRelations = relations(usuarios, ({ one, many }) => ({
  docente: one(docentes, { fields: [usuarios.id], references: [docentes.usuarioId] }),
  institucionesPropias: many(instituciones),
  notificaciones: many(notificaciones),
}));

export const institucionesRelations = relations(instituciones, ({ one, many }) => ({
  propietario: one(usuarios, { fields: [instituciones.propietarioId], references: [usuarios.id] }),
  miembros: many(institucionMiembros),
  busquedas: many(busquedas),
  cursos: many(cursos),
}));

export const institucionMiembrosRelations = relations(institucionMiembros, ({ one }) => ({
  institucion: one(instituciones, { fields: [institucionMiembros.institucionId], references: [instituciones.id] }),
  usuario: one(usuarios, { fields: [institucionMiembros.usuarioId], references: [usuarios.id] }),
}));

export const docentesRelations = relations(docentes, ({ one, many }) => ({
  usuario: one(usuarios, { fields: [docentes.usuarioId], references: [usuarios.id] }),
  postulaciones: many(postulaciones),
  inscripciones: many(inscripcionesCurso),
}));

export const busquedasRelations = relations(busquedas, ({ one, many }) => ({
  institucion: one(instituciones, { fields: [busquedas.institucionId], references: [instituciones.id] }),
  postulaciones: many(postulaciones),
}));

export const postulacionesRelations = relations(postulaciones, ({ one, many }) => ({
  busqueda: one(busquedas, { fields: [postulaciones.busquedaId], references: [busquedas.id] }),
  docente: one(docentes, { fields: [postulaciones.docenteId], references: [docentes.id] }),
  notas: many(postulacionNotas),
}));

export const postulacionNotasRelations = relations(postulacionNotas, ({ one }) => ({
  postulacion: one(postulaciones, { fields: [postulacionNotas.postulacionId], references: [postulaciones.id] }),
}));

export const notificacionesRelations = relations(notificaciones, ({ one }) => ({
  usuario: one(usuarios, { fields: [notificaciones.usuarioId], references: [usuarios.id] }),
}));

export const cursosRelations = relations(cursos, ({ one, many }) => ({
  institucion: one(instituciones, { fields: [cursos.institucionId], references: [instituciones.id] }),
  inscripciones: many(inscripcionesCurso),
}));

export const inscripcionesCursoRelations = relations(inscripcionesCurso, ({ one }) => ({
  curso: one(cursos, { fields: [inscripcionesCurso.cursoId], references: [cursos.id] }),
  docente: one(docentes, { fields: [inscripcionesCurso.docenteId], references: [docentes.id] }),
}));

export type Usuario = typeof usuarios.$inferSelect;
export type Institucion = typeof instituciones.$inferSelect;
export type Docente = typeof docentes.$inferSelect;
export type Busqueda = typeof busquedas.$inferSelect;
export type Postulacion = typeof postulaciones.$inferSelect;
export type Notificacion = typeof notificaciones.$inferSelect;
export type Curso = typeof cursos.$inferSelect;
export type EtapaPostulacion = (typeof etapaPostulacion.enumValues)[number];
export type CategoriaDocente = (typeof categoriaDocente.enumValues)[number];
export type RolUsuario = (typeof rolUsuario.enumValues)[number];

/* ───────────────────────────── Paquete C2 · Docente: perfil, instituciones y cursos ───────────────────────────── */

/** "Enviá tu CV a esta institución": una vez por par docente–institución. */
export const cvEnviados = pgTable(
  "cv_enviados",
  {
    docenteId: uuid("docente_id")
      .notNull()
      .references(() => docentes.id, { onDelete: "cascade" }),
    institucionId: uuid("institucion_id")
      .notNull()
      .references(() => instituciones.id, { onDelete: "cascade" }),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.docenteId, t.institucionId] })],
);

/**
 * Contactos privados de una institución: profesionales que ya conoce o tiene en una planilla, cargados a mano o por
 * CSV desde Profesionales. No son docentes de UNIDOAR (sin cuenta, sin verificación, fuera de las búsquedas): los ve
 * solo la institución, y todo lo que se lea o escriba se filtra por `institucion_id`.
 */
export const contactosInstitucion = pgTable(
  "contactos_institucion",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    institucionId: uuid("institucion_id")
      .notNull()
      .references(() => instituciones.id, { onDelete: "cascade" }),
    /** Nombre y apellido, como lo escribió la institución. */
    nombre: text("nombre").notNull(),
    /** En minúsculas. Hay siempre al menos uno de email y teléfono (lo valida src/lib/contactos.ts). */
    email: text("email"),
    telefono: text("telefono"),
    disciplina: text("disciplina"),
    nota: text("nota"),
    /** manual | csv */
    origen: text("origen").notNull().default("manual"),
    creadoPor: uuid("creado_por").references(() => usuarios.id, { onDelete: "set null" }),
    ...marcasDeTiempo,
  },
  (t) => [
    index("contactos_institucion_idx").on(t.institucionId, t.creadoEn),
    // Los NULL no chocan entre sí: solo evita repetir un mismo email dentro de una institución.
    uniqueIndex("contactos_institucion_email_uq").on(t.institucionId, t.email),
  ],
);

/**
 * Cola de mails de la app (patrón "outbox"). Cada mail se anota acá DENTRO de la misma transacción que guarda el
 * cambio que lo origina, y se manda después de confirmada (src/lib/correo/cola.ts): si la transacción se deshace, no
 * sale ningún mail, y si el envío falla se reintenta. Quedan también como registro de lo que se mandó.
 */
export const colaCorreos = pgTable(
  "cola_correos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
    /** Email del destinatario (uno por fila). */
    para: text("para").notNull(),
    /** Cuenta destinataria, si la tiene: sirve para respetar sus preferencias y los topes por día. */
    usuarioId: uuid("usuario_id").references(() => usuarios.id, { onDelete: "set null" }),
    /** "M12", "M24"…: ver docs/inventario-de-mails.md y src/lib/correo/plantillas.ts. */
    plantilla: text("plantilla").notNull(),
    /** cuenta | contratacion | facturacion | interno */
    grupo: text("grupo").notNull(),
    /** Lo que necesita la plantilla para armar el mail (los enlaces van como ruta, no como URL completa). */
    datos: jsonb("datos").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    /** Evita repetir el mismo mail: no se anotan dos filas con la misma clave para el mismo destinatario. */
    clave: text("clave"),
    /** Agrupa los mails que cuentan para un tope por día ("M21:<usuario>"). */
    topeClave: text("tope_clave"),
    /** pendiente | procesando | enviado | omitido | fallido */
    estado: text("estado").notNull().default("pendiente"),
    intentos: integer("intentos").notNull().default(0),
    reclamadoEn: timestamp("reclamado_en", { withTimezone: true }),
    enviadoEn: timestamp("enviado_en", { withTimezone: true }),
    /** Por qué se omitió o falló. */
    motivo: text("motivo"),
    /** Id del mensaje en Resend (o "consola" cuando se probó sin enviar). */
    resendId: text("resend_id"),
  },
  (t) => [
    index("cola_correos_estado_idx").on(t.estado, t.creadoEn),
    uniqueIndex("cola_correos_clave_uq").on(t.clave, t.para),
    index("cola_correos_tope_idx").on(t.topeClave, t.creadoEn),
  ],
);
export type CorreoEnCola = typeof colaCorreos.$inferSelect;

/* ───────────────────────────── Paquete A1 · Sitio público ───────────────────────────── */

/** Mensajes del formulario de /contacto (los lee el equipo desde el backoffice o la base). */
export const mensajesContacto = pgTable("mensajes_contacto", {
  id: uuid("id").primaryKey().defaultRandom(),
  nombre: text("nombre").notNull(),
  email: text("email").notNull(),
  /** Quién escribe: Institución | Docente | Entrenador/a / Instructor/a | Guardavidas | Otro. */
  rol: text("rol").notNull(),
  mensaje: text("mensaje").notNull(),
  /** Backoffice (Mensajes): el equipo ya lo respondió o resolvió. */
  atendido: boolean("atendido").notNull().default(false),
  creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
});

export type MensajeContacto = typeof mensajesContacto.$inferSelect;

/* ───────────────────────────── Paquete A2 · Acceso y altas ───────────────────────────── */

export type EstadoCeldaDisponibilidad = "disponible" | "convenir" | "ocupada";
/** Grilla semanal del alta: 3 franjas × 6 días (lunes a sábado). `docentes.disponibilidad` se deriva de ella. */
export type GrillaDisponibilidad = Record<"manana" | "tarde" | "contraturno", EstadoCeldaDisponibilidad[]>;
/** Paths del bucket privado de Storage (nunca URLs): las firmadas se generan al leer. */
export type DocumentosDocente = Partial<Record<"dniFrente" | "dniDorso" | "credencial" | "constancia" | "conducta", string>>;

/**
 * Datos del docente que no se listan ni se filtran y que no deben salir en consultas públicas
 * (DNI, CUIL, fecha de nacimiento, domicilio), más lo que el alta guarda y `docentes` no tiene
 * columna para guardar: situación de estudio, grilla semanal y documentación subida.
 * Una fila por docente; se crea en el onboarding (paso "¿Qué sos?").
 */
export const docenteDetalle = pgTable("docente_detalle", {
  docenteId: uuid("docente_id")
    .primaryKey()
    .references(() => docentes.id, { onDelete: "cascade" }),
  fechaNacimiento: date("fecha_nacimiento"),
  dni: text("dni"),
  cuil: text("cuil"),
  direccion: text("direccion"),
  partido: text("partido"),
  provincia: text("provincia"),
  /** recibido | estudiante (a quien todavía cursa no se le pide título: se le pide la constancia de alumno regular). */
  situacionEstudio: text("situacion_estudio"),
  /**
   * Solo si es estudiante: qué porcentaje de las materias tiene aprobado (0 a 100). Lo declara la persona y lo respalda la
   * constancia de alumno regular (`documentos.constancia`). Null si ya se recibió. Agregada a mano en la base (alter table).
   */
  porcentajeMaterias: integer("porcentaje_materias"),
  grillaDisponibilidad: jsonb("grilla_disponibilidad").$type<GrillaDisponibilidad>(),
  documentos: jsonb("documentos")
    .$type<DocumentosDocente>()
    .notNull()
    .default(sql`'{}'::jsonb`),
  ...marcasDeTiempo,
});

export type DocenteDetalle = typeof docenteDetalle.$inferSelect;

/* ───────────────────────────── Segunda tanda · Vitrina, plan y backoffice (tablas compartidas) ───────────────────────────── */

/** Novedades que la institución publica en su vitrina ("Abrimos inscripción a Nivel Inicial 2027"). */
export const institucionNovedades = pgTable(
  "institucion_novedades",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    institucionId: uuid("institucion_id")
      .notNull()
      .references(() => instituciones.id, { onDelete: "cascade" }),
    titulo: text("titulo").notNull(),
    texto: text("texto").notNull(),
    /** Fecha que se muestra ("12 AGO"); por defecto la de carga. */
    fecha: date("fecha").notNull().default(sql`current_date`),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("institucion_novedades_idx").on(t.institucionId, t.fecha)],
);

/** Galería de instalaciones de la vitrina (URLs públicas del bucket `publico`, carpeta instalaciones). */
export const institucionFotos = pgTable(
  "institucion_fotos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    institucionId: uuid("institucion_id")
      .notNull()
      .references(() => instituciones.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    /** "Patio y canchas", "Natatorio"… */
    etiqueta: text("etiqueta"),
    orden: integer("orden").notNull().default(0),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("institucion_fotos_idx").on(t.institucionId, t.orden)],
);

/**
 * Cobros de planes. Todavía no hay pasarela de pago conectada: las facturas las carga el backoffice
 * (o el seed). Cuando se integre Mercado Pago, la pasarela escribe acá.
 */
export const facturas = pgTable(
  "facturas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    institucionId: uuid("institucion_id")
      .notNull()
      .references(() => instituciones.id, { onDelete: "cascade" }),
    /** Clave de src/lib/planes.ts al momento del cobro. */
    plan: text("plan").notNull(),
    /** Pesos argentinos enteros. */
    monto: integer("monto").notNull(),
    /** "2026-09": mes que se cobra. */
    periodo: text("periodo").notNull(),
    /** Cuándo vence o venció el cobro. */
    fechaCobro: date("fecha_cobro").notNull(),
    /** pagada | pendiente | vencida */
    estado: text("estado").notNull().default("pendiente"),
    pagadaEn: timestamp("pagada_en", { withTimezone: true }),
    /** "Transferencia", "Tarjeta", "Débito automático"… */
    medio: text("medio"),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("facturas_inst_periodo_uq").on(t.institucionId, t.periodo), index("facturas_estado_idx").on(t.estado)],
);

/**
 * Pedidos de cambio de plan. Sin pasarela de pago, "Cambiar de plan" no cobra ni cambia el plan:
 * deja un pedido que atiende el backoffice (Cobros) y recién ahí se actualiza `instituciones.plan`.
 */
export const solicitudesPlan = pgTable(
  "solicitudes_plan",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    institucionId: uuid("institucion_id")
      .notNull()
      .references(() => instituciones.id, { onDelete: "cascade" }),
    planActual: text("plan_actual").notNull(),
    planSolicitado: text("plan_solicitado").notNull(),
    /** pendiente | aprobada | rechazada */
    estado: text("estado").notNull().default("pendiente"),
    nota: text("nota"),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
    atendidaEn: timestamp("atendida_en", { withTimezone: true }),
  },
  (t) => [index("solicitudes_plan_estado_idx").on(t.estado, t.creadoEn)],
);

/** Registro de lo que hace el equipo desde el backoffice (verificar, suspender, cambiar planes…). */
export const auditoria = pgTable(
  "auditoria",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    usuarioId: uuid("usuario_id").references(() => usuarios.id, { onDelete: "set null" }),
    /** "docente.verificar", "institucion.suspender", "plan.aprobar"… */
    accion: text("accion").notNull(),
    entidad: text("entidad").notNull(), // docente | institucion | factura | asignatura…
    entidadId: text("entidad_id").notNull(),
    detalle: jsonb("detalle").$type<Record<string, unknown>>(),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("auditoria_entidad_idx").on(t.entidad, t.entidadId), index("auditoria_fecha_idx").on(t.creadoEn)],
);

export type InstitucionNovedad = typeof institucionNovedades.$inferSelect;
export type InstitucionFoto = typeof institucionFotos.$inferSelect;
export type Factura = typeof facturas.$inferSelect;

/**
 * Los planes de las instituciones: lo que se cobra y cómo se llama cada uno, editable desde el backoffice (/backoffice/planes). Las
 * claves son fijas (las referencian `instituciones.plan` y `facturas.plan`): se editan precio, nombre, textos y si se ofrece. Si una
 * fila falta o está rota, la app usa los valores de lanzamiento de `src/lib/planes.ts`. Tabla creada a mano con `pnpm db:planes`.
 */
export const planes = pgTable("planes", {
  clave: text("clave").primaryKey(),
  etiqueta: text("etiqueta").notNull(),
  /** Pesos por mes (por año en el plan Anual; por sede en Multisede). Los meses ya facturados no cambian: `facturas.monto` guarda lo cobrado. */
  precio: integer("precio").notNull(),
  resumen: text("resumen").notNull().default(""),
  detalle: text("detalle").notNull().default(""),
  vigente: boolean("vigente").notNull().default(true),
  ...marcasDeTiempo,
});
export type PlanFila = typeof planes.$inferSelect;

/** Condiciones de los planes (una sola fila, `id = 1`): desde cuántas sedes es Multisede, el pack por adelantado y qué tipos pagan el arancel de colegios. */
export const planesCondiciones = pgTable("planes_condiciones", {
  id: integer("id").primaryKey().default(1),
  sedesMultisede: integer("sedes_multisede").notNull(),
  packMeses: integer("pack_meses").notNull(),
  packMesesPagos: integer("pack_meses_pagos").notNull(),
  packMesesReferido: integer("pack_meses_referido").notNull(),
  tiposColegio: text("tipos_colegio").array().notNull(),
  ...marcasDeTiempo,
});
export type PlanesCondiciones = typeof planesCondiciones.$inferSelect;
export type SolicitudPlan = typeof solicitudesPlan.$inferSelect;
export type ContactoInstitucion = typeof contactosInstitucion.$inferSelect;
