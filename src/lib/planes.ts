import { TIPOS_INSTITUCION } from "@/lib/catalogo";

/*
 * Planes de las instituciones, en pesos argentinos. Los profesionales no pagan nunca.
 *
 * El precio sale del TIPO de institución, no de lo que elija: un colegio paga lo mismo que
 * cualquier otro colegio. Por eso `planPorTipo()` es la fuente de verdad y el selector de plan
 * del backoffice solo confirma lo que el tipo ya decide.
 *
 * Los planes marcados `vigente: false` son los que vendíamos antes. Siguen acá porque las
 * facturas guardan la clave del plan al momento del cobro (`facturas.plan`) y hay cuentas que
 * todavía los tienen: sin ellos, una factura vieja no sabría qué nombre ni qué precio mostrar.
 * No se ofrecen a nadie nuevo.
 */

export type Periodo = "mes" | "año";

type Plan = {
  label: string;
  precio: number;
  periodo: Periodo;
  resumen: string;
  detalle: string;
  /** Se ofrece hoy. Los heredados solo sirven para leer el pasado. */
  vigente: boolean;
  /** El precio es por sede, no por institución: el total lo arma el backoffice al facturar. */
  porSede: boolean;
};

export const PLANES = {
  colegio: {
    label: "Plan Colegios",
    precio: 50_000,
    periodo: "mes",
    resumen: "Búsquedas ilimitadas, sin comisión por contratación.",
    detalle: "Jardines, primarias, secundarias y terciarios, privados o públicos.",
    vigente: true,
    porSede: false,
  },
  deportiva: {
    label: "Plan Clubes y academias",
    precio: 30_000,
    periodo: "mes",
    resumen: "Búsquedas ilimitadas, sin comisión por contratación.",
    detalle: "Clubes, gimnasios, academias, escuelas deportivas, natatorios y centros de formación.",
    vigente: true,
    porSede: false,
  },
  multisede: {
    label: "Plan Multisede",
    precio: 15_000,
    periodo: "mes",
    resumen: "Para redes de 5 sedes o más: el precio es por sede.",
    detalle: "Desde la quinta sede se factura por sede, no por institución.",
    vigente: true,
    porSede: true,
  },
  fundador: {
    label: "Plan Fundador",
    precio: 54_000,
    periodo: "mes",
    resumen: "Búsquedas ilimitadas. Precio fijo mientras sigas suscripto.",
    detalle: "Plan anterior: precio congelado para las instituciones que entraron en el lanzamiento.",
    vigente: false,
    porSede: false,
  },
  estandar: {
    label: "Plan Estándar",
    precio: 89_000,
    periodo: "mes",
    resumen: "Búsquedas ilimitadas.",
    detalle: "Plan anterior: precio de lista único, antes de separar por tipo de institución.",
    vigente: false,
    porSede: false,
  },
  anual: {
    label: "Plan Anual",
    precio: 720_000,
    periodo: "año",
    resumen: "Búsquedas ilimitadas, pago anual.",
    detalle: "Plan anterior: dos meses bonificados pagando el año completo por adelantado.",
    vigente: false,
    porSede: false,
  },
} as const satisfies Record<string, Plan>;

export type PlanClave = keyof typeof PLANES;

export function planDe(clave: string) {
  return PLANES[(clave in PLANES ? clave : "colegio") as PlanClave];
}

/** Los que se ofrecen hoy, en el orden en que se muestran. */
export const PLANES_VIGENTES = (Object.keys(PLANES) as PlanClave[]).filter((c) => PLANES[c].vigente);

/* ───────────────────────────── Tipo de institución → plan ───────────────────────────── */

/** Tipos que pagan el arancel de colegios: son los que dictan niveles del sistema educativo. */
const TIPOS_COLEGIO: readonly string[] = [
  "Colegio privado",
  "Colegio público",
  "Jardín de infantes",
  "Instituto terciario",
];

/** El plan que le corresponde a una institución por su tipo. Multisede se asigna a mano. */
export function planPorTipo(tipo: string): PlanClave {
  return TIPOS_COLEGIO.includes(tipo) ? "colegio" : "deportiva";
}

/** Los tipos de cada arancel, para listarlos en la página de planes. */
export const TIPOS_POR_PLAN = {
  colegio: TIPOS_INSTITUCION.filter((t) => TIPOS_COLEGIO.includes(t)),
  deportiva: TIPOS_INSTITUCION.filter((t) => !TIPOS_COLEGIO.includes(t) && t !== "Otro"),
} as const;

/** Desde esta cantidad de sedes (incluida) corresponde el plan Multisede. */
export const SEDES_MULTISEDE = 5;

/** ¿Le toca el plan Multisede a una red con esta cantidad de sedes? */
export const esMultisede = (sedes: number) => sedes >= SEDES_MULTISEDE;

/** Lo que paga por mes una red con N sedes. */
export const precioMultisede = (sedes: number) => PLANES.multisede.precio * Math.max(sedes, 1);

/* ───────────────────────────── Promociones de lanzamiento ───────────────────────────── */

/*
 * Pack de 6 meses por adelantado. Los meses bonificados no cambian el precio mensual: se
 * descuentan de la cantidad de meses que se factura, así el arancel de lista queda a la vista.
 */
export const PACK_LANZAMIENTO = {
  meses: 6,
  /** Pagando los 6 meses por adelantado se bonifica 1. */
  mesesQueSePagan: 5,
  /** Si además recomienda una institución que se suma, se bonifica otro. */
  mesesConReferido: 4,
} as const;

/** Lo que sale el pack de 6 meses para un plan, con y sin referido. */
export function packDe(clave: PlanClave) {
  const { precio } = PLANES[clave];
  return {
    lista: precio * PACK_LANZAMIENTO.meses,
    anticipado: precio * PACK_LANZAMIENTO.mesesQueSePagan,
    conReferido: precio * PACK_LANZAMIENTO.mesesConReferido,
  };
}

export const pesos = (n: number) => `$ ${n.toLocaleString("es-AR")}`;
