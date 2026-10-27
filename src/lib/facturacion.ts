import { mesYAnio } from "@/lib/fechas-curso";

/* Vocabulario de facturas, compartido entre las pantallas de Plan y la hoja imprimible. Sin acceso a base. */

export type EstadoFactura = "pagada" | "pendiente" | "vencida";

export const ESTADO_FACTURA: Record<EstadoFactura, { texto: string; tono: "verde" | "ambar" | "naranja" }> = {
  pagada: { texto: "Pagada", tono: "verde" },
  pendiente: { texto: "Pendiente", tono: "ambar" },
  vencida: { texto: "Vencida", tono: "naranja" },
};

/** `facturas.estado` es texto libre en la base: lo que no se reconoce se trata como pendiente. */
export const estadoDeFactura = (estado: string): EstadoFactura =>
  estado === "pagada" || estado === "vencida" ? estado : "pendiente";

/** El número que lleva el comprobante de una factura: los primeros 8 caracteres de su id, en mayúsculas («3F2A9C1E»). Lo usan la hoja y el mail del pago. */
export const numeroDeComprobante = (facturaId: string) => facturaId.slice(0, 8).toUpperCase();

/** Dónde abre la institución el comprobante de una factura (la hoja imprimible, que también se guarda como PDF). Es una ruta interna: se arma contra el sitio. */
export const rutaDeComprobante = (facturaId: string) => `/institucion/plan/facturas/${facturaId}`;

/** "2026-10" → "Octubre de 2026" */
export function periodoLegible(periodo: string) {
  const texto = mesYAnio(periodo);
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
