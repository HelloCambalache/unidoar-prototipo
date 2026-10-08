import type { EtapaPostulacion } from "@/db/schema";

type TonoInsignia = "neutro" | "azul" | "verde" | "rosa" | "naranja" | "ambar";

/**
 * Cómo ve el docente el estado de una postulación, a partir de la etapa que le
 * puso la institución (que es la fuente de verdad) y del estado de la búsqueda.
 *
 * Una postulación archivada por la institución (etapa interna `descartado`) NO se muestra como tal: archivar es
 * silencioso a propósito, así que el docente la sigue viendo como "Postulación enviada" hasta que la búsqueda se
 * cierra (ahí, como todas, pasa a "Búsqueda cerrada").
 */
export function estadoParaDocente(
  etapa: EtapaPostulacion,
  busquedaEstado: "activa" | "pausada" | "cerrada",
): { texto: string; tono: TonoInsignia; activa: boolean } {
  switch (etapa) {
    case "contratado":
      return { texto: "Contratada", tono: "verde", activa: false };
    default:
      if (busquedaEstado === "cerrada") return { texto: "Búsqueda cerrada", tono: "neutro", activa: false };
      if (etapa === "entrevista") return { texto: "Entrevista agendada", tono: "azul", activa: true };
      if (etapa === "oferta") return { texto: "Oferta recibida", tono: "rosa", activa: true };
      if (etapa === "preseleccionados") return { texto: "Preseleccionada", tono: "azul", activa: true };
      return { texto: "Postulación enviada", tono: "neutro", activa: true };
  }
}

/** Etapas que una institución puede asignar manualmente desde el pipeline (sin "contratado", que va por Contratar). */
/**
 * Aviso (solo en la campanita, nunca por mail) para quienes estaban en una búsqueda que la institución cierra: ya se cubrió,
 * gracias y a seguir buscando. Quien fue invitado y nunca llegó a postularse no recibe el "gracias por postularte".
 * Va después del nombre de la institución, como el resto de los avisos ("Colegio X cerró la búsqueda…").
 */
export function textoDeCierreDeBusqueda(puesto: string, invitado: boolean) {
  return invitado
    ? `cerró la búsqueda «${puesto}», a la que te había invitado: el puesto ya se cubrió. ¡Gracias por tu interés! Seguí postulándote a otras búsquedas.`
    : `cerró la búsqueda «${puesto}»: el puesto ya se cubrió. ¡Gracias por postularte! Seguí postulándote a otras búsquedas.`;
}

export const ETAPAS_MOVIBLES: EtapaPostulacion[] = ["nuevos", "preseleccionados", "entrevista", "oferta"];
