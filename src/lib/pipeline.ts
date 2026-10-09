import type { CategoriaDocente, EtapaPostulacion } from "@/db/schema";

/* Tipos y helpers del pipeline de postulantes. Sin acceso a base: los usa también el cliente. */

/** `autor`: quién la escribió ("Vos", el nombre en el equipo…); null si esa cuenta ya no existe. */
export type NotaVista = { id: string; texto: string; cuando: string; autor: string | null };

/**
 * Quién escribió una nota interna, para mostrarlo en la ficha: "Vos" si es quien mira; si no, su nombre en el equipo; si
 * es el dueño y no tiene fila propia en el equipo, el nombre de contacto de la institución; y si no hay nada de eso, lo que
 * se pueda sacar de su email. Null cuando la cuenta ya no existe (la nota queda sin autor).
 */
export function autorDeNota(a: {
  usuarioId: string | null;
  yo: string;
  nombreEnElEquipo?: string | null;
  esPropietario?: boolean;
  contactoNombre?: string | null;
  email?: string | null;
}): string | null {
  if (!a.usuarioId) return null;
  if (a.usuarioId === a.yo) return "Vos";
  const nombre = a.nombreEnElEquipo?.trim() || (a.esPropietario ? a.contactoNombre?.trim() : "");
  if (nombre) return nombre;
  return a.email?.split("@")[0]?.trim() || null;
}

export type PostulanteTarjeta = {
  id: string;
  docenteId: string;
  nombre: string;
  iniciales: string;
  fotoUrl: string | null;
  categoria: CategoriaDocente;
  /** "Ed. Física · Olivos" / "Ed. Física · a 3 km" */
  subtitulo: string;
  etapa: EtapaPostulacion;
  origen: "postulacion" | "invitacion";
  mensaje: string | null;
  /** Días enteros desde que entró a la etapa actual. */
  dias: number;
  /** "hace 2 días": cuándo se postuló o fue invitado. */
  desde: string;
  /** ISO, para ordenar por antigüedad en la etapa. */
  etapaDesde: string;
  /** `fechaLocal` es el valor de un datetime-local en hora argentina ("2026-10-15T10:30"), para editar la entrevista. */
  entrevista: { texto: string; corta: string; titulo: string | null; fechaLocal: string } | null;
  /** Checklist de la etapa "Examen preocupacional": null = todavía no se anotó que lo hizo; `cuando` es la fecha (dd/mm/aaaa). */
  examenPreocupacional: { cuando: string } | null;
  /** Archivos del estudio que guardó la institución (solo el nombre: se abren con /api/examen-preocupacional/<postulación>/<n>). */
  examenArchivos: { nombre: string }[];
  esFavorito: boolean;
  /** El equipo suspendió el perfil: el cajón avisa y no muestra su teléfono ni su email. */
  suspendido: boolean;
  notas: NotaVista[];
  zonas: string[];
  cv: {
    verificado: boolean;
    tituloVerificado: boolean;
    /** Todavía estudia (presenta la constancia de alumno regular en lugar del título); null si ya se recibió. */
    estudiante: { porcentaje: number | null } | null;
    antecedentesVerificados: boolean;
    subtitulo: string | null;
    resumen: string | null;
    aniosExperiencia: number | null;
    experiencia: { titulo: string; fechas: string; desc: string }[];
    formacion: { titulo: string; detalle: string }[];
    asignaturas: string[];
    niveles: string[];
    disponibilidad: string[];
    ubicacion: string | null;
    telefono: string | null;
    email: string | null;
    cvUrl: string | null;
  };
};

export type BusquedaPipeline = {
  id: string;
  puesto: string;
  estado: "activa" | "pausada" | "cerrada";
  rapida: boolean;
  publicada: string;
  postulantes: number;
};

export type OpcionBusqueda = { id: string; puesto: string; estado: "activa" | "pausada" | "cerrada"; nuevos: number };

/** Nombre de cada etapa en los menús de "Mover a…" (el de las columnas está en ETAPAS, catalogo.ts). */
export const ETAPA_MENU: Record<EtapaPostulacion, string> = {
  nuevos: "Nuevos",
  preseleccionados: "Preseleccionados",
  entrevista: "Entrevista",
  oferta: "Oferta enviada",
  examen_preocupacional: "Examen preocupacional",
  contratado: "Contratado",
  descartado: "Archivado",
};

/** Etapas visibles como columna, con el color del punto del encabezado (prototipo). */
export const COLOR_ETAPA: Record<EtapaPostulacion, string> = {
  nuevos: "bg-navy-700",
  preseleccionados: "bg-[#4A9B6E]",
  entrevista: "bg-naranja",
  oferta: "bg-[#D72289]",
  examen_preocupacional: "bg-ambar",
  contratado: "bg-sutil",
  descartado: "bg-borde-fuerte",
};

/** Insignia de etapa para la vista tabla y el cajón. */
export const INSIGNIA_ETAPA: Record<EtapaPostulacion, { tono: "neutro" | "azul" | "verde" | "rosa" | "naranja" | "ambar"; clase?: string }> = {
  nuevos: { tono: "neutro", clase: "bg-[#E3F6FA] text-[#1B7A8D]" },
  preseleccionados: { tono: "verde" },
  entrevista: { tono: "naranja" },
  oferta: { tono: "rosa" },
  examen_preocupacional: { tono: "ambar" },
  contratado: { tono: "azul" },
  descartado: { tono: "neutro" },
};

/** "hoy" / "2 días" en Nuevos; "desde hoy" / "3 días acá" en el resto. */
export function etiquetaDias(etapa: EtapaPostulacion, dias: number) {
  const n = `${dias} ${dias === 1 ? "día" : "días"}`;
  if (etapa === "nuevos") return dias === 0 ? "hoy" : n;
  return dias === 0 ? "desde hoy" : `${n} acá`;
}

/** Nota corta de la tarjeta según la etapa ("Entrevista jueves 10:30", "Esperando respuesta"). */
export function notaDeTarjeta(p: Pick<PostulanteTarjeta, "etapa" | "entrevista" | "examenPreocupacional">) {
  if (p.etapa === "entrevista" && p.entrevista) return { texto: `Entrevista ${p.entrevista.corta}`, tono: "ambar" as const };
  if (p.etapa === "oferta") return { texto: "Esperando respuesta", tono: "rosa" as const };
  if (p.etapa === "examen_preocupacional") {
    return p.examenPreocupacional
      ? { texto: "Examen realizado ✓", tono: "verde" as const }
      : { texto: "Falta el examen", tono: "ambar" as const };
  }
  return null;
}

/**
 * wa.me para un teléfono argentino escrito de cualquier forma ("11 4455-3320", "011 15 4455-3320",
 * "+54 9 11 4455-3320"). WhatsApp pide 54 9 + característica + número, sin 0 ni 15. Null si no
 * se reconoce (área + número = 10 dígitos).
 */
export function enlaceWhatsapp(telefono: string | null | undefined) {
  let n = (telefono ?? "").replace(/\D/g, "").replace(/^0+/, "");
  if (n.startsWith("549")) n = n.slice(3);
  else if (n.startsWith("54")) n = n.slice(2);
  n = n.replace(/^0+/, "");
  if (n.length === 12) {
    // El "15" del celular va después de la característica (2 a 4 dígitos).
    for (const i of [2, 3, 4]) {
      if (n.slice(i, i + 2) === "15") {
        n = n.slice(0, i) + n.slice(i + 2);
        break;
      }
    }
  }
  return n.length === 10 ? `https://wa.me/549${n}` : null;
}
