/*
 * Referidos de instituciones. Una institución recomienda UNIDOAR a otra con su enlace personal (`/referido/<código>`): la persona
 * entra, crea la cuenta de institución y queda anotada como recomendada. Cuando la recomendada abona su membresía (paga su primera
 * factura), la que recomendó tiene su beneficio (el mismo que antes se mostraba en la página de precios: en el pack por adelantado,
 * paga menos meses); el equipo lo aplica a mano al facturar y lo marca. Código puro (sin base ni Next): lo usan las pantallas, las
 * acciones y las pruebas.
 */

export const ESTADOS_REFERIDO = ["registrada", "verificada", "pago", "beneficio"] as const;
export type EstadoReferido = (typeof ESTADOS_REFERIDO)[number];

/** Cómo se llama cada paso, qué significa para quien recomendó y con qué color se marca. */
export const INFO_ESTADO_REFERIDO: Record<EstadoReferido, { etiqueta: string; significado: string; tono: "neutro" | "verde" | "azul" }> = {
  registrada: {
    etiqueta: "Se registró",
    significado: "Creó su cuenta con tu enlace. Falta que el equipo la verifique.",
    tono: "neutro",
  },
  verificada: {
    etiqueta: "Verificada",
    significado: "Ya está verificada. Tu beneficio se activa cuando pague su primera factura.",
    tono: "neutro",
  },
  pago: {
    etiqueta: "Ya pagó",
    significado: "Pagó su membresía: tu beneficio está listo para aplicarse.",
    tono: "verde",
  },
  beneficio: {
    etiqueta: "Beneficio aplicado",
    significado: "Ya aplicamos tu beneficio por recomendarla.",
    tono: "azul",
  },
};

/**
 * En qué paso está un referido. No se guarda: sale de si la institución recomendada está verificada y de si tiene alguna factura paga
 * (así nunca queda desfasado de la verificación ni de un pago que se anula) y de si el equipo ya aplicó el beneficio, que es lo único
 * que se anota.
 */
export function estadoDeReferido(r: {
  verificada: boolean;
  /** Tiene al menos una factura paga: abonó su membresía. */
  pagada: boolean;
  beneficioEn: Date | string | null | undefined;
}): EstadoReferido {
  if (r.beneficioEn) return "beneficio";
  if (r.pagada) return "pago";
  return r.verificada ? "verificada" : "registrada";
}

/** El equipo solo puede aplicar el beneficio de una recomendación cuya institución ya pagó (o devolverlo a "pago" si se aplicó por error). */
export const puedeAplicarBeneficio = (estado: EstadoReferido) => estado === "pago";
export const puedeDeshacerBeneficio = (estado: EstadoReferido) => estado === "beneficio";

/** Cuántos hay en cada paso y cuántos esperan que el equipo les aplique el beneficio. */
export function resumenDeReferidos(estados: readonly EstadoReferido[]) {
  const cuenta = (e: EstadoReferido) => estados.filter((x) => x === e).length;
  return {
    total: estados.length,
    registradas: cuenta("registrada"),
    verificadas: cuenta("verificada"),
    pagaron: cuenta("pago"),
    conBeneficio: cuenta("beneficio"),
    /** Las que ya pagaron y todavía no tienen el beneficio aplicado: lo que el equipo tiene para aplicar. */
    paraAplicar: cuenta("pago"),
    /** Las que ya pasaron la verificación (con o sin pago): "ya son parte de la red". */
    enLaRed: estados.filter((x) => x !== "registrada").length,
  };
}

/* ───────────────────────────── Códigos y enlaces ───────────────────────────── */

/** Sin 0, 1, I, L ni O: un código que se dicta o se copia a mano no se confunde. */
const ALFABETO = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const LARGO_DEL_CODIGO = 8;
const FORMA_DEL_CODIGO = /^[2-9A-HJKMNP-Z]{8}$/;

/** Nombre y duración de la cookie que recuerda quién recomendó mientras la persona crea su cuenta. */
export const COOKIE_REFERIDO = "unidoar_referido";
export const DIAS_DE_LA_COOKIE = 30;

/** Un código al azar; `azar(n)` devuelve un entero de 0 a n - 1 (en el servidor, de `crypto`). */
export function generarCodigo(azar: (n: number) => number): string {
  let codigo = "";
  for (let i = 0; i < LARGO_DEL_CODIGO; i++) codigo += ALFABETO[azar(ALFABETO.length)];
  return codigo;
}

/** El código tal como se va a buscar (en mayúsculas, sin espacios), o null si no tiene la forma de un código. */
export function normalizarCodigo(texto: string | null | undefined): string | null {
  const t = (texto ?? "").trim().toUpperCase();
  return FORMA_DEL_CODIGO.test(t) ? t : null;
}

/** La ruta pública que abre quien recibe el enlace. */
export const rutaDeReferido = (codigo: string) => `/referido/${codigo}`;

/** Lo que se manda al recomendar: lo escribe la institución que ya está, a un colega. */
export const textoParaRecomendar = (url: string) => `Te paso UNIDOAR, lo usamos para cubrir búsquedas de profesionales: ${url}`;

/** El beneficio, en palabras, a partir de las condiciones del pack por adelantado que edita el equipo en Planes. */
export function beneficioDeReferido(pack: { meses: number; mesesQueSePagan: number; mesesConReferido: number }) {
  return {
    pagaConReferido: pack.mesesConReferido,
    pagaSinReferido: pack.mesesQueSePagan,
    mesesDelPack: pack.meses,
    mesesDeMenos: pack.mesesQueSePagan - pack.mesesConReferido,
  };
}

/**
 * ¿Se anota la recomendación? Nunca una institución recomendándose a sí misma, ni a una cuenta de la misma persona
 * (dos instituciones con el mismo dueño): sin esto, cualquiera se daría el beneficio solo.
 */
export function sePuedeAnotar(referidor: { id: string; propietarioId: string | null }, referido: { id: string; propietarioId: string | null }) {
  if (referidor.id === referido.id) return false;
  if (referidor.propietarioId && referidor.propietarioId === referido.propietarioId) return false;
  return true;
}
