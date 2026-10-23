"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { fallo, ok, type Resultado } from "@/lib/acciones";
import { registrarAuditoria } from "@/lib/auditoria";
import { requerirInstitucion } from "@/lib/auth";
import { origenDeLosMails } from "@/lib/correo/config";
import { etiquetaPeriodo, hoyAR } from "@/lib/cobros";
import { decidirActivacion, esPlanDebitable, montoCobrable } from "@/lib/debito-automatico";
import { fechaLarga } from "@/lib/fechas-curso";
import { resumenDeError } from "@/lib/errores";
import { diferirPrimerCobroActivo, mercadoPagoActivo } from "@/lib/mercadopago-config";
import { acuerdoDe } from "@/lib/queries/acuerdos";
import { debitoDisponiblePara } from "@/lib/queries/mercadopago-modo";
import { buscarSuscripcionesDelPlanMp, ErrorDeMercadoPago } from "@/lib/mercadopago-cliente";
import { DEMASIADOS_PEDIDOS, permitirActivarDebito } from "@/lib/pedidos";
import { puedeGestionarPlan, rolEnInstitucion } from "@/lib/queries/plan";
import { planes } from "@/lib/queries/planes";
import { cantidadDeSedes } from "@/lib/queries/sedes";
import { suscripcionDe } from "@/lib/queries/suscripcion";
import { cancelarSuscripcion } from "@/lib/queries/suscripcion-cancelar";
import { procesarSuscripcionDeMp } from "@/lib/queries/suscripcion-estado";
import { estadoDePago, planesDe, planParaSuscribirse } from "@/lib/queries/suscripcion-planes";

/*
 * Débito automático con Mercado Pago, del lado de la institución (ver CLAUDE.md, "Mercado Pago"). Las tres acciones exigen que la cuenta sea
 * dueña o administradora, y NUNCA reciben un monto ni un plan del navegador: el monto sale del catálogo y de las sedes de la institución.
 * Nunca se manejan datos de tarjeta: la persona los carga en Mercado Pago.
 */

const SOLO_GESTORES = "Solo el dueño y los administradores del equipo pueden manejar el débito automático.";
const NO_DISPONIBLE = "El débito automático todavía no está disponible. Escribinos por Contacto y lo resolvemos.";
const FALLO_DE_MERCADO_PAGO = "No pudimos comunicarnos con Mercado Pago. Probá de nuevo en un rato.";
/** Un número de recurso de Mercado Pago: letras, números, guion y guion bajo. Nada más viaja a su API. */
const ID_VALIDO = /^[0-9A-Za-z_-]{1,64}$/;

const revalidarPlan = (institucionId: string) => {
  revalidatePath("/institucion/plan");
  revalidatePath(`/backoffice/cobros/${institucionId}`);
  revalidatePath(`/backoffice/instituciones/${institucionId}`);
};

/**
 * Devuelve la dirección de Mercado Pago donde la persona inicia sesión, carga su tarjeta y se suscribe al plan mensual de su institución.
 * No se pide ningún mail: la suscripción la crea Mercado Pago con la cuenta con la que entre (con un mail fijado por nosotros exigiría
 * entrar con ese mail exacto). Hasta que se suscriba no se cobra nada; cuando lo haga, el aviso de Mercado Pago (o la vuelta a esta
 * pantalla) la ata a la institución por el plan.
 */
