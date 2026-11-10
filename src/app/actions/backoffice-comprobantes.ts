"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { transaccion } from "@/db";
import { comprobantesPago, creditosBusqueda, facturas } from "@/db/schema";
import { fallo, ok, type Resultado } from "@/lib/acciones";
import { registrarAuditoria } from "@/lib/auditoria";
import { requerirUsuario } from "@/lib/auth";
import { esUuid } from "@/lib/busquedas";
import { leerArchivoDeComprobante, type DestinoDeComprobante } from "@/lib/comprobantes-pago";
import { resumenDeError } from "@/lib/errores";
import { borrarArchivos } from "@/lib/queries/archivos";

/*
 * Comprobante de un pago (la captura o el PDF de la transferencia, el recibo…) que adjunta el equipo: ver `src/lib/comprobantes-pago.ts`. Cada acción
 * exige rol admin, relee el pago dentro de la transacción y deja auditoría con los ids y nunca con el nombre del archivo ni el path. El archivo
 * que se reemplaza o se quita se borra de Storage DESPUÉS de confirmar la base (si falla, queda como huérfano para `db:limpiar-archivos`).
 */

const PAGO_NO_ENCONTRADO = "No encontramos ese pago.";
const SOLO_PAGOS = "Solo se adjunta el comprobante a un pago registrado.";

function revalidarComprobantes(institucionId: string | undefined) {
  revalidatePath("/backoffice/cobros/pagos");
  if (institucionId) revalidatePath(`/backoffice/cobros/${institucionId}`);
}

/**
 * Adjunta el comprobante a un pago ya registrado (o reemplaza el que tenía). El archivo tiene que haberlo subido esta cuenta a la carpeta de
 * comprobantes (`/api/subir`): el servidor no acepta el path de otra cuenta ni de otra carpeta.
 */
export async function adjuntarComprobante(destino: DestinoDeComprobante, entrada: { path: string; nombre: string }): Promise<Resultado<{ id: string }>> {
  const admin = await requerirUsuario("admin");
  if (typeof destino !== "object" || destino === null || (destino.tipo !== "factura" && destino.tipo !== "puntual") || !esUuid(destino.id)) return fallo(PAGO_NO_ENCONTRADO);
  const archivo = leerArchivoDeComprobante(typeof entrada === "object" && entrada !== null ? entrada : { path: null, nombre: null }, admin.id);
  if (!archivo.ok) return fallo(archivo.error);

  let institucionId: string | undefined;
  let reemplazado: string | null = null;
  let guardadoId = "";
  try {
    const resultado = await transaccion(async (tx) => {
      // El pago tiene que existir y estar registrado: una factura impaga todavía no tiene un pago al que adjuntarle nada.
      if (destino.tipo === "factura") {
        const [factura] = await tx.select({ institucionId: facturas.institucionId, estado: facturas.estado }).from(facturas).where(eq(facturas.id, destino.id)).limit(1).for("update");
        if (!factura) return fallo(PAGO_NO_ENCONTRADO);
        if (factura.estado !== "pagada") return fallo(SOLO_PAGOS);
        institucionId = factura.institucionId;
      } else {
        const [credito] = await tx.select({ institucionId: creditosBusqueda.institucionId }).from(creditosBusqueda).where(eq(creditosBusqueda.id, destino.id)).limit(1).for("update");
        if (!credito) return fallo(PAGO_NO_ENCONTRADO);
        institucionId = credito.institucionId;
      }

      const columna = destino.tipo === "factura" ? comprobantesPago.facturaId : comprobantesPago.creditoId;
      const [actual] = await tx.select({ id: comprobantesPago.id, path: comprobantesPago.path }).from(comprobantesPago).where(eq(columna, destino.id)).limit(1);
      let id: string;
      if (actual) {
        reemplazado = actual.path === archivo.archivo.path ? null : actual.path;
        await tx
          .update(comprobantesPago)
          .set({ path: archivo.archivo.path, nombre: archivo.archivo.nombre, subidoPor: admin.id, creadoEn: new Date() })
          .where(eq(comprobantesPago.id, actual.id));
        id = actual.id;
      } else {
        const [nuevo] = await tx
          .insert(comprobantesPago)
          .values({
            facturaId: destino.tipo === "factura" ? destino.id : null,
            creditoId: destino.tipo === "puntual" ? destino.id : null,
            path: archivo.archivo.path,
            nombre: archivo.archivo.nombre,
            subidoPor: admin.id,
          })
          .returning({ id: comprobantesPago.id });
        id = nuevo!.id;
      }
      guardadoId = id;
      await registrarAuditoria(
        {
          usuarioId: admin.id,
          accion: "pago.comprobante_adjuntar",
          entidad: destino.tipo === "factura" ? "factura" : "institucion",
          entidadId: destino.tipo === "factura" ? destino.id : institucionId!,
          detalle: { institucionId, tipo: destino.tipo, pagoId: destino.id, reemplazo: Boolean(actual) },
        },
        tx,
      );
      return ok({ id });
    });
    if (!resultado.ok) return resultado;
  } catch (e) {
    console.error("[comprobantes] no se pudo adjuntar", resumenDeError(e));
    return fallo("No pudimos adjuntar el comprobante. Probá de nuevo.");
  }
  await borrarArchivos([reemplazado]);
  revalidarComprobantes(institucionId);
  return ok({ id: guardadoId });
}

/** Quita el comprobante de un pago (por ejemplo, porque era el de otra transferencia) y borra el archivo. */
export async function quitarComprobante(comprobanteId: string): Promise<Resultado> {
  const admin = await requerirUsuario("admin");
  if (!esUuid(comprobanteId)) return fallo("No encontramos ese comprobante.");

  let institucionId: string | undefined;
  let path: string | null = null;
  try {
    const resultado = await transaccion(async (tx) => {
      const [fila] = await tx.select().from(comprobantesPago).where(eq(comprobantesPago.id, comprobanteId)).limit(1).for("update");
      if (!fila) return fallo("No encontramos ese comprobante.");
      path = fila.path;
      if (fila.facturaId) {
        const [f] = await tx.select({ institucionId: facturas.institucionId }).from(facturas).where(eq(facturas.id, fila.facturaId)).limit(1);
        institucionId = f?.institucionId;
      } else if (fila.creditoId) {
        const [c] = await tx.select({ institucionId: creditosBusqueda.institucionId }).from(creditosBusqueda).where(eq(creditosBusqueda.id, fila.creditoId)).limit(1);
        institucionId = c?.institucionId;
      }
      await tx.delete(comprobantesPago).where(eq(comprobantesPago.id, fila.id));
      await registrarAuditoria(
        {
          usuarioId: admin.id,
          accion: "pago.comprobante_quitar",
          entidad: fila.facturaId ? "factura" : "institucion",
          entidadId: fila.facturaId ?? institucionId ?? fila.id,
          detalle: { institucionId, tipo: fila.facturaId ? "factura" : "puntual", pagoId: fila.facturaId ?? fila.creditoId },
        },
        tx,
      );
      return ok();
    });
    if (!resultado.ok) return resultado;
  } catch (e) {
    console.error("[comprobantes] no se pudo quitar", resumenDeError(e));
    return fallo("No pudimos quitar el comprobante. Probá de nuevo.");
  }
  await borrarArchivos([path]);
  revalidarComprobantes(institucionId);
  return ok();
}
