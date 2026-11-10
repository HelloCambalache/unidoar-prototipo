import { nombreVisibleDeArchivo } from "@/lib/examen-preocupacional";
import { esPathPrivadoPropio } from "@/lib/subidas";

/*
 * Comprobante de pago que adjunta el equipo al registrar o después (pedido de Flor, 2026-11-10): la captura o el PDF de la transferencia, el recibo
 * del efectivo… Un archivo por pago (de una factura o de una búsqueda puntual pagada), en el bucket privado; se abre solo con
 * `/api/comprobantes/<id>` (admin, redirige a una URL firmada de un minuto) y la institución no lo ve. Sin acceso a base ni a Storage: lo usan las
 * acciones, la ruta y la pantalla.
 */

/** Carpeta del bucket privado donde se guardan (`<adminId>/comprobantes/<uuid>.<ext>`). */
export const CARPETA_COMPROBANTE = "comprobantes";

/** A qué pago se adjunta: una factura o una búsqueda puntual pagada. */
export type DestinoDeComprobante = { tipo: "factura" | "puntual"; id: string };

/** El archivo que subió el equipo, ya revisado. */
export type ArchivoDeComprobante = { path: string; nombre: string };

const ERROR_DE_ARCHIVO = "No pudimos validar el comprobante. Subilo de nuevo.";

/** Lo que se acepta: lo mismo que detecta `/api/subir` en una carpeta de imagen o PDF. */
const EXTENSIONES = [".pdf", ".jpg", ".png", ".webp"];

/**
 * Lee el archivo que llegó del navegador. El servidor no confía en el path: solo acepta uno que subió ESTA cuenta (la del admin que guarda) a la
 * carpeta de comprobantes (un path de otra cuenta, de otra carpeta o con un `../` se rechaza).
 */
export function leerArchivoDeComprobante(entrada: { path: unknown; nombre: unknown }, adminId: string): { ok: true; archivo: ArchivoDeComprobante } | { ok: false; error: string } {
  const path = typeof entrada.path === "string" ? entrada.path : "";
  if (!esPathPrivadoPropio(path, adminId, CARPETA_COMPROBANTE) || !EXTENSIONES.some((e) => path.endsWith(e))) return { ok: false, error: ERROR_DE_ARCHIVO };
  return { ok: true, archivo: { path, nombre: nombreVisibleDeArchivo(typeof entrada.nombre === "string" ? entrada.nombre : null, path) } };
}

/** Lo que se muestra del comprobante: el nombre del archivo (nunca el path, que lleva el id de quien lo subió). */
export const nombreDeComprobanteParaMostrar = (nombre: string | null | undefined): string => nombre?.trim() || "Comprobante";

/** Dirección que abre el comprobante (comprueba que sea admin y redirige a una URL firmada). */
export const rutaDeComprobanteDePago = (comprobanteId: string) => `/api/comprobantes/${comprobanteId}`;
