"use server";

import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { transaccion } from "@/db";
import { cobrosMp, instituciones, mesesBonificados, referidosInstituciones } from "@/db/schema";
import { fallo, ok, type Resultado } from "@/lib/acciones";
import { registrarAuditoria } from "@/lib/auditoria";
import { requerirUsuario } from "@/lib/auth";
import { motivoParaNoDeshacer, mesesTexto, puedeBonificarMeses, TIPOS_DE_BENEFICIO, type TipoDeBeneficio } from "@/lib/bonificacion";
import { esUuid } from "@/lib/busquedas";
import { etiquetaPeriodo } from "@/lib/cobros";
import { pesos } from "@/lib/planes";
import { avisarAVarios } from "@/lib/queries/avisos";
import { destinatariosDeInstitucion } from "@/lib/queries/backoffice-instituciones";
import { borrarMesesDeReferido, crearMeses, mesesUsadosDeReferido } from "@/lib/queries/bonificaciones";
import { planes } from "@/lib/queries/planes";
import { institucionPago } from "@/lib/queries/referidos";
import { estadoDeReferido, puedeAplicarBeneficio, puedeDeshacerBeneficio } from "@/lib/referidos";

/*
 * Referidos, del lado del equipo. Solo admin. El equipo marca cuándo aplicó el beneficio a la institución que recomendó, o lo deshace si se
 * marcó por error. Se aplica de dos maneras (ver src/lib/bonificacion.ts): como pack por adelantado (se carga al facturar, a mano) o como
 * meses bonificados para quien paga mes a mes (cada mes sin gastar queda anotado y se descuenta solo de la próxima factura; con débito
 * automático el equipo devuelve a mano el cobro de cada uno y lo marca acá). Queda en la actividad de la institución que recomendó y se le
 * avisa en la campanita (sin mail). No se puede aplicar el beneficio de una recomendación cuya institución todavía no pagó una factura.
 */

const NO_ENCONTRADO = "No encontramos esa recomendación.";
const NO_ENCONTRADA_LA_DEVOLUCION = "No encontramos esa devolución.";

/**
 * Marca (o deshace) que el equipo ya aplicó el beneficio de una recomendación. Al aplicar se elige cómo: `pack` (por adelantado, a mano al
 * facturar) o `meses` (meses bonificados que se descuentan solos; la cantidad sale de Planes). Deshacer un beneficio de meses solo se puede
 * si todavía no se gastó ninguno.
 */
export async function marcarBeneficioDeReferido(referidoId: string, aplicado: boolean, tipo: TipoDeBeneficio = "pack"): Promise<Resultado> {
  const admin = await requerirUsuario("admin");
  if (!esUuid(referidoId) || typeof aplicado !== "boolean" || !TIPOS_DE_BENEFICIO.includes(tipo)) return fallo(NO_ENCONTRADO);
  const P = await planes();

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

    const estado = estadoDeReferido({
      verificada: recomendada.verificada,
      pagada: await institucionPago(tx, fila.referidoId),
      beneficioEn: fila.beneficioEn,
    });
    if (aplicado && !puedeAplicarBeneficio(estado)) {
      return fallo(estado === "beneficio" ? "El beneficio ya estaba aplicado." : "Todavía no se puede: la institución recomendada no pagó su primera factura.");
    }
    if (!aplicado && !puedeDeshacerBeneficio(estado)) return fallo("Ese beneficio no estaba aplicado.");

    let meses = 0;
    if (aplicado && tipo === "meses") {
      // Los meses se descuentan de una mensualidad: solo tiene sentido para quien paga mes a mes.
      const [referidora] = await tx.select({ plan: instituciones.plan }).from(instituciones).where(eq(instituciones.id, fila.referidorId)).limit(1);
      if (!referidora) return fallo(NO_ENCONTRADO);
      if (!puedeBonificarMeses(P.esPuntual(referidora.plan))) {
        return fallo("Esta institución no paga mes a mes: aplicale el beneficio como pack por adelantado.");
      }
      meses = P.condiciones.referidoMesesMensual;
      if (meses < 1) return fallo("Los meses bonificados no están habilitados: se activan en Planes → Condiciones.");
      await crearMeses(tx, fila.referidorId, fila.id, meses);
    }
    if (!aplicado && fila.beneficioTipo === "meses") {
      const motivo = motivoParaNoDeshacer(await mesesUsadosDeReferido(tx, fila.id));
      if (motivo) return fallo(motivo);
      await borrarMesesDeReferido(tx, fila.id);
    }

    await tx
      .update(referidosInstituciones)
      .set({ beneficioEn: aplicado ? sql`now()` : null, beneficioTipo: aplicado ? tipo : null })
      .where(eq(referidosInstituciones.id, fila.id));
    // Se anota sobre la institución que recomendó: así aparece en su actividad, junto con el resto de lo que hizo el equipo con su cuenta.
    await registrarAuditoria(
      {
        usuarioId: admin.id,
        accion: aplicado ? "referido.beneficio_aplicado" : "referido.beneficio_deshecho",
        entidad: "institucion",
        entidadId: fila.referidorId,
        detalle: {
          referidoId: fila.referidoId,
          nombre: recomendada.nombre,
          tipo: aplicado ? tipo : fila.beneficioTipo === "meses" ? "meses" : "pack",
          ...(meses > 0 ? { meses } : {}),
        },
      },
      tx,
    );
    if (aplicado) {
      await avisarAVarios(tx, await destinatariosDeInstitucion(tx, fila.referidorId), {
        tipo: "sistema",
        titulo: "UNIDOAR",
        texto:
          tipo === "meses"
            ? `te bonificamos ${mesesTexto(meses)} por recomendar a ${recomendada.nombre}: se descuentan de tus próximas facturas. Si pagás con débito automático, te devolvemos lo cobrado de cada mes bonificado.`
            : `aplicó tu beneficio por recomendar a ${recomendada.nombre}.`,
        enlace: "/institucion/referidos",
      });
    }
    return ok();
  });

  if (resultado.ok) {
    revalidatePath("/backoffice/referidos");
    revalidatePath("/institucion/referidos");
    revalidatePath("/institucion/plan");
  }
  return resultado;
}

