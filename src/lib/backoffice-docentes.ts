import type { Docente } from "@/db/schema";

/*
 * Vocabulario y lectura de filtros de las pantallas de docentes del backoffice (listado, ficha, verificación).
 * Sin acceso a base: lo usan las páginas, las queries y los controles del navegador.
 */

export type EstadoVerificacionDocente = Docente["verificacion"];

export const VERIFICACION_BO: Record<
  EstadoVerificacionDocente,
  { etiqueta: string; tono: "verde" | "neutro" | "ambar" | "rosa" }
> = {
  verificado: { etiqueta: "Verificado", tono: "verde" },
  pendiente: { etiqueta: "En cola", tono: "neutro" },
  correccion: { etiqueta: "Corrección pedida", tono: "ambar" },
  rechazado: { etiqueta: "Rechazado", tono: "rosa" },
};

/** Opciones del filtro "Verificación" del listado. `suspendido` filtra por el estado de la cuenta, no por la verificación. */
export const FILTROS_VERIFICACION = [
  { valor: "verificado", etiqueta: "Verificado" },
  { valor: "pendiente", etiqueta: "En cola" },
  { valor: "correccion", etiqueta: "Corrección pedida" },
  { valor: "rechazado", etiqueta: "Rechazado" },
  { valor: "suspendido", etiqueta: "Cuenta suspendida" },
] as const;
export type FiltroVerificacion = (typeof FILTROS_VERIFICACION)[number]["valor"];

export const ORDENES_BO = [
  { clave: "scoring", etiqueta: "Mayor scoring" },
  { clave: "scoring-asc", etiqueta: "Menor scoring" },
  { clave: "postulaciones", etiqueta: "Más postulaciones" },
  { clave: "nombre", etiqueta: "Nombre A–Z" },
] as const;
export type OrdenBoDocentes = (typeof ORDENES_BO)[number]["clave"];

export const POR_PAGINA_BO = 25;

export type FiltrosBoDocentes = {
  q: string;
  disciplina: string;
  zona: string;
  verificacion: FiltroVerificacion | "";
  orden: OrdenBoDocentes;
  pagina: number;
};

type SearchParams = Record<string, string | string[] | undefined>;

const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** Filtros del listado a partir de la URL (todo lo que llega del navegador se recorta y se valida). */
export function leerFiltrosBoDocentes(sp: SearchParams): FiltrosBoDocentes {
  const verificacion = uno(sp.verificacion);
  const orden = uno(sp.orden);
  const pagina = Number.parseInt(uno(sp.pagina) || "1", 10);
  return {
    q: uno(sp.q).trim().slice(0, 80),
    disciplina: uno(sp.disciplina).trim().slice(0, 80),
    zona: uno(sp.zona).trim().slice(0, 80),
    verificacion: FILTROS_VERIFICACION.find((f) => f.valor === verificacion)?.valor ?? "",
    orden: ORDENES_BO.find((o) => o.clave === orden)?.clave ?? "scoring",
    pagina: Number.isFinite(pagina) && pagina > 0 ? pagina : 1,
  };
}

/** URL del listado con estos filtros; lo que está en su valor por defecto no se escribe. */
export function hrefBoDocentes(f: FiltrosBoDocentes, cambios: Partial<FiltrosBoDocentes> = {}) {
  const x: FiltrosBoDocentes = { ...f, ...cambios };
  if (cambios.pagina === undefined) x.pagina = 1;
  const p = new URLSearchParams();
  if (x.q) p.set("q", x.q);
  if (x.disciplina) p.set("disciplina", x.disciplina);
  if (x.zona) p.set("zona", x.zona);
  if (x.verificacion) p.set("verificacion", x.verificacion);
  if (x.orden !== "scoring") p.set("orden", x.orden);
  if (x.pagina > 1) p.set("pagina", String(x.pagina));
  const qs = p.toString();
  return `/backoffice/docentes${qs ? `?${qs}` : ""}`;
}

export const hayFiltrosBoDocentes = (f: FiltrosBoDocentes) => !!(f.q || f.disciplina || f.zona || f.verificacion);

/** Un documento del docente tal como lo ve el equipo: con el enlace firmado listo para abrir (vence a los 15 minutos). */
export type DocumentoBo = {
  clave: "dniFrente" | "dniDorso" | "credencial" | "constancia" | "conducta" | "cv";
  etiqueta: string;
  /** No bloquea la verificación si falta. */
  opcional: boolean;
  /** Quien todavía estudia no tiene título que subir. */
  noAplica: boolean;
  subido: boolean;
  /** Null si no está subido o si no se pudo firmar el enlace. */
  url: string | null;
  esImagen: boolean;
};

/** "30123456" → "30.123.456" (así se lee mejor contra la foto del documento). */
export function dniLegible(dni: string | null | undefined) {
  const n = (dni ?? "").replace(/\D/g, "");
  return n.length >= 7 && n.length <= 8 ? n.replace(/\B(?=(\d{3})+(?!\d))/g, ".") : (dni ?? "").trim();
}

/** "20301234569" → "20-30123456-9". */
export function cuilLegible(cuil: string | null | undefined) {
  const n = (cuil ?? "").replace(/\D/g, "");
  return n.length === 11 ? `${n.slice(0, 2)}-${n.slice(2, 10)}-${n.slice(10)}` : (cuil ?? "").trim();
}

/**
 * "11 4455-2201" → https://wa.me/5491144552201. Los teléfonos se cargan como se escriben en Argentina
 * (con característica, sin 0 ni 15): se les antepone el 54 y el 9 de celular. null si no hay un número usable.
 */
export function enlaceWhatsApp(telefono: string | null | undefined) {
  let n = (telefono ?? "").replace(/\D/g, "").replace(/^0+/, "");
  if (n.length < 8) return null;
  if (!n.startsWith("54")) n = `549${n}`;
  else if (!n.startsWith("549")) n = `549${n.slice(2)}`;
  return `https://wa.me/${n}?text=${encodeURIComponent("Hola, te escribimos del equipo de UNIDOAR.")}`;
}
