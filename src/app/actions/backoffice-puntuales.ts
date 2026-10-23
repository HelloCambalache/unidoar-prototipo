"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { transaccion } from "@/db";
import { creditosBusqueda, instituciones } from "@/db/schema";
import { fallo, ok, parsear, type Resultado } from "@/lib/acciones";
import { registrarAuditoria } from "@/lib/auditoria";
import { requerirUsuario } from "@/lib/auth";
import { esUuid } from "@/lib/busquedas";
import { anulacionSchema, errorDeFechaDePago, hoyAR, pagoPuntualSchema, periodoActual, type PagoPuntual } from "@/lib/cobros";
import { correoDePagoRegistrado } from "@/lib/correo/eventos";
import { resumenDeError } from "@/lib/errores";
import { pesos } from "@/lib/planes";
import { acuerdoDe } from "@/lib/queries/acuerdos";
import { avisarAVarios } from "@/lib/queries/avisos";
import { destinatariosDeFacturacion, destinatariosDeInstitucion } from "@/lib/queries/backoffice-instituciones";
import { planes } from "@/lib/queries/planes";

/*
 * Búsquedas puntuales, del lado del equipo (solo admin): registrar que una institución con el plan de búsqueda puntual pagó UNA búsqueda (queda un
 * «crédito» disponible que se consume al publicar) y anular ese registro si todavía no se usó. Las reglas están en src/lib/puntual.ts y el acceso a
 * los créditos en src/lib/queries/puntuales.ts. No es una factura mensual: no se carga en `facturas`.
 */

const NO_ENCONTRADA = "No encontramos esa institución.";

function revalidar(institucionId: string) {
  revalidatePath("/backoffice/cobros");
  revalidatePath(`/backoffice/cobros/${institucionId}`);
  revalidatePath(`/backoffice/instituciones/${institucionId}`);
  revalidatePath("/institucion/plan");
  revalidatePath("/institucion/publicar");
  revalidatePath("/institucion/busquedas");
}

/**
 * Registra el pago de una búsqueda puntual. El monto sale del plan de búsqueda puntual y del precio acordado de la institución (nunca del cliente).
 * Deja una búsqueda pagada y disponible, queda en la actividad y, si se tilda, le avisa a la institución (campanita y mail) que ya puede publicarla.
 */
export async function registrarPagoDeBusquedaPuntual(institucionId: string, entrada: PagoPuntual): Promise<Resultado<{ id: string }>> {
  const admin = await requerirUsuario("admin");
  if (!esUuid(institucionId)) return fallo(NO_ENCONTRADA);
  const datos = parsear(pagoPuntualSchema, typeof entrada === "object" && entrada !== null ? entrada : {});
  if (!datos.ok) return fallo(Object.values(datos.campos ?? {})[0] ?? datos.error, datos.campos);
  const { medio, fecha, nota, avisar } = datos.data;

  const hoy = hoyAR();
  const errorFecha = errorDeFechaDePago(fecha, hoy);
  if (errorFecha) return fallo(errorFecha, { fecha: errorFecha });
  // Un pago de otro día se guarda al mediodía UTC de ese día (la misma fecha en Argentina); el de hoy, con su hora real.
  const pagadoEn = fecha === hoy ? new Date() : new Date(`${fecha}T12:00:00Z`);
  const P = await planes();

  try {
    const resultado = await transaccion(async (tx) => {
      const [inst] = await tx
        .select({ id: instituciones.id, nombre: instituciones.nombre, plan: instituciones.plan, bajaEn: instituciones.bajaEn })
        .from(instituciones)
        .where(eq(instituciones.id, institucionId))
        .limit(1)
        .for("update");
      if (!inst || inst.bajaEn) return fallo(NO_ENCONTRADA);
      if (!P.esPuntual(inst.plan)) {
        return fallo("Esta institución no tiene el plan de búsqueda puntual: cambiale el plan antes de registrar el pago de una búsqueda.");
      }

      const monto = P.montoDePlan(inst.plan, 1, await acuerdoDe(tx, institucionId));
      const [credito] = await tx.insert(creditosBusqueda).values({ institucionId, monto, medio, pagadoEn, nota: nota ?? null }).returning({ id: creditosBusqueda.id });

      await registrarAuditoria(
        {
          usuarioId: admin.id,
          accion: "busqueda_puntual.pago",
          entidad: "institucion",
          entidadId: institucionId,
          detalle: { creditoId: credito!.id, monto, medio, fechaPago: fecha, ...(nota ? { nota } : {}), avisoALaInstitucion: avisar },
        },
        tx,
      );
      if (avisar) {
        await avisarAVarios(tx, await destinatariosDeInstitucion(tx, institucionId), {
          tipo: "sistema",
          titulo: "UNIDOAR",
          texto: `registró tu pago de una búsqueda puntual (${pesos(monto)}). Ya podés publicarla: queda abierta ${P.condiciones.puntual.vigenciaDias} días. ¡Gracias!`,
          enlace: "/institucion/publicar",
        });
        await correoDePagoRegistrado(tx, {
          usuarioIds: await destinatariosDeFacturacion(tx, institucionId),
          institucion: inst.nombre,
          periodo: periodoActual(),
          concepto: "una búsqueda puntual",
          monto,
        });
      }
      return ok({ id: credito!.id });
    });
    if (resultado.ok) revalidar(institucionId);
    return resultado;
  } catch (e) {
    console.error("No se pudo registrar el pago de la búsqueda puntual", resumenDeError(e));
    return fallo("No pudimos registrar el pago. Probá de nuevo.");
  }
}

