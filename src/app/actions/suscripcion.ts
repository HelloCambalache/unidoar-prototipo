"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { suscripcionesMp } from "@/db/schema";
import { fallo, ok, type Resultado } from "@/lib/acciones";
import { registrarAuditoria } from "@/lib/auditoria";
import { requerirInstitucion } from "@/lib/auth";
import { origenDeLosMails } from "@/lib/correo/config";
import { cuerpoDeSuscripcion, esEmailDePago, esPlanDebitable, montoCobrable, suscripcionVigente } from "@/lib/debito-automatico";
import { resumenDeError } from "@/lib/errores";
import { mercadoPagoActivo } from "@/lib/mercadopago-config";
import {
  cancelarSuscripcionMp,
  crearSuscripcionMp,
  ErrorDeMercadoPago,
  obtenerSuscripcionMp,
} from "@/lib/mercadopago-cliente";
import { DEMASIADOS_PEDIDOS, permitirActivarDebito } from "@/lib/pedidos";
import { puedeGestionarPlan, rolEnInstitucion } from "@/lib/queries/plan";
import { planes } from "@/lib/queries/planes";
import { cantidadDeSedes } from "@/lib/queries/sedes";
import { aplicarEstadoDeSuscripcion, suscripcionDe } from "@/lib/queries/suscripcion";
import { cancelarSuscripcion } from "@/lib/queries/suscripcion-cancelar";

/*
 * Débito automático con Mercado Pago, del lado de la institución (ver CLAUDE.md, "Mercado Pago"). Las tres acciones exigen que la cuenta sea
 * dueña o administradora, y NUNCA reciben un monto ni un plan del navegador: el monto sale del catálogo y de las sedes de la institución.
 * Nunca se manejan datos de tarjeta: la persona los carga en Mercado Pago.
 */

const SOLO_GESTORES = "Solo el dueño y los administradores del equipo pueden manejar el débito automático.";
const NO_DISPONIBLE = "El débito automático todavía no está disponible. Escribinos por Contacto y lo resolvemos.";
const FALLO_DE_MERCADO_PAGO = "No pudimos comunicarnos con Mercado Pago. Probá de nuevo en un rato.";

const revalidarPlan = (institucionId: string) => {
  revalidatePath("/institucion/plan");
  revalidatePath(`/backoffice/cobros/${institucionId}`);
  revalidatePath(`/backoffice/instituciones/${institucionId}`);
};

/**
 * Crea la suscripción mensual en Mercado Pago y devuelve la dirección donde la persona carga su tarjeta y autoriza. Mientras no autorice
 * queda "pendiente" y no se cobra nada. `emailDePago` es con el que paga en Mercado Pago (por defecto, el de la cuenta).
 */
