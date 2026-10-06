import type { CategoriaDocente, EtapaPostulacion } from "@/db/schema";

/* Tipos y helpers del pipeline de postulantes. Sin acceso a base: los usa también el cliente. */

export type NotaVista = { id: string; texto: string; cuando: string };

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
  entrevista: { texto: string; corta: string; titulo: string | null } | null;
  esFavorito: boolean;
  notas: NotaVista[];
  zonas: string[];
  cv: {
    verificado: boolean;
    tituloVerificado: boolean;
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
  contratado: "Contratado",
  descartado: "Descartado",
};

/** Etapas visibles como columna, con el color del punto del encabezado (prototipo). */
export const COLOR_ETAPA: Record<EtapaPostulacion, string> = {
  nuevos: "bg-navy-700",
  preseleccionados: "bg-[#4A9B6E]",
  entrevista: "bg-naranja",
  oferta: "bg-[#D72289]",
  contratado: "bg-sutil",
  descartado: "bg-borde-fuerte",
};

/** Insignia de etapa para la vista tabla y el cajón. */
export const INSIGNIA_ETAPA: Record<EtapaPostulacion, { tono: "neutro" | "azul" | "verde" | "rosa" | "naranja" | "ambar"; clase?: string }> = {
  nuevos: { tono: "neutro", clase: "bg-[#E3F6FA] text-[#1B7A8D]" },
  preseleccionados: { tono: "verde" },
  entrevista: { tono: "naranja" },
  oferta: { tono: "rosa" },
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
export function notaDeTarjeta(p: Pick<PostulanteTarjeta, "etapa" | "entrevista">) {
  if (p.etapa === "entrevista" && p.entrevista) return { texto: `Entrevista ${p.entrevista.corta}`, tono: "ambar" as const };
  if (p.etapa === "oferta") return { texto: "Esperando respuesta", tono: "rosa" as const };
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
