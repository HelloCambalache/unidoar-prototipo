"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { transaccion } from "@/db";
import { acuerdosPrecio, instituciones } from "@/db/schema";
import { fallo, ok, parsear, type Resultado } from "@/lib/acciones";
import { acuerdoSchema, type AcuerdoCargado } from "@/lib/acuerdos";
import { registrarAuditoria } from "@/lib/auditoria";
import { requerirUsuario } from "@/lib/auth";
import { esUuid } from "@/lib/busquedas";
import { resumenDeError } from "@/lib/errores";
import { acuerdoConNota } from "@/lib/queries/acuerdos";
import { planes } from "@/lib/queries/planes";

/*
 * Precio acordado con una institución, del lado del equipo (solo admin). Un abono propio dentro del rango del plan (entre el piso y la lista) o
 * un convenio a medida (un monto mensual fijo, para redes). Rige desde la próxima factura: las ya emitidas guardan su monto, y el débito
 * automático se pone al día con el cron diario. Queda en la actividad de la institución con los montos de antes y de después (la nota es
 * interna y no va a la auditoría). No se le avisa a la institución: es un acuerdo que ya conoce.
 */

const NO_ENCONTRADA = "No encontramos esa institución.";
const ACCION_PRECIO_ACORDADO = "institucion.precio_acordado";

function revalidar(institucionId: string) {
  revalidatePath("/backoffice/cobros");
  revalidatePath(`/backoffice/cobros/${institucionId}`);
  revalidatePath(`/backoffice/instituciones/${institucionId}`);
  revalidatePath("/institucion/plan");
  revalidatePath("/institucion/sedes");
}

/** Guarda (o cambia) el precio acordado de una institución. Valida el abono contra el rango del plan de la institución. */
export async function guardarAcuerdoDePrecio(institucionId: string, entrada: AcuerdoCargado): Promise<Resultado<{ cambio: boolean }>> {
  const admin = await requerirUsuario("admin");
  if (!esUuid(institucionId)) return fallo(NO_ENCONTRADA);
  const datos = parsear(acuerdoSchema, typeof entrada === "object" && entrada !== null ? entrada : {});
  if (!datos.ok) return fallo(Object.values(datos.campos ?? {})[0] ?? datos.error, datos.campos);
  const { modalidad, monto, nota } = datos.data;
  const P = await planes();

  try {
    const resultado = await transaccion(async (tx) => {
      // Se relee con la fila bloqueada: dos personas del equipo no se pisan, y se valida contra el plan que tiene ahora.
      const [inst] = await tx
        .select({ id: instituciones.id, plan: instituciones.plan, bajaEn: instituciones.bajaEn })
        .from(instituciones)
        .where(eq(instituciones.id, institucionId))
        .limit(1)
        .for("update");
      if (!inst || inst.bajaEn) return fallo(NO_ENCONTRADA);

      const error = P.errorDeAcuerdo(inst.plan, { modalidad, monto });
      if (error) return fallo(error, { monto: error });

      const previo = await acuerdoConNota(tx, institucionId);
      const igual = previo && previo.acuerdo.modalidad === modalidad && previo.acuerdo.monto === monto && (previo.nota ?? undefined) === nota;
      if (igual) return ok({ cambio: false });

      await tx
        .insert(acuerdosPrecio)
        .values({ institucionId, modalidad, monto, nota: nota ?? null })
        .onConflictDoUpdate({ target: acuerdosPrecio.institucionId, set: { modalidad, monto, nota: nota ?? null, actualizadoEn: new Date() } });
      await registrarAuditoria(
        {
          usuarioId: admin.id,
          accion: ACCION_PRECIO_ACORDADO,
          entidad: "institucion",
          entidadId: institucionId,
          detalle: { plan: inst.plan, antes: previo ? previo.acuerdo : null, despues: { modalidad, monto } },
        },
        tx,
      );
      return ok({ cambio: true });
    });
    if (resultado.ok) revalidar(institucionId);
    return resultado;
  } catch (e) {
    console.error("No se pudo guardar el precio acordado", resumenDeError(e));
    return fallo("No pudimos guardar el precio. Probá de nuevo.");
  }
}

/** Vuelve a la institución al precio de lista (borra el acuerdo). */
export async function quitarAcuerdoDePrecio(institucionId: string): Promise<Resultado<{ cambio: boolean }>> {
  const admin = await requerirUsuario("admin");
  if (!esUuid(institucionId)) return fallo(NO_ENCONTRADA);
  const P = await planes();

  try {
    const resultado = await transaccion(async (tx) => {
      const [inst] = await tx
        .select({ id: instituciones.id, plan: instituciones.plan, bajaEn: instituciones.bajaEn })
        .from(instituciones)
        .where(eq(instituciones.id, institucionId))
        .limit(1)
        .for("update");
      if (!inst || inst.bajaEn) return fallo(NO_ENCONTRADA);

      const previo = await acuerdoConNota(tx, institucionId);
      if (!previo) return ok({ cambio: false });
      await tx.delete(acuerdosPrecio).where(eq(acuerdosPrecio.institucionId, institucionId));
      await registrarAuditoria(
        {
          usuarioId: admin.id,
          accion: ACCION_PRECIO_ACORDADO,
          entidad: "institucion",
          entidadId: institucionId,
          detalle: { plan: inst.plan, antes: previo.acuerdo, despues: null, lista: P.abonoDe(inst.plan) },
        },
        tx,
      );
      return ok({ cambio: true });
    });
    if (resultado.ok) revalidar(institucionId);
    return resultado;
  } catch (e) {
    console.error("No se pudo volver al precio de lista", resumenDeError(e));
    return fallo("No pudimos volver al precio de lista. Probá de nuevo.");
  }
}
