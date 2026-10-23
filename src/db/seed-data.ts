import type { PlanClave } from "@/lib/planes";
import type { CategoriaDocente, EtapaPostulacion } from "./schema";

/*
 * Datos de ejemplo, tomados del prototipo y normalizados para que sean coherentes
 * entre pantallas. Todo lo "demo" se marca es_demo=true y se puede borrar sin tocar
 * cuentas reales (ver src/db/seed.ts).
 */

/* ───────── Catálogos (reales, no demo) ───────── */

/** [nombre, partido, provincia, lat, lng] — posiciones del mapa del prototipo. */
export const ZONAS: [string, string, string, number, number][] = [
  ["Nordelta", "Tigre", "Buenos Aires", -34.403, -58.648],
  ["Tigre", "Tigre", "Buenos Aires", -34.4264, -58.5796],
  ["Boulogne", "San Isidro", "Buenos Aires", -34.506, -58.566],
  ["San Isidro", "San Isidro", "Buenos Aires", -34.4708, -58.513],
  ["Martínez", "San Isidro", "Buenos Aires", -34.488, -58.506],
  ["Villa Adelina", "Vicente López", "Buenos Aires", -34.523, -58.548],
  ["Munro", "Vicente López", "Buenos Aires", -34.53, -58.523],
  ["Olivos", "Vicente López", "Buenos Aires", -34.51, -58.493],
  ["Florida", "Vicente López", "Buenos Aires", -34.539, -58.493],
  ["Vicente López", "Vicente López", "Buenos Aires", -34.528, -58.479],
  ["Núñez", "CABA", "Ciudad Autónoma de Buenos Aires", -34.545, -58.46],
  ["Belgrano", "CABA", "Ciudad Autónoma de Buenos Aires", -34.562, -58.456],
  ["Palermo", "CABA", "Ciudad Autónoma de Buenos Aires", -34.578, -58.425],
];

export const CATALOGO_ASIGNATURAS: Record<CategoriaDocente, { rubro: string; items: string[] }[]> = {
  educador: [
    { rubro: "Exactas y naturales", items: ["Matemática", "Física", "Química", "Biología", "Ciencias Naturales", "Informática"] },
    { rubro: "Lengua y sociales", items: ["Lengua", "Literatura", "Historia", "Geografía", "Ciencias Sociales", "Formación Ética"] },
    { rubro: "Arte y música", items: ["Música", "Plástica", "Teatro", "Danza", "Audiovisuales"] },
    { rubro: "Idiomas", items: ["Inglés", "Portugués", "Francés", "Italiano", "Alemán"] },
    { rubro: "Nivel inicial y primario", items: ["Nivel Inicial", "Maestro/a de grado", "Apoyo escolar", "Psicopedagogía"] },
    { rubro: "Educación física", items: ["Educación Física", "Deportes escolares", "Expresión corporal", "Natación"] },
  ],
  entrenador: [
    { rubro: "Deportes de equipo", items: ["Fútbol", "Vóley", "Básquet", "Handball", "Hockey", "Rugby"] },
    { rubro: "Deportes individuales", items: ["Tenis", "Atletismo", "Artes marciales", "Boxeo", "Golf", "Equitación"] },
    { rubro: "Gimnasio y fitness", items: ["Musculación", "Funcional", "Spinning", "Pilates", "Yoga", "Entrenamiento personal"] },
    { rubro: "Actividades acuáticas", items: ["Natación", "Aquagym", "Waterpolo"] },
    { rubro: "Otras disciplinas", items: ["Danza deportiva", "Escalada", "Preparación física", "Expresión corporal"] },
  ],
  guardavidas: [
    { rubro: "Pileta y natatorio", items: ["Pileta cubierta", "Pileta al aire libre", "Natatorio de club", "Escuela de natación", "Natación"] },
    { rubro: "Playa, río y laguna", items: ["Playa", "Río", "Laguna", "Balneario"] },
    { rubro: "Colonias y temporada", items: ["Colonia de vacaciones", "Campamento", "Eventos deportivos"] },
    { rubro: "Formación y apoyo", items: ["Primeros auxilios", "RCP", "Natación para principiantes"] },
  ],
};

