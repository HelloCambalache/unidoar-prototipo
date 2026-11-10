import "server-only";
import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { comprobantesPago } from "@/db/schema";
import type { DestinoDeComprobante } from "@/lib/comprobantes-pago";
import type { Ejecutor } from "@/lib/queries/pipeline";

/*
 * Lecturas y borrados de los comprobantes de pago (ver `src/lib/comprobantes-pago.ts`). Se llaman siempre desde código que ya exigió rol admin.
 */

/** El comprobante adjunto de cada factura de la lista (una entrada por factura que lo tiene: id y nombre del archivo, nunca el path). */
export async function comprobantesDeFacturas(facturaIds: string[]): Promise<Map<string, { id: string; nombre: string }>> {
  if (facturaIds.length === 0) return new Map();
  const filas = await getDb()
    .select({ id: comprobantesPago.id, facturaId: comprobantesPago.facturaId, nombre: comprobantesPago.nombre })
    .from(comprobantesPago)
    .where(inArray(comprobantesPago.facturaId, facturaIds));
  const porFactura = new Map<string, { id: string; nombre: string }>();
  for (const f of filas) if (f.facturaId) porFactura.set(f.facturaId, { id: f.id, nombre: f.nombre });
  return porFactura;
}

/** Dónde está la columna que apunta al pago, según sea una factura o una búsqueda puntual. */
const columnaDe = (tipo: DestinoDeComprobante["tipo"]) => (tipo === "factura" ? comprobantesPago.facturaId : comprobantesPago.creditoId);

/**
 * Quita el comprobante de un pago y devuelve el path del archivo para borrarlo de Storage DESPUÉS de confirmar la transacción (`borrarArchivos`).
 * Se usa cuando el pago se anula: un comprobante de un pago que ya no existe no tiene por qué quedar. Sin comprobante devuelve una lista vacía.
 */
export async function quitarComprobanteDelPago(ejecutor: Ejecutor, destino: DestinoDeComprobante): Promise<string[]> {
  const borrados = await ejecutor.delete(comprobantesPago).where(eq(columnaDe(destino.tipo), destino.id)).returning({ path: comprobantesPago.path });
  return borrados.map((b) => b.path);
}
