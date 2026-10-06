/* Fechas de cursos: la base guarda `date` como "AAAA-MM-DD" y se muestra "dd/mm" o "dd/mm al dd/mm". */

const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

/** Hoy en Buenos Aires como "AAAA-MM-DD" (el servidor corre en UTC; sin esto, de noche "hoy" sería mañana). */
export function hoyArgentina(ahora = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Argentina/Buenos_Aires" }).format(ahora);
}

function ddmm(iso: string) {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

export function etiquetaFechas(inicio?: string | null, fin?: string | null) {
  if (!inicio) return "Fecha a confirmar";
  return fin && fin !== inicio ? `${ddmm(inicio)} al ${ddmm(fin)}` : ddmm(inicio);
}

/** "2027-03-10" → "10 de marzo de 2027" */
export function fechaLarga(iso: string) {
  const [a, m, d] = iso.split("-");
  return `${parseInt(d!, 10)} de ${MESES[parseInt(m!, 10) - 1]} de ${a}`;
}

/** "2027-03-10" → "marzo de 2027" */
export function mesYAnio(iso: string) {
  const [a, m] = iso.split("-");
  return `${MESES[parseInt(m!, 10) - 1]} de ${a}`;
}

export function diaDelMes(iso: string) {
  return String(parseInt(iso.split("-")[2]!, 10)).padStart(2, "0");
}

/** Avance estimado por fechas, de 0 a 100 (la institución es la que confirma que lo terminó). */
export function avancePorFechas(inicio: string | null, fin: string | null, hoy: string) {
  if (!inicio || hoy < inicio) return 0;
  if (!fin || hoy >= fin) return 100;
  const t = (s: string) => Date.parse(`${s}T00:00:00Z`);
  const total = t(fin) - t(inicio);
  if (total <= 0) return 100;
  return Math.max(0, Math.min(100, Math.round(((t(hoy) - t(inicio)) / total) * 100)));
}

/** Fecha corta "21/08" en hora de Buenos Aires. */
export function fechaCorta(fecha: Date) {
  return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", timeZone: "America/Argentina/Buenos_Aires" }).format(fecha);
}
