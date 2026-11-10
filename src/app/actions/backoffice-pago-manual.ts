"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { transaccion } from "@/db";
import { habilitacionesPagoManual, instituciones } from "@/db/schema";
import { fallo, ok, type Resultado } from "@/lib/acciones";
import { registrarAuditoria } from "@/lib/auditoria";
import { requerirUsuario } from "@/lib/auth";
import { esUuid } from "@/lib/busquedas";
import { resumenDeError } from "@/lib/errores";

/*
 * Habilitar (o dejar de habilitar) a una institución a pagar por transferencia o efectivo, del lado del equipo (solo admin). Sin habilitar, la
 * institución paga con Mercado Pago cuando Mercado Pago está disponible para ella (ver src/lib/pago-manual.ts). Cambia lo que ve la institución:
 * el equipo puede seguir registrando un pago manual a cualquiera. Queda en la actividad de la institución. No se le avisa: no cambia lo que debe.
 */

const NO_ENCONTRADA = "No encontramos esa institución.";
const ACCION_PAGO_MANUAL = "institucion.pago_manual";

export async function cambiarPagoManual(institucionId: string, habilitada: boolean): Promise<Resultado<{ cambio: boolean }>> {
  const admin = await requerirUsuario("admin");
  if (!esUuid(institucionId) || typeof habilitada !== "boolean") return fallo(NO_ENCONTRADA);

  try {
    const resultado = await transaccion(async (tx) => {
      // Se relee con la fila bloqueada: dos personas del equipo no se pisan, y una institución dada de baja no se toca.
      const [inst] = await tx
        .select({ id: instituciones.id, bajaEn: instituciones.bajaEn })
        .from(instituciones)
        .where(eq(instituciones.id, institucionId))
        .limit(1)
        .for("update");
      if (!inst || inst.bajaEn) return fallo(NO_ENCONTRADA);

      const [actual] = await tx
        .select({ id: habilitacionesPagoManual.institucionId })
        .from(habilitacionesPagoManual)
        .where(eq(habilitacionesPagoManual.institucionId, institucionId))
        .limit(1);
      if (Boolean(actual) === habilitada) return ok({ cambio: false });

      if (habilitada) {
        await tx.insert(habilitacionesPagoManual).values({ institucionId, habilitadaPor: admin.id }).onConflictDoNothing();
      } else {
        await tx.delete(habilitacionesPagoManual).where(eq(habilitacionesPagoManual.institucionId, institucionId));
      }
      await registrarAuditoria(
        { usuarioId: admin.id, accion: ACCION_PAGO_MANUAL, entidad: "institucion", entidadId: institucionId, detalle: { habilitada } },
        tx,
      );
      return ok({ cambio: true });
    });
    if (!resultado.ok) return resultado;
    revalidatePath(`/backoffice/instituciones/${institucionId}`);
    revalidatePath(`/backoffice/cobros/${institucionId}`);
    revalidatePath("/institucion/plan");
    revalidatePath("/institucion", "layout");
    return resultado;
  } catch (e) {
    console.error("[backoffice-pago-manual] no se pudo guardar", resumenDeError(e));
    return fallo("No pudimos guardar el cambio. Probá de nuevo.");
  }
}
