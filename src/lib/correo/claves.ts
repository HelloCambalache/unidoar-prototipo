import { hoyAR } from "@/lib/cobros";

/*
 * Claves de "no repetir el mismo mail" y reglas de qué recordatorios de factura corresponden hoy. Puro: sin base ni red.
 * La cola no anota dos mails con la misma clave para el mismo destinatario (índice único), así que una clave buena es
 * lo que decide cuántas veces llega algo.
 */

const HORA_AR = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone: "America/Argentina/Buenos_Aires" });

/**
 * "Hay postulantes nuevos" (M30): un mail por búsqueda y por día. En las búsquedas rápidas, uno por hora: ahí cada
 * minuto cuenta y se acumulan más respuestas.
 */
export function claveDePostulantes(busquedaId: string, rapida: boolean, ahora = new Date()): string {
  const dia = hoyAR(ahora);
  return rapida ? `M30:${busquedaId}:${dia}T${HORA_AR.format(ahora)}` : `M30:${busquedaId}:${dia}`;
}

/* ───────────────────────────── Recordatorios de factura ───────────────────────────── */

/** Desde cuántos días antes del vencimiento se avisa (M51). */
export const DIAS_ANTES_DEL_VENCIMIENTO = 3;
/** A los cuántos días de vencida se manda el segundo aviso (M52). */
export const DIAS_PARA_EL_SEGUNDO_AVISO = 7;
/** Una factura vencida hace más que esto ya no se recuerda por mail: lo resuelve el equipo a mano. También evita avisar de deudas viejas al encender los mails. */
export const DIAS_MAXIMOS_DE_ATRASO = 30;

export type FacturaParaRecordar = { id: string; institucionId: string; estado: string; fechaCobro: string };
export type Recordatorio = {
  facturaId: string;
  institucionId: string;
  plantilla: "M51" | "M52";
  /** Solo M52: ya pasó más de una semana desde el vencimiento. */
  segundoAviso: boolean;
  clave: string;
};

/** Una fecha "AAAA-MM-DD" más (o menos) `n` días. */
export function sumarDias(fecha: string, n: number): string {
  const [a, m, d] = fecha.split("-").map(Number);
  return new Date(Date.UTC(a!, m! - 1, d! + n)).toISOString().slice(0, 10);
}

/** Días de calendario entre dos fechas "AAAA-MM-DD" (positivo si `hasta` es posterior). */
export function diasEntre(desde: string, hasta: string): number {
  const dia = (f: string) => {
    const [a, m, d] = f.split("-").map(Number);
    return Date.UTC(a!, m! - 1, d!);
  };
  return Math.round((dia(hasta) - dia(desde)) / 86_400_000);
}

/**
 * Qué recordatorios corresponden hoy. Cada factura recibe como mucho uno por etapa (la clave lo garantiza aunque el
 * cron corra todos los días): uno cuando falta poco, uno cuando vence y uno más a la semana. Las pagadas no reciben nada.
 */
export function planificarRecordatorios(facturas: FacturaParaRecordar[], hoy: string): Recordatorio[] {
  const lista: Recordatorio[] = [];
  for (const f of facturas) {
    if (f.estado === "pagada") continue;
    const dias = diasEntre(hoy, f.fechaCobro);
    if (dias >= 0 && dias <= DIAS_ANTES_DEL_VENCIMIENTO) {
      lista.push({ facturaId: f.id, institucionId: f.institucionId, plantilla: "M51", segundoAviso: false, clave: `M51:${f.id}` });
    } else if (dias < 0 && -dias <= DIAS_MAXIMOS_DE_ATRASO) {
      const segundo = -dias >= DIAS_PARA_EL_SEGUNDO_AVISO;
      lista.push({ facturaId: f.id, institucionId: f.institucionId, plantilla: "M52", segundoAviso: segundo, clave: `M52:${f.id}:${segundo ? 2 : 1}` });
    }
  }
  return lista;
}