/**
 * Anula el registro del pago de una búsqueda puntual que todavía NO se usó (una ya publicada no se anula: ya se consumió). Pide un motivo, que queda
 * en la actividad, y puede avisarle a la institución.
 */
export async function anularPagoDeBusquedaPuntual(creditoId: string, entrada: { motivo: string; avisar: boolean }): Promise<Resultado> {
  const admin = await requerirUsuario("admin");
  if (!esUuid(creditoId)) return fallo("No encontramos ese pago.");
  const datos = parsear(anulacionSchema, entrada);
  if (!datos.ok) return fallo(datos.campos?.motivo ?? datos.error, datos.campos);

  let institucionId: string | undefined;
  try {
    const resultado = await transaccion(async (tx) => {
      const [credito] = await tx.select().from(creditosBusqueda).where(eq(creditosBusqueda.id, creditoId)).limit(1).for("update");
      if (!credito) return fallo("No encontramos ese pago.");
      institucionId = credito.institucionId;
      if (credito.usadoEn) return fallo("Esa búsqueda ya se publicó: no se puede anular su pago.");

      const borrado = await tx
        .delete(creditosBusqueda)
        .where(and(eq(creditosBusqueda.id, credito.id), isNull(creditosBusqueda.usadoEn)))
        .returning({ id: creditosBusqueda.id });
      if (borrado.length === 0) return fallo("Esa búsqueda ya se publicó: no se puede anular su pago.");

      await registrarAuditoria(
        {
          usuarioId: admin.id,
          accion: "busqueda_puntual.anular_pago",
          entidad: "institucion",
          entidadId: credito.institucionId,
          detalle: { creditoId: credito.id, monto: credito.monto, medio: credito.medio, motivo: datos.data.motivo, avisoALaInstitucion: datos.data.avisar },
        },
        tx,
      );
      if (datos.data.avisar) {
        await avisarAVarios(tx, await destinatariosDeInstitucion(tx, credito.institucionId), {
          tipo: "sistema",
          titulo: "UNIDOAR",
          texto: "corrigió el registro del pago de tu búsqueda puntual: ya no figura como pagada.",
          enlace: "/institucion/plan",
        });
      }
      return ok();
    });
    if (resultado.ok && institucionId) revalidar(institucionId);
    return resultado;
  } catch (e) {
    console.error("No se pudo anular el pago de la búsqueda puntual", resumenDeError(e));
    return fallo("No pudimos anular el pago. Probá de nuevo.");
  }
}
