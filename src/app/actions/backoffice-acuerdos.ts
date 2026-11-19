"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { transaccion } from "@/db";
import { acuerdosPrecio, instituciones } from "@/db/schema";
import { fallo, ok, parsear, type Resultado } from "@/lib/acciones";
import { acuerdoSchema, errorDeHasta, type AcuerdoCargado } from "@/lib/acuerdos";
import { registrarAuditoria } from "@/lib/auditoria";
import { requerirUsuario } from "@/lib/auth";
import { esUuid } from "@/lib/busquedas";
import { periodoActual } from "@/lib/cobros";
import { resumenDeError } from "@/lib/errores";
import { acuerdoConNota } from "@/lib/queries/acuerdos";
import { planes, planesParaCobrarOFallar, SIN_PRECIOS } from "@/lib/queries/planes";

/*
 * Precio acordado con una institución, del lado del equipo (solo admin). Un abono propio (cualquier monto desde 0 hasta el de lista) o
 * un convenio a medida (un monto mensual fijo de cualquier valor, para redes o para lo que se acuerde). Con un monto de 0 la institución no
 * paga nada («sin cargo»), y con un fin (`hasta`, el último mes en que rige) vuelve sola al precio de lista pasado ese mes. Rige desde la
 * próxima factura: las ya emitidas guardan su monto, y el débito automático se pone al día con el cron diario. Queda en la actividad de la
 * institución con los montos de antes y de después (la nota es interna y no va a la auditoría). No se le avisa a la institución: es un acuerdo
 * que ya conoce.
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
  const { modalidad, monto, nota, hasta } = datos.data;
  // El fin del acuerdo no puede ser un mes que ya pasó (un acuerdo que ya terminó no tiene sentido guardarlo).
  const errorDeFin = errorDeHasta(hasta, periodoActual());
  if (errorDeFin) return fallo(errorDeFin, { hasta: errorDeFin });
  // El rango del abono se valida con los precios vigentes: con los de lanzamiento (si la base no respondió) se aceptaría un monto fuera de rango.
  const P = await planesParaCobrarOFallar();
  if (!P) return fallo(SIN_PRECIOS);

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
      // El acuerdo queda atado al plan que tiene hoy la institución: solo rige con ese plan (ver `acuerdoQueRige`). Volver a guardar el mismo
      // monto sobre un acuerdo hecho para otro plan SÍ es un cambio: lo vuelve a poner en vigencia con el plan actual.
      // Un acuerdo que ya terminó no cuenta como «el anterior» (la institución estaba pagando el de lista): se anota como que no había.
      const vigente = previo && !previo.vencido ? previo : null;
      const igual =
        previo &&
        !previo.vencido &&
        previo.acuerdo.modalidad === modalidad &&
        previo.acuerdo.monto === monto &&
        previo.acuerdo.plan === inst.plan &&
        (previo.acuerdo.hasta ?? undefined) === hasta &&
        (previo.nota ?? undefined) === nota;
      if (igual) return ok({ cambio: false });

      await tx
        .insert(acuerdosPrecio)
        .values({ institucionId, modalidad, monto, plan: inst.plan, hasta: hasta ?? null, nota: nota ?? null })
        .onConflictDoUpdate({
          target: acuerdosPrecio.institucionId,
          set: { modalidad, monto, plan: inst.plan, hasta: hasta ?? null, nota: nota ?? null, actualizadoEn: new Date() },
        });
      await registrarAuditoria(
        {
          usuarioId: admin.id,
          accion: ACCION_PRECIO_ACORDADO,
          entidad: "institucion",
          entidadId: institucionId,
          detalle: { plan: inst.plan, antes: vigente ? vigente.acuerdo : null, despues: { modalidad, monto, ...(hasta ? { hasta } : {}) } },
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
          // Uno que ya terminó no se anota como «el que había»: la institución ya pagaba el de lista.
          detalle: { plan: inst.plan, antes: previo.vencido ? null : previo.acuerdo, despues: null, lista: P.abonoDe(inst.plan) },
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
