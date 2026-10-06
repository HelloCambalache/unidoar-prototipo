import { kmLegible } from "@/lib/geo";
import type { CategoriaDocente } from "@/db/schema";

/*
 * Qué tan bien le calza una búsqueda a un docente. No pretende ser un algoritmo:
 * es una señal legible, hecha con lo que el docente cargó en su perfil.
 */

export type PerfilParaCoincidir = {
  categoria: CategoriaDocente;
  asignaturas: string[];
  zonas: string[];
  niveles: string[];
  disponibilidad: string[];
  radioKm: number;
};

export type BusquedaParaCoincidir = {
  categoria: CategoriaDocente;
  disciplina: string;
  nivel: string | null;
  turno: string | null;
  zona: string | null;
  rapida: boolean;
};

export function normalizar(texto: string) {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

export function coincideAsignatura(disciplina: string, asignaturas: string[]) {
  const d = normalizar(disciplina);
  if (!d) return false;
  return asignaturas.some((a) => {
    const n = normalizar(a);
    return n.length > 0 && (d.includes(n) || n.includes(d));
  });
}

/** La zona de una búsqueda puede ser "Villa Adelina, Vicente López": alcanza con que aparezca una zona del docente. */
export function coincideZona(zonaBusqueda: string | null | undefined, zonasDocente: string[]) {
  const z = normalizar(zonaBusqueda ?? "");
  if (!z) return false;
  return zonasDocente.some((d) => {
    const n = normalizar(d);
    return n.length > 0 && z.includes(n);
  });
}

/** Turno de la búsqueda → turnos de la lista de disponibilidad del docente que lo cubren. */
const TURNOS_QUE_CUBREN: Record<string, string[]> = {
  Mañana: ["Turno mañana"],
  Tarde: ["Turno tarde"],
  Contraturno: ["Contraturno / sábados"],
  "Mañana y tarde": ["Turno mañana", "Turno tarde"],
  "Fin de semana": ["Contraturno / sábados"],
  Noche: [],
};

export function coincideTurno(turno: string | null | undefined, disponibilidad: string[]) {
  if (!turno || disponibilidad.length === 0) return false;
  if (disponibilidad.includes("Full time")) return true;
  return (TURNOS_QUE_CUBREN[turno] ?? []).some((t) => disponibilidad.includes(t));
}

export function coincidencia(d: PerfilParaCoincidir, b: BusquedaParaCoincidir, km: number | null) {
  const motivos: string[] = [];
  let puntos = 40;
  if (b.categoria === d.categoria) puntos += 8;
  if (coincideAsignatura(b.disciplina, d.asignaturas)) {
    puntos += 26;
    motivos.push("Tu asignatura");
  }
  if (coincideZona(b.zona, d.zonas)) {
    puntos += 14;
    motivos.push("En tus zonas");
  } else if (km != null && km <= d.radioKm) {
    puntos += km <= 8 ? 10 : 6;
    motivos.push("Cerca tuyo");
  }
  if (b.nivel && d.niveles.includes(b.nivel)) {
    puntos += 5;
    motivos.push("Tu nivel");
  }
  if (coincideTurno(b.turno, d.disponibilidad)) {
    puntos += 8;
    motivos.push("Tu turno");
  }
  if (b.rapida) {
    puntos += 3;
    motivos.push("Suplencia rápida");
  }
  if (motivos.length === 0) motivos.push(kmLegible(km) ?? "Búsqueda abierta");
  return { porcentaje: Math.min(puntos, 97), motivos: motivos.slice(0, 2) };
}

/** Clases de la insignia "92% match": verde alto, ámbar medio, gris bajo. */
export function claseCoincidencia(porcentaje: number) {
  if (porcentaje >= 80) return "bg-verde-tint text-verde";
  if (porcentaje >= 60) return "bg-[#FDF1C7] text-[#7A5900]";
  return "bg-[#F0EFEA] text-apagado";
}
