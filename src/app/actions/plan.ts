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
import { hoyAR } from "@/lib/cobros";
import { avisoAlEquipoDeSemestre, esFormaDePago, puedePagarSemestre, resumenDeSemestre } from "@/lib/forma-de-pago";
import { CLAVES_PLAN, esClavePlan, pesos } from "@/lib/planes";
import { acuerdoDe } from "@/lib/queries/acuerdos";
import { guardarFormaDePago } from "@/lib/queries/forma-de-pago";
import { planes } from "@/lib/queries/planes";
import { avisarAAdmins, avisarAVarios } from "@/lib/queries/avisos";
import { puedeGestionarPlan, rolEnInstitucion, solicitudPendiente } from "@/lib/queries/plan";
import { cantidadDeSedes } from "@/lib/queries/sedes";
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
    // Solo se pide un plan que le corresponde (el arancel de su tipo, Multisede con sedes para una red): lo que la
    // pantalla ofrece lo vuelve a exigir el servidor, que no le cree al navegador.
    const sedes = (await cantidadDeSedes(tx, [institucion.id])).get(institucion.id) ?? 1;
    if (!P.planesParaPedir(institucion.tipo, sedes, vigente.plan).includes(destino.data)) {
      return fallo("Ese plan no corresponde a tu institución. Si necesitás otro, escribinos desde Contacto.");
    }
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

/**
 * La institución elige cómo paga el abono: el semestre por adelantado (pagás 5, usás 6) o mes a mes. Solo el dueño y los administradores. Es una
 * preferencia: no cobra nada ni cambia el plan; cuando elige el semestre se le avisa al equipo en la campanita para que coordine el pago y lo registre
 * (ver «Semestre al contado» en CLAUDE.md). Solo vale con un abono mensual: la búsqueda puntual y Multisede no tienen un semestre de lista.
 */
export async function elegirFormaDePago(forma: string): Promise<Resultado> {
  const { usuario, institucion } = await requerirInstitucion();
  if (!permitirPedidoAlEquipo(usuario.id)) return fallo(DEMASIADOS_PEDIDOS);
  if (!esFormaDePago(forma)) return fallo("Esa forma de pago no existe.");
  const P = await planes();

  const resultado = await transaccion(async (tx) => {
    const [vigente] = await tx.select({ plan: instituciones.plan }).from(instituciones).where(eq(instituciones.id, institucion.id)).for("update");
    if (!vigente) return fallo("No encontramos tu institución.");
    if (!puedeGestionarPlan(await rolEnInstitucion(institucion, usuario.id, tx))) return fallo(SOLO_ADMINISTRADORES);
    if (forma === "semestral" && !puedePagarSemestre(P, vigente.plan)) {
      return fallo("El pago por semestre es para los planes con abono. Si lo necesitás, escribinos desde Contacto.");
    }

    const cambio = await guardarFormaDePago(tx, institucion.id, forma);
    if (cambio && forma === "semestral" && esClavePlan(vigente.plan)) {
      const sedes = (await cantidadDeSedes(tx, [institucion.id])).get(institucion.id) ?? 1;
      const r = resumenDeSemestre(P, vigente.plan, sedes, await acuerdoDe(tx, institucion.id));
      await avisarAAdmins(tx, {
        titulo: institucion.nombre,
        texto: avisoAlEquipoDeSemestre({ alCrearLaCuenta: false, total: r.total, meses: r.meses }),
        enlace: `/backoffice/cobros/${institucion.id}`,
      });
      // Además de la campanita, un mail al equipo (uno por institución y por día: elegir y deshacer en un bucle no lo repite).
      await encolarParaEquipo(
        tx,
        "M67",
        { institucion: institucion.nombre, total: pesos(r.total), meses: r.meses, alCrearLaCuenta: false, ruta: `/backoffice/cobros/${institucion.id}` },
        { clave: `M67:${institucion.id}:${hoyAR()}` },
      );
    }
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