export const TESTIMONIOS: { pagina: string; cita: string; autor: string; cargo: string; fotoUrl: string }[] = [
  { pagina: "home", cita: "Cubrimos una licencia de Matemática en dos días. Antes tardábamos semanas.", autor: "Marina Costa", cargo: "Vicedirectora · Colegio San Andrés del Norte", fotoUrl: "/assets/persona-f5.jpg" },
  { pagina: "home", cita: "Publicamos la búsqueda un lunes y el jueves ya teníamos entrevistas agendadas.", autor: "Esteban Roldán", cargo: "Director · Instituto Vicente López", fotoUrl: "/assets/persona-m4.jpg" },
  { pagina: "home", cita: "Nos sirvió sobre todo para las suplencias urgentes: antes eran puro WhatsApp.", autor: "Carla Núñez", cargo: "Coordinadora · Colegio del Árbol", fotoUrl: "/assets/persona-f1.jpg" },
  { pagina: "entrenadores", cita: "Cubrimos un profe de sala en tres días, con dos opciones para elegir.", autor: "Rodrigo Ianni", cargo: "Director deportivo · Club Náutico Olivos", fotoUrl: "/assets/persona-m1.jpg" },
  { pagina: "entrenadores", cita: "Nos sirvió sobre todo para las bajas de último momento antes de temporada.", autor: "Vanina Pardo", cargo: "Coordinadora · Gimnasio Full Body", fotoUrl: "/assets/persona-f2.jpg" },
  { pagina: "entrenadores", cita: "Vimos títulos y certificaciones antes de la primera entrevista.", autor: "Martín Curcio", cargo: "Encargado · Club Atlético Ribera", fotoUrl: "/assets/persona-m3.jpg" },
  { pagina: "guardavidas", cita: "Encontramos un guardavidas habilitado dos días antes de abrir la pileta.", autor: "Lucía Ferrer", cargo: "Encargada · Natatorio Sol de Mayo", fotoUrl: "/assets/persona-f3.jpg" },
  { pagina: "guardavidas", cita: "La verificación de habilitación nos ahorró un dolor de cabeza en plena temporada.", autor: "Gonzalo Prat", cargo: "Director · Club San Fernando", fotoUrl: "/assets/persona-m2.jpg" },
  { pagina: "guardavidas", cita: "Cubrimos los tres turnos de fin de semana sin depender de un solo contacto.", autor: "Marina Suárez", cargo: "Coordinadora · Colonia Vicente López", fotoUrl: "/assets/persona-f4.jpg" },
];

/* ───────── Instituciones demo ───────── */

type InstSeed = {
  slug: string;
  nombre: string;
  tipo: string;
  fundada?: number;
  direccion?: string;
  zona: string; // debe existir en ZONAS: da las coordenadas
  partido?: string;
  descripcion?: string;
  logoUrl?: string;
  portadaUrl?: string;
  alumnos?: number;
  niveles?: string;
  turnos?: string;
  docentesPlanta?: number;
  verificada: boolean;
  zonaTexto?: string;
  mision?: string;
  vision?: string;
  valores?: string[];
  horarioAdministracion?: string;
  plan?: PlanClave;
  medioPago?: string;
  diaCobro?: number;
  condicionFiscal?: string;
  cuit?: string;
};

export const INSTITUCIONES: InstSeed[] = [
  {
    slug: "sanandres", nombre: "Colegio San Andrés del Norte", tipo: "Colegio privado", fundada: 1978,
    direccion: "Av. de los Fresnos 2140, Villa Adelina", zona: "Villa Adelina", partido: "Vicente López", zonaTexto: "Villa Adelina, Vicente López",
    descripcion: "Colegio bilingüe de Nivel Inicial, Primario y Secundario en Vicente López.",
    logoUrl: "/assets/inst-logo-sanandres.png", portadaUrl: "/assets/sanandres-portada-fixed.jpg",
    alumnos: 640, niveles: "Inicial · Primario · Secundario", turnos: "Mañana y tarde", docentesPlanta: 48, verificada: true,
    mision: "Formar personas íntegras, bilingües y comprometidas con su comunidad.",
    vision: "Ser referentes en educación bilingüe de calidad en la zona norte del GBA.",
    valores: ["Respeto", "Compromiso", "Excelencia"], horarioAdministracion: "8 a 16 hs",
    plan: "colegio", medioPago: "Débito automático", diaCobro: 10, condicionFiscal: "Resp. inscripto", cuit: "30-71234567-8",
  },
  {
    slug: "ribera", nombre: "Club Atlético Ribera", tipo: "Club o gimnasio", fundada: 1952,
    direccion: "Av. del Libertador 4800, Núñez", zona: "Núñez", partido: "CABA",
    descripcion: "Club social y deportivo con escuela de natación activa todo el año y colonia de verano.",
    logoUrl: "/assets/inst-logo-ribera.png", alumnos: 1200, niveles: "Todas las edades", turnos: "Mañana, tarde y fin de semana",
    docentesPlanta: 22, verificada: true,
    plan: "deportiva", medioPago: "Transferencia", diaCobro: 5, condicionFiscal: "Resp. inscripto", cuit: "30-52123456-1",
  },
  {
    slug: "vicentelopez", nombre: "Instituto Vicente López", tipo: "Colegio privado", fundada: 1991,
    direccion: "Av. Maipú 1620, Vicente López", zona: "Vicente López", partido: "Vicente López",
    descripcion: "Instituto de Nivel Secundario y Terciario con orientación en ciencias sociales.",
    logoUrl: "/assets/inst-logo-vicentelopez.png", alumnos: 410, niveles: "Secundario · Terciario", turnos: "Mañana y tarde",
    docentesPlanta: 35, verificada: true,
    plan: "colegio", medioPago: "Tarjeta", diaCobro: 12, condicionFiscal: "Resp. inscripto", cuit: "30-69876543-2",
  },
  {
    slug: "fullbody", nombre: "Full Body Olivos", tipo: "Club o gimnasio", fundada: 2014,
    direccion: "Av. Maipú 3200, Olivos", zona: "Olivos", partido: "Vicente López",
    descripcion: "Gimnasio de barrio con clases grupales y entrenamiento funcional.",
    logoUrl: "/assets/inst-logo-fullbody.png", alumnos: 380, niveles: "Adultos", turnos: "Mañana, tarde y noche",
    docentesPlanta: 9, verificada: false,
    plan: "deportiva", medioPago: "Tarjeta", diaCobro: 8, condicionFiscal: "Monotributo", cuit: "20-33445566-7",
  },
  {
    slug: "aromos", nombre: "Jardín Los Aromos", tipo: "Jardín de infantes", fundada: 2003,
    direccion: "Av. de los Lagos 800, Nordelta", zona: "Nordelta", partido: "Tigre",
    descripcion: "Jardín maternal y de infantes con salas de 1 a 5 años, jornada simple y extendida.",
    logoUrl: "/assets/inst-logo-aromos.png", alumnos: 120, niveles: "Maternal · Inicial", turnos: "Jornada simple y extendida",
    docentesPlanta: 14, verificada: true,
    plan: "colegio", medioPago: "Transferencia", diaCobro: 1, condicionFiscal: "Resp. inscripto", cuit: "30-70111222-3",
  },
  // Solo para la tira "Confían en UNIDOAR" de la landing.
  { slug: "lincoln", nombre: "Colegio Lincoln", tipo: "Colegio privado", zona: "Vicente López", logoUrl: "/assets/logo-lincoln.png", verificada: true },
  { slug: "arbol", nombre: "La Escuela del Árbol", tipo: "Colegio privado", zona: "San Isidro", logoUrl: "/assets/logo-arbol.png", verificada: true },
  { slug: "stxavier", nombre: "St. Xavier", tipo: "Colegio privado", zona: "Olivos", logoUrl: "/assets/logo-stxavier.png", verificada: true },
  { slug: "stmatthews", nombre: "St. Matthew's College", tipo: "Colegio privado", zona: "Martínez", logoUrl: "/assets/logo-stmatthews.png", verificada: true },
  { slug: "stm", nombre: "STM", tipo: "Colegio privado", zona: "Boulogne", logoUrl: "/assets/logo-stm.png", verificada: true },
];

