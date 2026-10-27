import { fechaBreve } from "@/lib/cobros";
import { diasEntre, sumarDias } from "@/lib/correo/claves";

/*
 * Mora: qué pasa con una institución que tiene una factura vencida (definición del cliente, 2026-10-27: «un período de gracia de 15 días antes de
 * limitar las funciones de las cuentas con suscripciones vencidas»). Reglas puras, sin base: las usan las acciones, las pantallas, el cron de avisos
 * y las pruebas.
 *
 *  - Una factura impaga está **vencida** desde el día siguiente a su fecha de cobro.
 *  - Pasados `DIAS_DE_GRACIA` días de atraso (la factura más vieja manda), la cuenta queda **limitada**: no puede publicar búsquedas, invitar a
 *    postularse ni publicar cursos. Todo lo demás sigue (entrar, ver y mover sus postulantes, pagar). Es automático y se levanta solo cuando el
 *    equipo registra el pago (se calcula al mirar, no se guarda nada).
 *  - Antes de limitar se avisa: los recordatorios de factura dicen hasta cuándo es la gracia y sale un último aviso (`planificarAvisosDeMora`).
 */

/** Días que pasan desde el vencimiento antes de limitar la cuenta. */
export const DIAS_DE_GRACIA = 15;
/** Cuántos días antes de que termine la gracia sale el último aviso por mail. */
export const DIAS_DEL_AVISO_PREVIO = 3;

/** Lo que no puede hacer una cuenta limitada, dicho como cierra una frase: «no podés … ». */
export const QUE_SE_LIMITA = "publicar búsquedas, invitar a postularse ni publicar cursos";

export type FacturaImpaga = { fechaCobro: string };

export type Mora = {
  /** Tiene al menos una factura vencida (aunque todavía esté en gracia). */
  conMora: boolean;
  /** Pasó la gracia: publicar búsquedas, invitar y publicar cursos están limitados. */
  limitada: boolean;
  /** Días de atraso de la factura impaga más vieja (0 sin ninguna vencida). */
  diasDeAtraso: number;
  /** El último día de gracia de esa factura («2026-11-12»), o null sin mora. */
  ultimoDiaDeGracia: string | null;
};

export const SIN_MORA: Mora = { conMora: false, limitada: false, diasDeAtraso: 0, ultimoDiaDeGracia: null };

/** El último día de gracia de una factura: desde el día siguiente la cuenta queda limitada. */
export const ultimoDiaDeGracia = (fechaCobro: string) => sumarDias(fechaCobro, DIAS_DE_GRACIA);

/** La mora de una institución a partir de sus facturas impagas (las pagadas no se pasan) y el día de hoy en Argentina. */
export function moraDe(impagas: readonly FacturaImpaga[], hoy: string): Mora {
  let masVieja: string | null = null;
  for (const f of impagas) {
    if (f.fechaCobro >= hoy) continue; // todavía no venció
    if (masVieja === null || f.fechaCobro < masVieja) masVieja = f.fechaCobro;
  }
  if (masVieja === null) return SIN_MORA;
  const diasDeAtraso = diasEntre(masVieja, hoy);
  return { conMora: true, limitada: diasDeAtraso > DIAS_DE_GRACIA, diasDeAtraso, ultimoDiaDeGracia: ultimoDiaDeGracia(masVieja) };
}

/** Lo que se le responde a quien intenta hacer algo limitado (null si la cuenta no está limitada). */
export function motivoDeLimite(m: Mora): string | null {
  if (!m.limitada) return null;
  return `Tu cuenta tiene una factura vencida hace más de ${DIAS_DE_GRACIA} días: hasta que se acredite el pago no podés ${QUE_SE_LIMITA}. Podés pagarla desde Plan y facturación o escribirnos desde Contacto.`;
}

/** El cartel que ve la institución en su área (null sin mora). `limite` es el tono fuerte; `gracia`, el aviso de que todavía hay tiempo. */
export function cartelDeMora(m: Mora): { tono: "gracia" | "limite"; titulo: string; texto: string } | null {
  if (!m.conMora) return null;
  if (m.limitada) {
    return {
      tono: "limite",
      titulo: "Tu cuenta está limitada por una factura vencida",
      texto: `Pasaron más de ${DIAS_DE_GRACIA} días del vencimiento: hasta que se acredite el pago no podés ${QUE_SE_LIMITA}. Lo demás sigue funcionando, y apenas registremos el pago se levanta sola.`,
    };
  }
  return {
    tono: "gracia",
    titulo: "Tenés una factura vencida",
    texto: `Tenés hasta el ${fechaBreve(m.ultimoDiaDeGracia!)} para pagarla. Pasada esa fecha no vas a poder ${QUE_SE_LIMITA} hasta que se acredite el pago.`,
  };
}

/* ───────────────────────────── Avisos por mail ───────────────────────────── */

export type FacturaParaAvisar = { id: string; institucionId: string; estado: string; fechaCobro: string };
export type AvisoDeMora = {
  facturaId: string;
  institucionId: string;
  /** `previo`: quedan pocos días de gracia. `limitada`: la gracia terminó y la cuenta quedó limitada. */
  etapa: "previo" | "limitada";
  /** Con esta clave la cola no repite el mismo aviso aunque la tarea corra todos los días. */
  clave: string;
};

/**
 * Qué avisos de mora salen hoy. Por institución cuenta solo su factura impaga más vieja (la que decide la mora) y cada etapa sale una sola vez:
 * el último aviso desde 3 días antes de que termine la gracia y, cuando termina, el de que la cuenta quedó limitada. A diferencia de los
 * recordatorios de factura, también les llega a quienes tienen el débito automático: la limitación les alcanza igual.
 */
export function planificarAvisosDeMora(facturas: readonly FacturaParaAvisar[], hoy: string): AvisoDeMora[] {
  const masViejaPorInstitucion = new Map<string, FacturaParaAvisar>();
  for (const f of facturas) {
    if (f.estado === "pagada" || f.fechaCobro >= hoy) continue;
    const actual = masViejaPorInstitucion.get(f.institucionId);
    if (!actual || f.fechaCobro < actual.fechaCobro) masViejaPorInstitucion.set(f.institucionId, f);
  }
  const avisos: AvisoDeMora[] = [];
  for (const f of masViejaPorInstitucion.values()) {
    const atraso = diasEntre(f.fechaCobro, hoy);
    if (atraso > DIAS_DE_GRACIA) {
      avisos.push({ facturaId: f.id, institucionId: f.institucionId, etapa: "limitada", clave: `M68:${f.id}:limitada` });
    } else if (atraso >= DIAS_DE_GRACIA - DIAS_DEL_AVISO_PREVIO) {
      avisos.push({ facturaId: f.id, institucionId: f.institucionId, etapa: "previo", clave: `M68:${f.id}:previo` });
    }
  }
  return avisos;
}
