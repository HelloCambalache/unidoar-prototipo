"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { transaccion } from "@/db";
import { instituciones, solicitudesPlan, usuarios } from "@/db/schema";
import { fallo, ok, type Resultado } from "@/lib/acciones";
import { requerirInstitucion } from "@/lib/auth";
import { esUuid } from "@/lib/busquedas";
import { encolarParaEquipo } from "@/lib/correo/cola";
import { correoDePedidoDePlanRecibido } from "@/lib/correo/eventos";
import { CLAVES_PLAN } from "@/lib/planes";
import { planes } from "@/lib/queries/planes";
import { avisarAVarios } from "@/lib/queries/avisos";
import { puedeGestionarPlan, rolEnInstitucion, solicitudPendiente } from "@/lib/queries/plan";
import { DEMASIADOS_PEDIDOS, permitirPedidoAlEquipo } from "@/lib/pedidos";

/*
 * Todavía no hay pasarela de pago (se integra Mercado Pago más adelante): pedir un cambio de plan NO
 * cobra ni modifica `instituciones.plan`. Deja un pedido pendiente que atiende el backoffice (Cobros).
 */

const SOLO_ADMINISTRADORES = "Solo el dueño y los administradores del equipo pueden pedir cambios de plan.";

const planSchema = z.enum(CLAVES_PLAN, { error: "Ese plan no existe." });

const revalidarPlan = () => revalidatePath("/institucion/plan");

/**
 * Pide pasar a otro plan. Una sola solicitud pendiente por institución: la fila de la institución se
 * bloquea durante la transacción para que dos pedidos simultáneos no dejen dos pendientes. Avisa con una
 * notificación a todas las cuentas admin.
 */
export async function solicitarCambioPlan(plan: string): Promise<Resultado> {
  const { usuario, institucion } = await requerirInstitucion();
  if (!permitirPedidoAlEquipo(usuario.id)) return fallo(DEMASIADOS_PEDIDOS);
  const destino = planSchema.safeParse(plan);
  if (!destino.success) return fallo("Ese plan no existe.");
  const P = await planes();

  const resultado = await transaccion(async (tx) => {
    const [vigente] = await tx
      .select({ plan: instituciones.plan })
      .from(instituciones)
      .where(eq(instituciones.id, institucion.id))
      .for("update");
    if (!vigente) return fallo("No encontramos tu institución.");

    if (!puedeGestionarPlan(await rolEnInstitucion(institucion, usuario.id, tx))) return fallo(SOLO_ADMINISTRADORES);
    if (vigente.plan === destino.data) return fallo(`Ya estás en el ${P.planDe(vigente.plan).label}.`);
    if (await solicitudPendiente(institucion.id, tx)) {
      return fallo("Ya tenés un pedido de cambio pendiente. Cancelalo si querés pedir otro plan.");
    }

    await tx
      .insert(solicitudesPlan)
      .values({ institucionId: institucion.id, planActual: vigente.plan, planSolicitado: destino.data });

    const admins = await tx.select({ id: usuarios.id }).from(usuarios).where(eq(usuarios.rol, "admin"));
    await avisarAVarios(
      tx,
      admins.map((a) => a.id),
      {
        tipo: "sistema",
        titulo: institucion.nombre,
        texto: `pidió pasar del ${P.planDe(vigente.plan).label} al ${P.planDe(destino.data).label}.`,
        enlace: "/backoffice/cobros",
      },
    );
    await encolarParaEquipo(tx, "M63", { institucion: institucion.nombre, plan: P.nombreDePlan(destino.data), ruta: "/backoffice/cobros" });
    // Quien lo pidió recibe la constancia de que lo recibimos.
    await correoDePedidoDePlanRecibido(tx, { usuarioId: usuario.id, institucion: institucion.nombre, plan: P.nombreDePlan(destino.data) });
    return ok();
  });

  if (resultado.ok) revalidarPlan();
  return resultado;
}

/** Cancela el pedido pendiente de la institución (la fila se borra: el equipo ya no lo ve en su cola). */
export async function cancelarSolicitudPlan(solicitudId: string): Promise<Resultado> {
  const { usuario, institucion } = await requerirInstitucion();
  if (!permitirPedidoAlEquipo(usuario.id)) return fallo(DEMASIADOS_PEDIDOS);
  if (!esUuid(solicitudId)) return fallo("No encontramos ese pedido.");

  const resultado = await transaccion(async (tx) => {
    if (!puedeGestionarPlan(await rolEnInstitucion(institucion, usuario.id, tx))) return fallo(SOLO_ADMINISTRADORES);
    const borradas = await tx
      .delete(solicitudesPlan)
      .where(
        and(
          eq(solicitudesPlan.id, solicitudId),
          eq(solicitudesPlan.institucionId, institucion.id),
          eq(solicitudesPlan.estado, "pendiente"),
        ),
      )
      .returning({ id: solicitudesPlan.id });
    // Si el equipo lo atendió mientras tanto, ya no es un pedido que se pueda cancelar.
    if (borradas.length === 0) return fallo("Ese pedido ya no está pendiente.");
    return ok();
  });

  // También si falló: la pantalla puede estar mostrando un pedido que ya se atendió.
  revalidarPlan();
  return resultado;
}
