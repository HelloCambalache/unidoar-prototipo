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

/**
 * El código que una persona escribió o pegó a mano en el alta (campo «Código de referido»): lo que recibió de otra institución en un mensaje.
 * Más permisivo que `normalizarCodigo` (que es la forma exacta que guardan la cookie y la base): acepta minúsculas, espacios o guiones en el
 * medio («k7m2-xq9d») y también el enlace completo pegado (`…/referido/K7M2XQ9D`), porque quien recibió un enlace puede pegarlo acá.
 * Devuelve el código en su forma exacta, o null si lo escrito no tiene la forma de un código (o está vacío).
 */
export function codigoDeTexto(texto: string | null | undefined): string | null {
  const t = (texto ?? "").trim();
  if (!t) return null;
  const delEnlace = /\/referido\/([^/?#\s]+)/i.exec(t)?.[1];
  return normalizarCodigo((delEnlace ?? t).replace(/[\s-]+/g, ""));
}

/** Qué código se usa al crear la institución: el que la persona escribió o, si el campo no vino, el del enlace (cookie). */
export type CodigoDelAlta =
  | { tipo: "ninguno" }
  /** Escribió algo que no tiene la forma de un código: se le pide corregirlo (o dejar el campo vacío). */
  | { tipo: "invalido" }
  /** `escrito`: lo tipeó o lo cambió la persona (hay que comprobar que exista antes de crear nada); false: es el del enlace, que no frena el alta. */
  | { tipo: "codigo"; codigo: string; escrito: boolean };

/**
 * Elige el código del alta. `escrito` es lo que llegó en el campo (null si el formulario no lo traía) y `recordado` el que ya quedó anotado: el del
 * enlace de otra institución (cookie) o, si confirmó el mail en otro dispositivo, el de los datos de su cuenta (ya normalizado). **El campo nunca
 * viene rellenado** (2026-10-28): lo que la persona escribe gana sobre el anotado; con el campo vacío vale el anotado (el enlace anota solo, sin que
 * tenga que escribir nada) y sin ninguno de los dos no hay recomendación. Un código escrito igual al anotado no cuenta como escrito: no frena el alta.
 */
export function codigoParaElAlta(escrito: string | null, recordado: string | null): CodigoDelAlta {
  const texto = escrito?.trim() ?? "";
  if (!texto) return recordado ? { tipo: "codigo", codigo: recordado, escrito: false } : { tipo: "ninguno" };
  const codigo = codigoDeTexto(texto);
  if (!codigo) return { tipo: "invalido" };
  return { tipo: "codigo", codigo, escrito: codigo !== recordado };
}

/** Cómo se guarda el código en el navegador (el enlace `/referido/<código>` y el campo del registro dejan la misma cookie, 30 días). */
export const OPCIONES_DE_COOKIE_REFERIDO = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: DIAS_DE_LA_COOKIE * 24 * 60 * 60,
} as const;

/** Lo que se le dice a quien probó demasiados códigos seguidos (ver `permitirProbarCodigoDeReferido`). */
export const ERROR_DE_DEMASIADOS_CODIGOS = "Probaste muchos códigos seguidos. Esperá un rato y probá de nuevo, o dejá el campo vacío.";

/** El mismo texto para un código mal escrito y para uno que no existe (o que es de una institución dada de baja o suspendida): no se dice cuál de los dos. */
export const ERROR_DE_CODIGO_DE_REFERIDO = "No encontramos ese código. Revisalo (son 8 letras y números) o dejá el campo vacío.";

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
 * (dos instituciones con el mismo dueño), ni a otra con el mismo CUIT (la misma organización dada de alta con otra cuenta): sin esto,
 * cualquiera se daría el beneficio solo.
 */
export function sePuedeAnotar(
  referidor: { id: string; propietarioId: string | null; cuit?: string | null },
  referido: { id: string; propietarioId: string | null; cuit?: string | null },
) {
  if (referidor.id === referido.id) return false;
  if (referidor.propietarioId && referidor.propietarioId === referido.propietarioId) return false;
  // El mismo CUIT es la misma organización aunque la haya dado de alta otra cuenta (otro mail): también se recomendaría a sí misma.
  const cuitDe = (c: string | null | undefined) => (c ?? "").replace(/\D/g, "");
  if (cuitDe(referidor.cuit) && cuitDe(referidor.cuit) === cuitDe(referido.cuit)) return false;
  return true;
}