export async function activarDebitoAutomatico(emailDePago: string): Promise<Resultado<{ url: string | null }>> {
  const { usuario, institucion } = await requerirInstitucion();
  if (!mercadoPagoActivo()) return fallo(NO_DISPONIBLE);
  if (!permitirActivarDebito(usuario.id)) return fallo(DEMASIADOS_PEDIDOS);
  if (!puedeGestionarPlan(await rolEnInstitucion(institucion, usuario.id))) return fallo(SOLO_GESTORES);

  const email = typeof emailDePago === "string" ? emailDePago.trim().toLowerCase() : "";
  if (!esEmailDePago(email)) return fallo("Escribí un mail válido.", { email: "Escribí un mail válido." });
  if (!esPlanDebitable(institucion.plan)) return fallo("Tu plan es anual: se paga por adelantado y no tiene débito automático.");

  const existente = await suscripcionDe(institucion.id);
  if (existente && suscripcionVigente(existente.estado)) {
    return existente.estado === "pendiente" ? continuarDebitoAutomatico() : fallo("Ya tenés el débito automático activado.");
  }

  const P = await planes();
  const sedes = (await cantidadDeSedes(getDb(), [institucion.id])).get(institucion.id) ?? 1;
  const monto = P.montoDePlan(institucion.plan, sedes);
  if (!montoCobrable(monto)) return fallo("No pudimos calcular el monto de tu plan. Escribinos por Contacto.");

  try {
    const mp = await crearSuscripcionMp(
      cuerpoDeSuscripcion({
        institucionId: institucion.id,
        institucion: institucion.nombre,
        planLabel: P.planDe(institucion.plan).label,
        monto,
        email,
        volverA: `${origenDeLosMails()}/institucion/plan?debito=1`,
      }),
    );
    if (!mp.enlaceDeAutorizacion) return fallo(FALLO_DE_MERCADO_PAGO);

    // La fila se reemplaza solo si la anterior estaba cancelada: si dos pedidos llegan a la vez, el segundo no pisa al primero.
    const [guardada] = await getDb()
      .insert(suscripcionesMp)
      .values({ institucionId: institucion.id, suscripcionId: mp.id, estado: "pendiente", plan: institucion.plan, monto, email })
      .onConflictDoUpdate({
        target: suscripcionesMp.institucionId,
        set: { suscripcionId: mp.id, estado: "pendiente", plan: institucion.plan, monto, email, proximoCobro: null, creadaEn: new Date(), actualizadaEn: new Date() },
        setWhere: eq(suscripcionesMp.estado, "cancelada"),
      })
      .returning({ suscripcionId: suscripcionesMp.suscripcionId });
    if (guardada?.suscripcionId !== mp.id) {
      // Ya había otra en curso: esta quedó de más y no tiene que poder cobrar.
      await cancelarSuscripcionMp(mp.id).catch((e) => console.error("No se pudo cancelar la suscripción sobrante de Mercado Pago", resumenDeError(e)));
      return fallo("Ya tenés un débito automático en curso. Recargá la página.");
    }

    await registrarAuditoria({
      usuarioId: usuario.id,
      accion: "suscripcion.crear",
      entidad: "institucion",
      entidadId: institucion.id,
      detalle: { plan: institucion.plan, monto, sedes },
    });
    revalidarPlan(institucion.id);
    return ok({ url: mp.enlaceDeAutorizacion });
  } catch (e) {
    console.error("No se pudo crear la suscripción de Mercado Pago", resumenDeError(e));
    if (e instanceof ErrorDeMercadoPago && e.tipo === "rechazado") {
      return fallo("Mercado Pago no aceptó el pedido. Revisá el mail que escribiste o escribinos por Contacto.", { email: "Mercado Pago no aceptó este mail." });
    }
    return fallo(FALLO_DE_MERCADO_PAGO);
  }
}

/**
 * Para quien dejó la autorización a medias: devuelve de nuevo la dirección de Mercado Pago donde terminarla. Si Mercado Pago ya la tiene
 * autorizada (y el aviso todavía no nos llegó), la pone al día y devuelve `url: null`: la pantalla se actualiza sola.
 */
export async function continuarDebitoAutomatico(): Promise<Resultado<{ url: string | null }>> {
  const { usuario, institucion } = await requerirInstitucion();
  if (!mercadoPagoActivo()) return fallo(NO_DISPONIBLE);
  if (!puedeGestionarPlan(await rolEnInstitucion(institucion, usuario.id))) return fallo(SOLO_GESTORES);

  const susc = await suscripcionDe(institucion.id);
  if (!susc || susc.estado !== "pendiente") return fallo("No hay una autorización pendiente.");
  try {
    const mp = await obtenerSuscripcionMp(susc.suscripcionId);
    // Si Mercado Pago ya la tiene autorizada y todavía no nos llegó el aviso, la ponemos al día.
    await aplicarEstadoDeSuscripcion(mp);
    revalidarPlan(institucion.id);
    if (mp.estado === "authorized") return ok({ url: null });
    if (!mp.enlaceDeAutorizacion) return fallo(FALLO_DE_MERCADO_PAGO);
    return ok({ url: mp.enlaceDeAutorizacion });
  } catch (e) {
    console.error("No se pudo consultar la suscripción de Mercado Pago", resumenDeError(e));
    return fallo(FALLO_DE_MERCADO_PAGO);
  }
}

/**
 * Cancela el débito automático: Mercado Pago deja de cobrar. La regla (primero allá, y solo si salió bien se anota acá) vive en
 * `cancelarSuscripcion`, que también usa la baja de una institución.
 */
export async function cancelarDebitoAutomatico(): Promise<Resultado> {
  const { usuario, institucion } = await requerirInstitucion();
  if (!mercadoPagoActivo()) return fallo(NO_DISPONIBLE);
  if (!puedeGestionarPlan(await rolEnInstitucion(institucion, usuario.id))) return fallo(SOLO_GESTORES);

  const resultado = await cancelarSuscripcion(institucion.id, { usuarioId: usuario.id, motivo: "institucion" });
  if (!resultado.ok) return fallo(resultado.error);
  if (!resultado.habiaVigente) return fallo("No tenés un débito automático para cancelar.");
  revalidarPlan(institucion.id);
  return ok();
}
