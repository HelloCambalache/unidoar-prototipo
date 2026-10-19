"use server";

import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { transaccion } from "@/db";
import { instituciones, referidosInstituciones } from "@/db/schema";
import { fallo, ok, type Resultado } from "@/lib/acciones";
import { registrarAuditoria } from "@/lib/auditoria";
import { requerirUsuario } from "@/lib/auth";
import { esUuid } from "@/lib/busquedas";
import { avisarAVarios } from "@/lib/queries/avisos";
import { destinatariosDeInstitucion } from "@/lib/queries/backoffice-instituciones";
import { estadoDeReferido, puedeAplicarBeneficio, puedeDeshacerBeneficio } from "@/lib/referidos";

/*
 * Referidos, del lado del equipo. Solo admin. El equipo marca cuándo aplicó el beneficio a la institución que recomendó (al facturar:
 * hoy los cobros se cargan a mano), o lo deshace si se marcó por error. Queda en la actividad de la institución que recomendó y se le
 * avisa en la campanita (sin mail). No se puede aplicar el beneficio de una recomendación cuya institución todavía no está verificada.
 */

const NO_ENCONTRADO = "No encontramos esa recomendación.";

/** Marca (o deshace) que el equipo ya aplicó el beneficio de una recomendación. */
export async function marcarBeneficioDeReferido(referidoId: string, aplicado: boolean): Promise<Resultado> {
  const admin = await requerirUsuario("admin");
  if (!esUuid(referidoId) || typeof aplicado !== "boolean") return fallo(NO_ENCONTRADO);

  const resultado = await transaccion(async (tx) => {
    // Se relee con la fila bloqueada: dos operadores no se pisan al marcar la misma recomendación.
    const [fila] = await tx.select().from(referidosInstituciones).where(eq(referidosInstituciones.id, referidoId)).limit(1).for("update");
    if (!fila) return fallo(NO_ENCONTRADO);
    const [recomendada] = await tx
      .select({ nombre: instituciones.nombre, verificada: instituciones.verificada })
      .from(instituciones)
      .where(eq(instituciones.id, fila.referidoId))
      .limit(1);
    if (!recomendada) return fallo(NO_ENCONTRADO);

    const estado = estadoDeReferido({ verificada: recomendada.verificada, beneficioEn: fila.beneficioEn });
    if (aplicado && !puedeAplicarBeneficio(estado)) {
      return fallo(estado === "beneficio" ? "El beneficio ya estaba aplicado." : "Todavía no se puede: la institución recomendada no está verificada.");
    }
    if (!aplicado && !puedeDeshacerBeneficio(estado)) return fallo("Ese beneficio no estaba aplicado.");

    await tx.update(referidosInstituciones).set({ beneficioEn: aplicado ? sql`now()` : null }).where(eq(referidosInstituciones.id, fila.id));
    // Se anota sobre la institución que recomendó: así aparece en su actividad, junto con el resto de lo que hizo el equipo con su cuenta.
    await registrarAuditoria(
      {
        usuarioId: admin.id,
        accion: aplicado ? "referido.beneficio_aplicado" : "referido.beneficio_deshecho",
        entidad: "institucion",
        entidadId: fila.referidorId,
        detalle: { referidoId: fila.referidoId, nombre: recomendada.nombre },
      },
      tx,
    );
    if (aplicado) {
      await avisarAVarios(tx, await destinatariosDeInstitucion(tx, fila.referidorId), {
        tipo: "sistema",
        titulo: "UNIDOAR",
        texto: `aplicó tu beneficio por recomendar a ${recomendada.nombre}.`,
        enlace: "/institucion/referidos",
      });
    }
    return ok();
  });

  if (resultado.ok) {
    revalidatePath("/backoffice/referidos");
    revalidatePath("/institucion/referidos");
  }
  return resultado;
}