/* ───────── Docentes demo ───────── */

type DocSeed = {
  key: string;
  nombre: string;
  apellido: string;
  categoria: CategoriaDocente;
  subtitulo: string;
  resumen?: string;
  experiencia?: { titulo: string; fechas: string; desc: string }[];
  formacion?: { titulo: string; detalle: string }[];
  fotoUrl?: string;
  telefono?: string;
  zonas: string[];
  asignaturas: string[];
  disponibilidad: string[];
  niveles: string[];
  anios: number;
  verificado: boolean;
};

export const DOCENTES: DocSeed[] = [
  { key: "luciana", nombre: "Luciana", apellido: "Prieto", categoria: "educador", subtitulo: "Maestra de Nivel Inicial · 3 años de experiencia", resumen: "Maestra de Nivel Inicial con foco en estimulación temprana y trabajo con familias. Me manejo bien con salas numerosas y proyectos de expresión artística.", fotoUrl: "/assets/bgDocentes-fixed.jpg", telefono: "11 4455-3320", zonas: ["Tigre", "Nordelta"], asignaturas: ["Nivel Inicial", "Música"], disponibilidad: ["Turno mañana"], niveles: ["Inicial"], anios: 3, verificado: false },
  { key: "martina", nombre: "Martina", apellido: "Alsina", categoria: "educador", subtitulo: "Profesora de Ed. Física · 12 años", resumen: "Trabajo con grupos de primaria y secundaria desde 2014, con foco en deportes de conjunto y natación. Los últimos seis años armé el programa de vóley femenino de un colegio de Olivos, que pasó de dos equipos a seis. Me manejo bien con grupos numerosos y con chicos que llegan sin ninguna experiencia deportiva. Busco un cargo de 15 a 20 horas en Vicente López o alrededores, turno mañana.", experiencia: [{ titulo: "Profesora de Educación Física — Colegio Los Tilos, Olivos", fechas: "2020 — actualidad · Primario y Secundario · 18 hs semanales", desc: "Ed. Física de 4.º a 7.º grado y coordinación del vóley femenino. Organizo el torneo interescolar de septiembre." }, { titulo: "Profesora de Natación — Club Atlético Ribera, Vicente López", fechas: "2017 — 2020 · Colonia de verano y escuela de natación", desc: "Grupos de 6 a 12 años, iniciación y perfeccionamiento. Tres veranos a cargo de la pileta chica." }, { titulo: "Suplencias de Ed. Física — varios colegios de Zona Norte", fechas: "2014 — 2017", desc: "Reemplazos cortos y licencias largas en cinco instituciones de Vicente López y San Isidro." }], formacion: [{ titulo: "Profesorado Nacional de Educación Física", detalle: "Instituto Vicente López · 2014" }, { titulo: "Guardavidas — habilitación provincial", detalle: "Vigente hasta 12/2027" }, { titulo: "Primeros auxilios y RCP", detalle: "Actualizado en 2025" }], fotoUrl: "/assets/hero-entrenador.jpg", telefono: "11 4455-2201", zonas: ["Vicente López", "Olivos"], asignaturas: ["Educación Física", "Natación"], disponibilidad: ["Turno mañana"], niveles: ["Primario"], anios: 12, verificado: true },
  { key: "nicolas", nombre: "Nicolás", apellido: "Bermúdez", categoria: "educador", subtitulo: "Ed. Física · Olivos", resumen: "Profesor de Ed. Física con experiencia en nivel primario, orientado a deportes de conjunto.", telefono: "11 4455-6631", zonas: ["Olivos"], asignaturas: ["Educación Física"], disponibilidad: ["Turno mañana"], niveles: ["Primario"], anios: 5, verificado: true },
  { key: "julieta", nombre: "Julieta", apellido: "Pereyra", categoria: "educador", subtitulo: "Maestra Nivel Inicial · Munro", resumen: "Maestra de Nivel Inicial con experiencia en salas de 3 a 5 años y proyectos de expresión artística.", telefono: "11 4455-7712", zonas: ["Munro"], asignaturas: ["Nivel Inicial", "Educación Física"], disponibilidad: ["Turno tarde"], niveles: ["Inicial", "Primario"], anios: 6, verificado: false },
  { key: "gonzalo", nombre: "Gonzalo", apellido: "Sarmiento", categoria: "educador", subtitulo: "Ed. Física · Florida", resumen: "Profesor de Ed. Física con foco en deportes individuales y preparación física.", telefono: "11 4455-9012", zonas: ["Florida"], asignaturas: ["Educación Física"], disponibilidad: ["Turno mañana"], niveles: ["Primario", "Secundario"], anios: 6, verificado: true },
  { key: "facundo", nombre: "Facundo", apellido: "Ojeda", categoria: "guardavidas", subtitulo: "Profesor de Natación y guardavidas", resumen: "Profesor de Natación y guardavidas habilitado, con experiencia en colonias y escuelas de verano.", fotoUrl: "/assets/hero-guardavidas.jpg", telefono: "11 4455-3345", zonas: ["Vicente López", "Núñez"], asignaturas: ["Natación", "Pileta cubierta", "Colonia de vacaciones"], disponibilidad: ["Turno mañana"], niveles: ["Primario"], anios: 4, verificado: true },
  { key: "valeria", nombre: "Valeria", apellido: "Cortés", categoria: "educador", subtitulo: "Ed. Física · San Isidro", resumen: "Profesora de Ed. Física con experiencia en nivel primario y secundario.", telefono: "11 4455-4471", zonas: ["San Isidro"], asignaturas: ["Educación Física", "Nivel Inicial"], disponibilidad: ["Turno mañana"], niveles: ["Inicial", "Primario", "Secundario"], anios: 5, verificado: true },
  { key: "matias", nombre: "Matías", apellido: "Toledo", categoria: "educador", subtitulo: "Ed. Física · Vicente López", resumen: "Profesor de Ed. Física con trayectoria en coordinación de torneos escolares.", telefono: "11 4455-5521", zonas: ["Vicente López"], asignaturas: ["Educación Física", "Deportes escolares"], disponibilidad: ["Turno tarde"], niveles: ["Primario", "Secundario"], anios: 8, verificado: true },
  { key: "rocio", nombre: "Rocío", apellido: "Aguirre", categoria: "educador", subtitulo: "Ed. Física · Martínez", resumen: "Profesora de Ed. Física con trayectoria en natación y coordinación de torneos escolares.", telefono: "11 4455-1190", zonas: ["Martínez"], asignaturas: ["Educación Física", "Natación"], disponibilidad: ["Full time"], niveles: ["Primario", "Secundario"], anios: 9, verificado: true },
  { key: "leandro", nombre: "Leandro", apellido: "Vera", categoria: "educador", subtitulo: "Ed. Física · Olivos", resumen: "Profesor de Ed. Física con experiencia en nivel primario y secundario, orientado a deportes individuales.", telefono: "11 4455-8834", zonas: ["Olivos"], asignaturas: ["Educación Física"], disponibilidad: ["Turno mañana", "Turno tarde"], niveles: ["Primario", "Secundario"], anios: 7, verificado: true },
  { key: "paula", nombre: "Paula", apellido: "Domínguez", categoria: "educador", subtitulo: "Ed. Física · Villa Adelina", resumen: "Profesora de Ed. Física con foco en proyectos deportivos escolares.", telefono: "11 4455-5588", zonas: ["Villa Adelina"], asignaturas: ["Educación Física", "Nivel Inicial"], disponibilidad: ["Full time"], niveles: ["Inicial", "Primario"], anios: 6, verificado: true },
  { key: "sabrina", nombre: "Sabrina", apellido: "Ríos", categoria: "educador", subtitulo: "Matemática · Munro", resumen: "Profesora de Matemática de Secundario, disponible para suplencias cortas y urgentes.", telefono: "11 4455-9945", zonas: ["Munro", "Vicente López"], asignaturas: ["Matemática"], disponibilidad: ["Turno mañana", "Turno tarde"], niveles: ["Secundario"], anios: 2, verificado: true },
  { key: "damian", nombre: "Damián", apellido: "Ferreyra", categoria: "educador", subtitulo: "Profesor de Matemática", fotoUrl: "/assets/profe-ciencias.jpg", zonas: ["San Isidro", "Boulogne"], asignaturas: ["Matemática"], disponibilidad: ["Turno tarde"], niveles: ["Secundario"], anios: 9, verificado: true },
  { key: "carolina", nombre: "Carolina", apellido: "Ruiz Díaz", categoria: "educador", subtitulo: "Profesora de Inglés · 8 años", fotoUrl: "/assets/maestra-inicial.jpg", zonas: ["Martínez", "San Isidro"], asignaturas: ["Inglés"], disponibilidad: ["Turno mañana"], niveles: ["Primario"], anios: 8, verificado: true },
  { key: "sol", nombre: "Sol", apellido: "Belmonte", categoria: "entrenador", subtitulo: "Profesora de Danza contemporánea", fotoUrl: "/assets/bgEntrenadores-fixed.jpg", zonas: ["Palermo", "Belgrano"], asignaturas: ["Danza deportiva", "Expresión corporal"], disponibilidad: ["Contraturno / sábados"], niveles: ["Secundario"], anios: 6, verificado: true },
  { key: "nbravo", nombre: "Nicolás", apellido: "Bravo", categoria: "educador", subtitulo: "Profesor de Educación Física", fotoUrl: "/assets/entrenador-chicos.jpg", zonas: ["Vicente López"], asignaturas: ["Educación Física"], disponibilidad: ["Turno mañana"], niveles: ["Primario"], anios: 4, verificado: true },
  { key: "agustina", nombre: "Agustina", apellido: "Molina", categoria: "guardavidas", subtitulo: "Guardavidas habilitada", fotoUrl: "/assets/cat-guardavidas-pileta.jpg", zonas: ["Núñez", "Belgrano"], asignaturas: ["Pileta cubierta", "Natatorio de club"], disponibilidad: ["Turno mañana", "Turno tarde"], niveles: ["Primario"], anios: 5, verificado: true },
];

