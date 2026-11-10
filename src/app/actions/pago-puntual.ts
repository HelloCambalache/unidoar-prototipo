"use server";

import { revalidatePath } from "next/cache";
import { fallo, ok, type Resultado } from "@/lib/acciones";
import { requerirInstitucion } from "@/lib/auth";
import { mercadoPagoActivo } from "@/lib/mercadopago-config";
import { DEMASIADOS_PEDIDOS, permitirConfirmarPuntual, permitirLinkDePuntual } from "@/lib/pedidos";
import { pagoPorMercadoPagoDisponiblePara } from "@/lib/queries/mercadopago-modo";
import { confirmarPagoDePuntual, prepararPagoDePuntual, type EstadoDeLaConfirmacionPuntual } from "@/lib/queries/pago-puntual";
import { puedeGestionarPlan, rolEnInstitucion } from "@/lib/queries/plan";

/*
 * El pago de una búsqueda puntual por Mercado Pago, del lado de la institución (ver «Pago de una búsqueda puntual por Mercado Pago» en CLAUDE.md). Las
 * acciones exigen que la cuenta sea dueña o administradora y NUNCA reciben un monto ni un plan del navegador: el precio sale del catálogo y del acuerdo de
 * la institución. Nunca se manejan datos de tarjeta: la persona los carga en Mercado Pago.
 */

const SOLO_GESTORES = "Solo el dueño y los administradores del equipo pueden pagar el plan.";
const NO_DISPONIBLE = "El pago por Mercado Pago todavía no está disponible. Escribinos desde Contacto y coordinamos el pago de tu búsqueda.";

/**
 * Arma el link de pago de una búsqueda puntual y devuelve la dirección de Mercado Pago a la que hay que mandar a la persona (no se cobra nada hasta que
 * pague ahí). El link vigente por el mismo monto se reutiliza.
 */
export async function iniciarPagoDeBusquedaPuntual(): Promise<Resultado<{ url: string }>> {
  const { usuario, institucion } = await requerirInstitucion();
  if (!mercadoPagoActivo()) return fallo(NO_DISPONIBLE);
  // Con un token de prueba y la protección prendida, una institución real no puede pagar: el cobro no sería real.
  if (!(await pagoPorMercadoPagoDisponiblePara(institucion))) return fallo(NO_DISPONIBLE);
  if (!permitirLinkDePuntual(usuario.id)) return fallo(DEMASIADOS_PEDIDOS);
  if (!puedeGestionarPlan(await rolEnInstitucion(institucion, usuario.id))) return fallo(SOLO_GESTORES);

  const r = await prepararPagoDePuntual({ id: institucion.id, nombre: institucion.nombre }, usuario.id);
  return r.ok ? ok({ url: r.url }) : fallo(r.error);
}

/**
 * La persona volvió de Mercado Pago: se mira si el pago de su búsqueda ya se aprobó y, si es así, queda pagada sin esperar el aviso. Mira solo los pagos de
 * SU institución. Cualquiera del equipo puede preguntar (solo lee el estado de lo que ya se pagó).
 */
export async function confirmarPagoDeLaBusquedaPuntual(): Promise<Resultado<{ estado: EstadoDeLaConfirmacionPuntual }>> {
  const { usuario, institucion } = await requerirInstitucion();
  if (!permitirConfirmarPuntual(usuario.id)) return fallo(DEMASIADOS_PEDIDOS);
  const estado = await confirmarPagoDePuntual(institucion.id);
  if (estado === "registrado") {
    revalidatePath("/institucion/plan");
    revalidatePath("/institucion/publicar");
    revalidatePath(`/backoffice/cobros/${institucion.id}`);
    revalidatePath("/backoffice/cobros/pagos");
  }
  return ok({ estado });
}
