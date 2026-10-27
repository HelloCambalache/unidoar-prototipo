/*
 * Búsqueda puntual: el plan sin abono mensual, para cubrir una vacante. La institución paga cada búsqueda (el equipo registra el pago y queda un
 * «crédito» disponible), publica una búsqueda que lo consume y, pasada su vigencia, se cierra sola. Reglas puras, sin base: las usan las acciones,
 * el cron, las pantallas y las pruebas. Lo que es editable (precio, vigencia, tope de búsquedas abiertas y qué incluye) vive en Planes.
 */

const MS_DIA = 86_400_000;

/** Cuándo vence una búsqueda puntual que se publica en `ahora`, con la vigencia que fijó el equipo en Planes. */
export const venceEnDePuntual = (ahora: Date, vigenciaDias: number) => new Date(ahora.getTime() + vigenciaDias * MS_DIA);

/** En qué está una búsqueda pagada: sin usar, publicada y dentro de su plazo, con el plazo vencido, o cerrada antes de tiempo. */
export type EstadoDeCredito = "disponible" | "en-curso" | "vencida" | "cerrada";

export const ETIQUETA_DE_CREDITO: Record<EstadoDeCredito, string> = {
  disponible: "Disponible",
  "en-curso": "Publicada",
  vencida: "Vencida",
  cerrada: "Cerrada",
};

export function estadoDeCredito(
  c: { usadoEn: Date | null; venceEn: Date | null; busquedaEstado: string | null },
  ahora = new Date(),
): EstadoDeCredito {
  if (!c.usadoEn) return "disponible";
  if (c.venceEn && c.venceEn.getTime() <= ahora.getTime()) return "vencida";
  return c.busquedaEstado === "cerrada" ? "cerrada" : "en-curso";
}

export type PermisoParaPublicar = { ok: true } | { ok: false; error: string; campo?: "sedeId" };

const busquedasAbiertasTexto = (n: number) => (n === 1 ? "1 búsqueda abierta" : `${n} búsquedas abiertas`);

/**
 * ¿Puede una institución con búsquedas puntuales publicar ahora? Hace falta una búsqueda pagada y disponible, que no supere el tope de búsquedas
 * abiertas a la vez y que se publique en una sola sede (cada sede sería otra búsqueda, y otro pago). `precio` es lo que cuesta, ya escrito.
 */
export function permisoParaPublicarPuntual(e: { disponibles: number; abiertas: number; maxAbiertas: number; sedes: number; precio: string }): PermisoParaPublicar {
  if (e.sedes > 1) {
    return { ok: false, error: "Con una búsqueda puntual se publica en una sede por vez: cada sede es otra búsqueda.", campo: "sedeId" };
  }
  if (e.disponibles < 1) {
    return {
      ok: false,
      error: `Tu plan es de búsqueda puntual y no tenés una búsqueda pagada disponible. Para publicar, abonala (${e.precio}): escribinos desde Contacto y la habilitamos.`,
    };
  }
  if (e.abiertas >= e.maxAbiertas) {
    return { ok: false, error: `Ya tenés ${busquedasAbiertasTexto(e.abiertas)}: cerrá una o esperá a que venza para publicar otra.` };
  }
  return { ok: true };
}

/** Una búsqueda puntual cerrada solo se reabre mientras no haya vencido su plazo: pasado, otra vez hay que pagarla. */
export const puedeReabrirPuntual = (venceEn: Date | null, ahora = new Date()) => !!venceEn && venceEn.getTime() > ahora.getTime();