/* ───────── Búsquedas demo ───────── */

type BusquedaSeed = {
  key: string;
  inst: string;
  puesto: string;
  categoria: CategoriaDocente;
  disciplina: string;
  nivel?: string;
  tipo: "Titular" | "Suplencia" | "Temporada" | "Freelance";
  rapida?: boolean;
  cargaHoraria: string;
  turno: string;
  horario: string;
  /** ISO yyyy-mm-dd */
  inicio: string;
  descripcion: string;
  requisitos: string[];
  beneficios: string[];
  estado?: "activa" | "cerrada";
  /** Horas hasta vencer (solo rápidas). */
  venceEnHoras?: number;
  hace: number; // días desde la publicación
};

export const BUSQUEDAS: BusquedaSeed[] = [
  // Colegio San Andrés del Norte (la institución de la demo)
  { key: "sa-edfisica", inst: "sanandres", puesto: "Ed. Física — Primario", categoria: "educador", disciplina: "Educación Física", nivel: "Primario", tipo: "Titular", cargaHoraria: "18 hs semanales", turno: "Mañana", horario: "Turno mañana · 18 hs semanales", inicio: "2027-03-02", descripcion: "Ed. Física de 4.º a 7.º grado, cuatro divisiones por grado. Clases en el patio cubierto y en las canchas; una vez por semana natación en el natatorio propio. El cargo incluye la coordinación del vóley femenino (martes de 16 a 18).", requisitos: ["Título profesional vigente", "Experiencia en Primario"], beneficios: ["Natatorio propio", "Capacitación interna anual"], hace: 6 },
  { key: "sa-inicial", inst: "sanandres", puesto: "Maestra Nivel Inicial", categoria: "educador", disciplina: "Nivel Inicial", nivel: "Inicial", tipo: "Suplencia", cargaHoraria: "20 hs semanales", turno: "Tarde", horario: "Turno tarde · sala de 4", inicio: "2027-03-01", descripcion: "Cobertura de sala de 4, turno tarde, con foco en estimulación temprana y trabajo con familias.", requisitos: ["Título de Nivel Inicial"], beneficios: ["Capacitación interna anual"], hace: 9 },
  { key: "sa-suplencia-mate", inst: "sanandres", puesto: "Suplencia Matemática", categoria: "educador", disciplina: "Matemática", nivel: "Secundario", tipo: "Suplencia", rapida: true, cargaHoraria: "8 hs semanales", turno: "Mañana", horario: "Turno mañana · desde mañana", inicio: "2026-10-07", descripcion: "Suplencia urgente de Matemática en 3.º y 4.º año. Hay que responder dentro de las próximas horas.", requisitos: ["Título profesional en Matemática"], beneficios: ["Pago quincenal"], venceEnHoras: 18, hace: 0 },
  { key: "sa-voley", inst: "sanandres", puesto: "Profe de Vóley — Secundario", categoria: "entrenador", disciplina: "Vóley", nivel: "Secundario", tipo: "Titular", cargaHoraria: "6 hs semanales", turno: "Tarde", horario: "Martes y jueves 16 a 18 hs", inicio: "2027-03-02", descripcion: "Coordinación del equipo de vóley femenino, dos entrenamientos semanales.", requisitos: ["Experiencia en deportes de equipo"], beneficios: ["Viáticos incluidos"], hace: 4 },
  { key: "sa-ingles", inst: "sanandres", puesto: "Profe de Inglés — Secundario", categoria: "educador", disciplina: "Inglés", nivel: "Secundario", tipo: "Titular", cargaHoraria: "12 hs semanales", turno: "Mañana", horario: "Turno mañana · 12 hs", inicio: "2027-03-01", descripcion: "Clases de Inglés en 1.º a 3.º año, programa bilingüe del colegio.", requisitos: ["Título profesional en Inglés", "Certificación internacional de nivel C1"], beneficios: ["Capacitación interna anual"], hace: 11 },
  // Otras instituciones
  { key: "ri-natacion", inst: "ribera", puesto: "Natación — escuela de verano", categoria: "entrenador", disciplina: "Natación", nivel: "Inicial", tipo: "Temporada", cargaHoraria: "15 hs semanales", turno: "Mañana", horario: "Diciembre y enero · turno mañana", inicio: "2026-12-01", descripcion: "Profesor/a de natación para la escuela de verano, grupos de 6 a 10 años, turno mañana.", requisitos: ["Título de profesor de natación", "Curso de RCP vigente"], beneficios: ["Contrato por temporada", "Acceso a instalaciones del club"], hace: 3 },
  { key: "ri-guardavidas", inst: "ribera", puesto: "Guardavidas — pileta climatizada", categoria: "guardavidas", disciplina: "Pileta cubierta", tipo: "Suplencia", rapida: true, cargaHoraria: "8 hs por fin de semana", turno: "Mañana y tarde", horario: "Fines de semana · 8 hs", inicio: "2026-10-10", descripcion: "Cobertura de guardavidas en pileta climatizada, fines de semana.", requisitos: ["Habilitación de guardavidas vigente"], beneficios: ["Pago semanal"], venceEnHoras: 40, hace: 0 },
  { key: "vl-edfisica", inst: "vicentelopez", puesto: "Ed. Física — Secundario", categoria: "educador", disciplina: "Educación Física", nivel: "Secundario", tipo: "Suplencia", cargaHoraria: "12 hs semanales", turno: "Tarde", horario: "Turno tarde · 12 hs semanales", inicio: "2027-03-10", descripcion: "Suplencia de Ed. Física en Secundario, 12 hs semanales, turno tarde.", requisitos: ["Título profesional vigente", "Experiencia en Secundario"], beneficios: ["Posibilidad de ampliar horas el próximo ciclo"], hace: 5 },
  { key: "vl-historia", inst: "vicentelopez", puesto: "Profe de Historia", categoria: "educador", disciplina: "Historia", nivel: "Secundario", tipo: "Titular", rapida: true, cargaHoraria: "8 hs semanales", turno: "Mañana", horario: "Turno mañana · 8 hs semanales", inicio: "2027-03-10", descripcion: "Clases de Historia en 4.º y 5.º año de Secundario.", requisitos: ["Título profesional vigente"], beneficios: ["Posibilidad de ampliar horas"], venceEnHoras: 30, hace: 1 },
  { key: "vl-ingles", inst: "vicentelopez", puesto: "Inglés — Secundario", categoria: "educador", disciplina: "Inglés", nivel: "Secundario", tipo: "Titular", cargaHoraria: "10 hs semanales", turno: "Tarde", horario: "Turno tarde · 10 hs", inicio: "2026-09-01", descripcion: "Cargo de Inglés ya cubierto.", requisitos: ["Título profesional en Inglés"], beneficios: [], estado: "cerrada", hace: 25 },
  { key: "ja-sala3", inst: "aromos", puesto: "Maestra de sala de 3", categoria: "educador", disciplina: "Nivel Inicial", nivel: "Inicial", tipo: "Titular", cargaHoraria: "20 hs semanales", turno: "Mañana", horario: "Turno mañana · jornada simple", inicio: "2027-03-01", descripcion: "A cargo de sala de 3, jornada simple, con foco en estimulación temprana.", requisitos: ["Título de Nivel Inicial"], beneficios: ["Capacitación interna anual"], hace: 7 },
  { key: "ja-musica", inst: "aromos", puesto: "Profesor de Música", categoria: "educador", disciplina: "Música", nivel: "Inicial", tipo: "Titular", rapida: true, cargaHoraria: "4 hs semanales", turno: "Tarde", horario: "Turno tarde · 4 hs semanales", inicio: "2027-03-01", descripcion: "Clases de expresión musical para salas de 2 a 5 años.", requisitos: ["Título de profesor de Música"], beneficios: ["Capacitación interna anual"], venceEnHoras: 48, hace: 1 },
  { key: "fb-funcional", inst: "fullbody", puesto: "Entrenador funcional", categoria: "entrenador", disciplina: "Funcional", nivel: "Adultos", tipo: "Freelance", cargaHoraria: "15 hs semanales", turno: "Tarde", horario: "Turno tarde · 15 hs semanales", inicio: "2026-10-12", descripcion: "Clases grupales de entrenamiento funcional para adultos, turno tarde.", requisitos: ["Título de profesor de Educación Física"], beneficios: ["Acceso a instalaciones del gimnasio"], hace: 2 },
  { key: "fb-musculacion", inst: "fullbody", puesto: "Profe de musculación", categoria: "entrenador", disciplina: "Musculación", nivel: "Adultos", tipo: "Titular", cargaHoraria: "20 hs semanales", turno: "Mañana", horario: "Turno mañana · 20 hs semanales", inicio: "2026-10-19", descripcion: "Asistencia y planificación de rutinas en sala de musculación, turno mañana.", requisitos: ["Título de profesor de Educación Física"], beneficios: ["Acceso a instalaciones del gimnasio"], hace: 2 },
];