/**
 * Marca (o deshace) que el equipo ya devolvió desde Mercado Pago el cobro de un mes bonificado. Solo los meses que se gastaron sobre un cobro del
 * débito automático tienen algo que devolver. Queda en la actividad de la institución y, al devolver, se le avisa en la campanita.
 */
export async function marcarDevolucionDeMes(mesId: string, devuelto: boolean): Promise<Resultado> {
  const admin = await requerirUsuario("admin");
  if (!esUuid(mesId) || typeof devuelto !== "boolean") return fallo(NO_ENCONTRADA_LA_DEVOLUCION);

  const resultado = await transaccion(async (tx) => {
    const [mes] = await tx.select().from(mesesBonificados).where(eq(mesesBonificados.id, mesId)).limit(1).for("update");
    if (!mes || !mes.cobroId || !mes.periodo) return fallo(NO_ENCONTRADA_LA_DEVOLUCION);
    if (devuelto && mes.devueltoEn) return fallo("Esa devolución ya estaba marcada como hecha.");
    if (!devuelto && !mes.devueltoEn) return fallo("Esa devolución no estaba marcada como hecha.");

    const [cobro] = await tx.select({ monto: cobrosMp.monto }).from(cobrosMp).where(eq(cobrosMp.id, mes.cobroId)).limit(1);
    await tx.update(mesesBonificados).set({ devueltoEn: devuelto ? sql`now()` : null }).where(eq(mesesBonificados.id, mes.id));
    await registrarAuditoria(
      {
        usuarioId: admin.id,
        accion: devuelto ? "referido.devolucion_hecha" : "referido.devolucion_deshecha",
        entidad: "institucion",
        entidadId: mes.institucionId,
        detalle: { periodo: mes.periodo, ...(cobro?.monto ? { monto: cobro.monto } : {}) },
      },
      tx,
    );
    if (devuelto) {
      await avisarAVarios(tx, await destinatariosDeInstitucion(tx, mes.institucionId), {
        tipo: "sistema",
        titulo: "UNIDOAR",
        texto: `te devolvimos el débito automático de ${etiquetaPeriodo(mes.periodo)}${cobro?.monto ? ` (${pesos(cobro.monto)})` : ""}, bonificado por recomendar. Puede tardar unos días en verse en tu medio de pago.`,
        enlace: "/institucion/plan",
      });
    }
    return ok();
  });

  if (resultado.ok) {
    revalidatePath("/backoffice/referidos");
    revalidatePath("/institucion/plan");
    revalidatePath("/institucion/referidos");
  }
  return resultado;
}
