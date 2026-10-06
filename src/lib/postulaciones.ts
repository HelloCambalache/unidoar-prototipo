import type { EtapaPostulacion } from "@/db/schema";

type TonoInsignia = "neutro" | "azul" | "verde" | "rosa" | "naranja" | "ambar";

/**
 * Cómo ve el docente el estado de una postulación, a partir de la etapa que le
 * puso la institución (que es la fuente de verdad) y del estado de la búsqueda.
 */
export function estadoParaDocente(
  etapa: EtapaPostulacion,
  busquedaEstado: "activa" | "pausada" | "cerrada",
): { texto: string; tono: TonoInsignia; activa: boolean } {
  switch (etapa) {
    case "contratado":
      return { texto: "Contratada", tono: "verde", activa: false };
    case "descartado":
      return { texto: "No siguió", tono: "neutro", activa: false };
    default:
      if (busquedaEstado === "cerrada") return { texto: "Búsqueda cerrada", tono: "neutro", activa: false };
      if (etapa === "entrevista") return { texto: "Entrevista agendada", tono: "azul", activa: true };
      if (etapa === "oferta") return { texto: "Oferta recibida", tono: "rosa", activa: true };
      if (etapa === "preseleccionados") return { texto: "Preseleccionada", tono: "azul", activa: true };
      return { texto: "Postulación enviada", tono: "neutro", activa: true };
  }
}

/** Etapas que una institución puede asignar manualmente desde el pipeline (sin "contratado", que va por Contratar). */
export const ETAPAS_MOVIBLES: EtapaPostulacion[] = ["nuevos", "preseleccionados", "entrevista", "oferta"];
