import { instanteArgentina } from "@/lib/calendario";
import { haceCuanto } from "@/lib/utils";

/*
 * Fechas de búsquedas y pipeline, en hora argentina (UTC-3 todo el año). calendario.ts
 * resuelve la fecha/hora que escribe la persona y trae los formatos largos ("diaHoraLegible").
 */
const ZONA = "America/Argentina/Buenos_Aires";
const OFFSET = "-03:00";
const DIA = 86_400_000;
const HORA = 3_600_000;

function partes(fecha: Date, opciones: Intl.DateTimeFormatOptions) {
  const out: Record<string, string> = {};
  for (const p of new Intl.DateTimeFormat("es-AR", { ...opciones, timeZone: ZONA }).formatToParts(fecha)) {
    out[p.type] = p.value;
  }
  return out;
}

const horaMinuto = (fecha: Date) => {
  const p = partes(fecha, { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${p.hour === "24" ? "00" : p.hour}:${p.minute}`;
};

/** Para el chip de la tarjeta: "jueves 10:30" si es en la próxima semana, "15/10 10:30" si no. */
export function chipEntrevista(fecha: Date, ahora = new Date()) {
  const dif = fecha.getTime() - ahora.getTime();
  if (dif >= 0 && dif < 6 * DIA) {
    const p = partes(fecha, { weekday: "long" });
    return `${p.weekday} ${horaMinuto(fecha)}`;
  }
  const p = partes(fecha, { day: "2-digit", month: "2-digit" });
  return `${p.day}/${p.month} ${horaMinuto(fecha)}`;
}

/** "15/10/2026" */
export function fechaCorta(fecha: Date) {
  const p = partes(fecha, { day: "2-digit", month: "2-digit", year: "numeric" });
  return `${p.day}/${p.month}/${p.year}`;
}

/** Valor de un <input type="date"> (yyyy-mm-dd) a "02/03/2027", sin pasar por zonas horarias. */
export function fechaDeInput(valor: string) {
  const [y, m, d] = valor.split("-");
  return y && m && d ? `${d}/${m}/${y}` : valor;
}

/** "2026-10-15T10:30" (datetime-local, hora argentina) → Date, o null si no es válido. */
export function parsearFechaHoraAR(valor: string): Date | null {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/.exec(valor);
  return m ? instanteArgentina(m[1]!, m[2]!) : null;
}

/** Lo contrario de `parsearFechaHoraAR`: un instante → "2026-10-15T10:30" (hora argentina), el valor de un datetime-local. */
export function aFechaHoraAR(fecha: Date): string {
  const p = partes(fecha, { year: "numeric", month: "2-digit", day: "2-digit" });
  return `${p.year}-${p.month}-${p.day}T${horaMinuto(fecha)}`;
}

/** "hace 2 días", "hace 3 semanas". */
export function haceTiempo(fecha: Date, ahora = new Date()) {
  const dias = Math.floor((ahora.getTime() - fecha.getTime()) / DIA);
  if (dias >= 14) return `hace ${Math.floor(dias / 7)} semanas`;
  return haceCuanto(fecha, ahora);
}

/** Días enteros entre dos fechas (mínimo 0). */
export function diasEntre(desde: Date, hasta: Date) {
  return Math.max(0, Math.floor((hasta.getTime() - desde.getTime()) / DIA));
}

/** Tiempo que tardó en cubrirse un cargo: "7 días", "1 día", "5 hs". */
export function duracionLegible(desde: Date, hasta: Date) {
  const ms = Math.max(0, hasta.getTime() - desde.getTime());
  if (ms < DIA) return `${Math.max(1, Math.round(ms / HORA))} hs`;
  const dias = Math.round(ms / DIA);
  return dias === 1 ? "1 día" : `${dias} días`;
}

/** Vencimiento de una búsqueda rápida: "Vence en 18 hs", "Vence en 2 días", "Venció hace 3 hs". */
export function plazoLegible(venceEn: Date, ahora = new Date()) {
  const dif = venceEn.getTime() - ahora.getTime();
  const abs = Math.abs(dif);
  const cantidad =
    abs < HORA ? "menos de 1 hs" : abs < 2 * DIA ? `${Math.round(abs / HORA)} hs` : `${Math.round(abs / DIA)} días`;
  return dif >= 0
    ? { texto: `Vence en ${cantidad}`, vencida: false }
    : { texto: `Venció hace ${cantidad}`, vencida: true };
}

/** "5 al 11 de octubre" (lunes a domingo de la semana en curso). */
export function rangoDeSemana(ahora = new Date()) {
  const hoy = partes(ahora, { year: "numeric", month: "numeric", day: "numeric" });
  const base = Date.UTC(Number(hoy.year), Number(hoy.month) - 1, Number(hoy.day));
  const diaSemana = (new Date(base).getUTCDay() + 6) % 7; // lunes = 0
  const lunes = new Date(base - diaSemana * DIA);
  const domingo = new Date(base + (6 - diaSemana) * DIA);
  const fmt = (f: Date, opciones: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("es-AR", { ...opciones, timeZone: "UTC" }).format(f);
  const mesLunes = fmt(lunes, { month: "long" });
  const mesDomingo = fmt(domingo, { month: "long" });
  const dl = fmt(lunes, { day: "numeric" });
  const dd = fmt(domingo, { day: "numeric" });
  return mesLunes === mesDomingo ? `${dl} al ${dd} de ${mesDomingo}` : `${dl} de ${mesLunes} al ${dd} de ${mesDomingo}`;
}

/** Primer instante del año en curso (hora argentina). */
export function inicioDeAnio(ahora = new Date()) {
  const anio = partes(ahora, { year: "numeric" }).year;
  return new Date(`${anio}-01-01T00:00:00${OFFSET}`);
}

export const MS = { HORA, DIA };