/* ───────── Postulaciones demo ───────── */

/** [búsqueda, docente, etapa, días en la etapa actual, origen?, nota de la etapa?] */
export const POSTULACIONES: {
  busqueda: string;
  docente: string;
  etapa: EtapaPostulacion;
  dias: number;
  invitacion?: boolean;
  nota?: string;
}[] = [
  // Ed. Física — Primario (San Andrés): pipeline completo
  { busqueda: "sa-edfisica", docente: "martina", etapa: "nuevos", dias: 0 },
  { busqueda: "sa-edfisica", docente: "nicolas", etapa: "nuevos", dias: 1 },
  { busqueda: "sa-edfisica", docente: "julieta", etapa: "nuevos", dias: 1 },
  { busqueda: "sa-edfisica", docente: "gonzalo", etapa: "nuevos", dias: 2 },
  { busqueda: "sa-edfisica", docente: "facundo", etapa: "preseleccionados", dias: 3 },
  { busqueda: "sa-edfisica", docente: "valeria", etapa: "preseleccionados", dias: 3 },
  { busqueda: "sa-edfisica", docente: "matias", etapa: "preseleccionados", dias: 5 },
  { busqueda: "sa-edfisica", docente: "rocio", etapa: "entrevista", dias: 2, nota: "Entrevista jueves 10:30" },
  { busqueda: "sa-edfisica", docente: "leandro", etapa: "entrevista", dias: 6, nota: "Entrevista jueves 11:30" },
  { busqueda: "sa-edfisica", docente: "paula", etapa: "oferta", dias: 4, nota: "Esperando respuesta" },
  // Maestra Nivel Inicial (San Andrés)
  { busqueda: "sa-inicial", docente: "luciana", etapa: "nuevos", dias: 0, invitacion: true },
  { busqueda: "sa-inicial", docente: "valeria", etapa: "preseleccionados", dias: 2 },
  { busqueda: "sa-inicial", docente: "julieta", etapa: "entrevista", dias: 3, nota: "Entrevista lunes 15 hs" },
  { busqueda: "sa-inicial", docente: "paula", etapa: "oferta", dias: 2, nota: "Esperando respuesta" },
  // Suplencia Matemática (San Andrés)
  { busqueda: "sa-suplencia-mate", docente: "sabrina", etapa: "nuevos", dias: 1 },
  // Postulaciones de Luciana Prieto (la docente de la demo)
  { busqueda: "ri-natacion", docente: "luciana", etapa: "entrevista", dias: 1, nota: "Entrevista el jueves a las 16 hs" },
  { busqueda: "vl-ingles", docente: "luciana", etapa: "descartado", dias: 12 },
  // Otras
  { busqueda: "ri-natacion", docente: "facundo", etapa: "nuevos", dias: 2 },
  { busqueda: "ri-guardavidas", docente: "agustina", etapa: "nuevos", dias: 0 },
  { busqueda: "vl-edfisica", docente: "nbravo", etapa: "nuevos", dias: 1 },
];

