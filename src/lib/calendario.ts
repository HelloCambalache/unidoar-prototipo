/*
 * Fechas de la agenda del docente. UNIDOAR opera en Argentina (UTC-3 todo el año, sin horario
 * de verano): lo que la persona escribe como "10:30" es hora argentina, y así se muestra siempre,
 * sin depender del huso del servidor ni del navegador (evita desfases entre SSR y cliente).
 */

const ZONA = "America/Argentina/Buenos_Aires";

const FORMATO_DIA = new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long", timeZone: ZONA });
const FORMATO_DIA_HORA = new Intl.DateTimeFormat("es-AR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: ZONA,
});
const FORMATO_CORTO = new Intl.DateTimeFormat("es-AR", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: ZONA,
});
// Las columnas `date` llegan como "2027-03-02": se leen en UTC para que no se corran de día.
const FORMATO_FECHA_LARGA = new Intl.DateTimeFormat("es-AR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** "2026-10-08" + "10:30" (hora de Argentina) → instante. Devuelve null si la fecha no existe (ej. 31 de febrero). */
export function instanteArgentina(fecha: string, hora: string): Date | null {
  const instante = new Date(`${fecha}T${hora}:00-03:00`);
  if (Number.isNaN(instante.getTime())) return null;
  // Algunos motores "corrigen" fechas imposibles (31/02 → 03/03): se descartan comparando el día.
  const dia = new Intl.DateTimeFormat("en-CA", { timeZone: ZONA }).format(instante);
  return dia === fecha ? instante : null;
}

/** "jueves, 8 de octubre, 10:30 hs" */
export function diaHoraLegible(fecha: Date | string) {
  return `${FORMATO_DIA_HORA.format(new Date(fecha))} hs`;
}

/** "jueves, 8 de octubre" */
export function diaLegible(fecha: Date | string) {
  return FORMATO_DIA.format(new Date(fecha));
}

/** "8 oct, 10:30" */
export function fechaHoraCorta(fecha: Date | string) {
  return FORMATO_CORTO.format(new Date(fecha));
}

/** "2 de marzo de 2027" (para columnas `date`). */
export function fechaLarga(fecha: string | Date | null | undefined) {
  if (!fecha) return null;
  return FORMATO_FECHA_LARGA.format(new Date(fecha));
}

/** Formato basic de Google Calendar: 20261008T133000Z */
function formatoGoogle(d: Date) {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** Link "Agregar a Google Calendar" (plantilla de evento; se abre ya cargado y se confirma en Google). */
export function enlaceGoogleCalendar(evento: {
  titulo: string;
  inicio: Date | string;
  duracionMin?: number;
  detalle?: string | null;
  lugar?: string | null;
}) {
  const inicio = new Date(evento.inicio);
  const fin = new Date(inicio.getTime() + (evento.duracionMin ?? 60) * 60_000);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: evento.titulo,
    dates: `${formatoGoogle(inicio)}/${formatoGoogle(fin)}`,
    ctz: ZONA,
  });
  if (evento.detalle) params.set("details", evento.detalle);
  if (evento.lugar) params.set("location", evento.lugar);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
