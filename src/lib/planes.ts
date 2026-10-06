/** Planes de las instituciones (precios del prototipo, en pesos argentinos). */
export const PLANES = {
  fundador: {
    label: "Plan Fundador",
    precio: 54_000,
    periodo: "mes" as const,
    resumen: "Búsquedas ilimitadas. Precio fijo mientras sigas suscripto.",
    detalle: "Búsquedas ilimitadas, catálogo completo, precio fijo mientras sigas suscripto.",
  },
  estandar: {
    label: "Plan Estándar",
    precio: 89_000,
    periodo: "mes" as const,
    resumen: "Búsquedas ilimitadas.",
    detalle: "Lo mismo que Fundador, precio de lista sin el descuento por early adopter.",
  },
  anual: {
    label: "Plan Anual",
    precio: 720_000,
    periodo: "año" as const,
    resumen: "Búsquedas ilimitadas, pago anual.",
    detalle: "Dos meses gratis pagando el año completo por adelantado.",
  },
} as const;

export type PlanClave = keyof typeof PLANES;

export function planDe(clave: string) {
  return PLANES[(clave in PLANES ? clave : "fundador") as PlanClave];
}

export const pesos = (n: number) => `$ ${n.toLocaleString("es-AR")}`;