/* ───────── Cursos demo ───────── */

export const CURSOS: {
  inst: string;
  titulo: string;
  subtitulo: string;
  descripcion: string;
  modalidad: "Presencial" | "Online";
  profesor: string;
  fechaInicio: string;
  fechaFinal: string;
  horario: string;
  link?: string;
  certifica: boolean;
  puntaje: number;
  fotoUrl: string;
  inscriptos: string[];
}[] = [
  { inst: "sanandres", titulo: "Curso de RCP y primeros auxilios", subtitulo: "Certificación con Cruz Roja", descripcion: "Certificación de dos encuentros para profesionales y personal de apoyo, dictada por instructores de Cruz Roja. Incluye práctica con maniquíes.", modalidad: "Presencial", profesor: "Instructores de Cruz Roja Argentina", fechaInicio: "2027-03-10", fechaFinal: "2027-03-11", horario: "17:00 a 19:00", certifica: true, puntaje: 10, fotoUrl: "/assets/urgente-docentes.jpg", inscriptos: ["luciana"] },
  { inst: "ribera", titulo: "Curso de natación para profesionales", subtitulo: "Club Atlético Ribera", descripcion: "Perfeccionamiento de técnica y didáctica para dar clases de natación a grupos de 6 a 10 años. Cuatro encuentros, incluye salida a pileta.", modalidad: "Presencial", profesor: "Martina Alsina", fechaInicio: "2027-03-15", fechaFinal: "2027-04-05", horario: "Sábados 10:00 a 12:00", certifica: true, puntaje: 15, fotoUrl: "/assets/cat-guardavidas-pileta.jpg", inscriptos: [] },
  { inst: "vicentelopez", titulo: "Aula heterogénea y diversidad", subtitulo: "Instituto Vicente López", descripcion: "Herramientas concretas para trabajar con grupos disparejos: consignas por niveles, evaluación diferenciada y acompañamiento de chicos con adaptaciones.", modalidad: "Online", profesor: "Lic. Verónica Maidana", fechaInicio: "2027-04-06", fechaFinal: "2027-05-11", horario: "Martes 19:00 a 21:00", link: "https://meet.google.com/aula-heterogenea", certifica: true, puntaje: 20, fotoUrl: "/assets/hero-aula.jpg", inscriptos: ["luciana", "carolina"] },
  { inst: "aromos", titulo: "ESI en Nivel Inicial", subtitulo: "Jardín Los Aromos", descripcion: "Cómo llevar la Educación Sexual Integral a salas de 3, 4 y 5 sin improvisar: materiales, vocabulario y cómo contarlo a las familias.", modalidad: "Presencial", profesor: "Equipo de orientación del jardín", fechaInicio: "2027-04-11", fechaFinal: "2027-04-25", horario: "Sábados 9:00 a 12:00", certifica: true, puntaje: 12, fotoUrl: "/assets/cat-docentes.jpg", inscriptos: [] },
  { inst: "fullbody", titulo: "Entrenamiento funcional para grupos grandes", subtitulo: "Full Body Olivos", descripcion: "Planificación de clases para 20 o más personas con poco equipamiento, progresiones por nivel y prevención de lesiones.", modalidad: "Presencial", profesor: "Nicolás Bermúdez", fechaInicio: "2027-03-20", fechaFinal: "2027-04-10", horario: "Viernes 18:00 a 20:00", certifica: true, puntaje: 15, fotoUrl: "/assets/cat-entrenadores-gym.jpg", inscriptos: ["facundo"] },
  { inst: "ribera", titulo: "Guardavidas: actualización de reválida", subtitulo: "Club Atlético Ribera", descripcion: "Repaso de protocolos de rescate en pileta, RCP y la documentación que piden los municipios para revalidar el carnet.", modalidad: "Presencial", profesor: "Agustina Molina", fechaInicio: "2027-05-04", fechaFinal: "2027-05-18", horario: "Lunes 18:00 a 21:00", certifica: true, puntaje: 18, fotoUrl: "/assets/hero-guardavidas.jpg", inscriptos: [] },
];

