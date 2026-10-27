import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { formasDePago } from "@/db/schema";
import { esFormaDePago, type FormaDePago } from "@/lib/forma-de-pago";
import type { Ejecutor } from "@/lib/queries/pipeline";

/*
 * Cómo prefiere pagar el abono cada institución (reglas y textos en src/lib/forma-de-pago.ts). Una fila en `formas_de_pago` solo existe para
 * quien eligió pagar el semestre; sin fila, paga mes a mes.
 */

/**
 * La forma de pago que eligió la institución. Si la tabla todavía no existe (falta correr `pnpm db:planes`) responde «mensual» en lugar de romper la
 * pantalla: es solo una preferencia que se muestra. No usar dentro de una transacción (una consulta que falla la aborta): ahí, `guardarFormaDePago`.
 */
export async function formaDePagoDe(institucionId: string, ejecutor: Ejecutor = getDb()): Promise<FormaDePago> {
  try {
    const [fila] = await ejecutor.select({ forma: formasDePago.forma }).from(formasDePago).where(eq(formasDePago.institucionId, institucionId)).limit(1);
    return fila && esFormaDePago(fila.forma) ? fila.forma : "mensual";
  } catch {
    return "mensual";
  }
}

/**
 * Anota la forma de pago de la institución (`mensual` borra la fila). Devuelve true si cambió algo, para avisar al equipo solo cuando hay una
 * novedad y no cada vez que se vuelve a guardar lo mismo. Va dentro de la transacción de quien llama.
 */
export async function guardarFormaDePago(ejecutor: Ejecutor, institucionId: string, forma: FormaDePago): Promise<boolean> {
  const [previa] = await ejecutor.select({ forma: formasDePago.forma }).from(formasDePago).where(eq(formasDePago.institucionId, institucionId)).limit(1);
  const antes: FormaDePago = previa && esFormaDePago(previa.forma) ? previa.forma : "mensual";
  if (antes === forma) return false;
  if (forma === "mensual") {
    await ejecutor.delete(formasDePago).where(eq(formasDePago.institucionId, institucionId));
  } else {
    await ejecutor
      .insert(formasDePago)
      .values({ institucionId, forma })
      .onConflictDoUpdate({ target: formasDePago.institucionId, set: { forma, actualizadoEn: new Date() } });
  }
  return true;
}