export async function activarDebitoAutomatico(): Promise<Resultado<{ url: string | null }>> {
  const { usuario, institucion } = await requerirInstitucion();
  if (!mercadoPagoActivo()) return fallo(NO_DISPONIBLE);
  // Con un token de prueba, una institución real no puede suscribirse: el cobro no sería real (ver `debitoDisponiblePara`).
  if (!(await debitoDisponiblePara(institucion))) return fallo(NO_DISPONIBLE);
  if (!permitirActivarDebito(usuario.id)) return fallo(DEMASIADOS_PEDIDOS);
  if (!puedeGestionarPlan(await rolEnInstitucion(institucion, usuario.id))) return fallo(SOLO_GESTORES);
  if (!esPlanDebitable(institucion.plan)) return fallo("Tu plan es de búsqueda puntual: se paga cada búsqueda y no tiene débito automático.");

  const existente = await suscripcionDe(institucion.id);
  if (existente && (existente.estado === "autorizada" || existente.estado === "pausada")) return fallo("Ya tenés el débito automático activado.");

  const P = await planes();
  const sedes = (await cantidadDeSedes(getDb(), [institucion.id])).get(institucion.id) ?? 1;
  const monto = P.montoDePlan(institucion.plan, sedes, await acuerdoDe(getDb(), institucion.id));
  if (!montoCobrable(monto)) return fallo("No pudimos calcular el monto de tu plan. Escribinos por Contacto.");

  // Mercado Pago cobra el primer mes al suscribirse: si el mes en curso ya está pago, activarlo ahora lo cobraría dos veces. Según el interruptor,
  // el plan lleva una prueba hasta el próximo día de cobro o la institución espera al mes que viene (ver `decidirActivacion`). Si el mes no está
  // pago, el primer cobro sale enseguida y lo paga.
  const pago = await estadoDePago(institucion.id);
  const decision = decidirActivacion({
    hoy: hoyAR(),
    diaDeCobro: institucion.diaCobro,
    mesActualPago: pago.mesActualPago,
    pagoHasta: pago.pagoHasta,
    diferirActivo: diferirPrimerCobroActivo(),
    esDemo: institucion.esDemo,
  });
  if (decision.accion === "esperar") {
    return fallo(
      decision.hasta
        ? `Tu semestre está pago hasta ${etiquetaPeriodo(decision.hasta).toLowerCase()}: para no cobrarte dos veces, podés activar el débito automático desde el ${fechaLarga(decision.desde)}.`
        : `Este mes ya figura pago: para no cobrarte dos veces, podés activar el débito automático desde el ${fechaLarga(decision.desde)}.`,
    );
  }
  const diasDePrueba = decision.accion === "con-prueba" ? decision.dias : 0;

  try {
    const { plan, creado } = await planParaSuscribirse({
      institucionId: institucion.id,
      institucion: institucion.nombre,
      clavePlan: institucion.plan,
      planLabel: P.planDe(institucion.plan).label,
      monto,
      diasDePrueba,
      // Sin parámetros propios: Mercado Pago le agrega los suyos al volver (`preapproval_id`).
      volverA: `${origenDeLosMails()}/institucion/plan`,
    });
    if (!plan.enlace) return fallo(FALLO_DE_MERCADO_PAGO);

    if (creado) {
      await registrarAuditoria({
        usuarioId: usuario.id,
        accion: "suscripcion.crear",
        entidad: "institucion",
        entidadId: institucion.id,
        detalle: { plan: institucion.plan, monto, sedes, diasDePrueba },
      });
    }
    revalidarPlan(institucion.id);
    return ok({ url: plan.enlace });
  } catch (e) {
    console.error("No se pudo preparar el plan de Mercado Pago", resumenDeError(e));
    if (e instanceof ErrorDeMercadoPago && e.tipo === "rechazado") {
      return fallo("Mercado Pago no aceptó el pedido. Probá de nuevo en un rato o escribinos por Contacto.");
    }
    return fallo(FALLO_DE_MERCADO_PAGO);
  }
}

/**
 * Confirma una suscripción que acaba de nacer (o cuyo aviso todavía no llegó): le pregunta a Mercado Pago y pone al día lo que haya. La
 * pantalla la llama al volver de Mercado Pago y mientras espera. Busca por los planes de la institución, nunca por un número que venga del
 * navegador; el `preapproval_id` que Mercado Pago agrega al volver solo se usa si su plan es de ESTA institución. Devuelve si el débito ya
 * quedó activo (autorizado).
 */
export async function confirmarDebitoAutomatico(suscripcionId?: string): Promise<Resultado<{ activo: boolean }>> {
  const { usuario, institucion } = await requerirInstitucion();
  if (!mercadoPagoActivo()) return fallo(NO_DISPONIBLE);
  if (!puedeGestionarPlan(await rolEnInstitucion(institucion, usuario.id))) return fallo(SOLO_GESTORES);

  try {
    // El número que trae la dirección de vuelta: primero, y solo si es de esta institución.
    if (typeof suscripcionId === "string" && ID_VALIDO.test(suscripcionId)) {
      try {
        await procesarSuscripcionDeMp(suscripcionId, { deInstitucion: institucion.id });
      } catch (e) {
        // Un número que Mercado Pago no conoce (la dirección se puede editar a mano) no es un error: se sigue con los planes de la institución.
        if (!(e instanceof ErrorDeMercadoPago && e.tipo === "no-existe")) throw e;
      }
    }
    // Y lo que Mercado Pago tenga en los planes de la institución (cubre que la dirección no traiga el número o el aviso no llegue).
    const yaActiva = (await suscripcionDe(institucion.id))?.estado === "autorizada";
    if (!yaActiva) {
      for (const plan of await planesDe(institucion.id, 3)) {
        for (const id of await buscarSuscripcionesDelPlanMp(plan.mpPlanId)) await procesarSuscripcionDeMp(id, { deInstitucion: institucion.id });
      }
    }
    revalidarPlan(institucion.id);
    return ok({ activo: (await suscripcionDe(institucion.id))?.estado === "autorizada" });
  } catch (e) {
    console.error("No se pudo confirmar la suscripción de Mercado Pago", resumenDeError(e));
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