/* ───────── Novedades de la vitrina y cobros demo ───────── */

export const NOVEDADES: { inst: string; fecha: string; titulo: string; texto: string }[] = [
  { inst: "sanandres", fecha: "2026-08-12", titulo: "Abrimos inscripción a Nivel Inicial 2027", texto: "Sala de 3, 4 y 5 con jornada extendida. Las entrevistas con familias arrancan en septiembre; vamos a necesitar dos maestras más para febrero." },
  { inst: "sanandres", fecha: "2026-07-28", titulo: "Terminamos la refacción del natatorio", texto: "Vuelve a funcionar la escuela de natación de contraturno, con dos profes y una guardavidas por turno." },
];

/** Montos mensuales de lista de src/lib/planes.ts. */
const MONTO = { colegio: 50_000, deportiva: 30_000 } as const;

type FacturaBase = {
  inst: string;
  plan: keyof typeof MONTO;
  periodo: string;
  fechaCobro: string;
  estado: "pagada" | "pendiente" | "vencida";
  medio: string;
};

const FACTURAS_BASE: FacturaBase[] = [
  ...["2026-07", "2026-08", "2026-09"].map((p) => ({ inst: "sanandres", plan: "colegio" as const, periodo: p, fechaCobro: `${p}-10`, estado: "pagada" as const, medio: "Débito automático" })),
  { inst: "sanandres", plan: "colegio", periodo: "2026-10", fechaCobro: "2026-10-10", estado: "pendiente", medio: "Débito automático" },
  ...["2026-06", "2026-07", "2026-08", "2026-09"].map((p) => ({ inst: "ribera", plan: "deportiva" as const, periodo: p, fechaCobro: `${p}-05`, estado: "pagada" as const, medio: "Transferencia" })),
  { inst: "ribera", plan: "deportiva", periodo: "2026-10", fechaCobro: "2026-10-05", estado: "vencida", medio: "Transferencia" },
  ...["2026-07", "2026-08"].map((p) => ({ inst: "vicentelopez", plan: "colegio" as const, periodo: p, fechaCobro: `${p}-12`, estado: "pagada" as const, medio: "Tarjeta" })),
  { inst: "vicentelopez", plan: "colegio", periodo: "2026-09", fechaCobro: "2026-09-12", estado: "vencida", medio: "Tarjeta" },
  { inst: "vicentelopez", plan: "colegio", periodo: "2026-10", fechaCobro: "2026-10-12", estado: "pendiente", medio: "Tarjeta" },
  ...["2026-08", "2026-09"].map((p) => ({ inst: "fullbody", plan: "deportiva" as const, periodo: p, fechaCobro: `${p}-08`, estado: "pagada" as const, medio: "Tarjeta" })),
  { inst: "fullbody", plan: "deportiva", periodo: "2026-10", fechaCobro: "2026-10-08", estado: "pendiente", medio: "Tarjeta" },
  { inst: "aromos", plan: "colegio", periodo: "2026-09", fechaCobro: "2026-09-01", estado: "pagada", medio: "Transferencia" },
];

export const FACTURAS = FACTURAS_BASE.map((f) => ({ ...f, monto: MONTO[f.plan] }));
