"use server";

import { revalidatePath } from "next/cache";
import { fallo, ok, type Resultado } from "@/lib/acciones";
import { requerirInstitucion } from "@/lib/auth";
import { mercadoPagoActivo } from "@/lib/mercadopago-config";
import { pagoPorMercadoPagoDisponiblePara } from "@/lib/queries/mercadopago-modo";
import { DEMASIADOS_PEDIDOS, permitirConfirmarSemestre, permitirLinkDeSemestre } from "@/lib/pedidos";
import { confirmarPagoDeSemestre, prepararPagoDeSemestre, type EstadoDeLaConfirmacion } from "@/lib/queries/pago-semestre";
import { puedeGestionarPlan, rolEnInstitucion } from "@/lib/queries/plan";

/*
 * El pago del semestre por Mercado Pago, del lado de la institución (ver «Pago del semestre por Mercado Pago» en CLAUDE.md). Las acciones exigen que la
 * cuenta sea dueña o administradora y NUNCA reciben un monto, un plan ni un mes del navegador: todo sale del catálogo, las sedes y las facturas de la
 * institución. Nunca se manejan datos de tarjeta: la persona los carga en Mercado Pago.
 */

const SOLO_GESTORES = "Solo el dueño y los administradores del equipo pueden pagar el plan.";
const NO_DISPONIBLE = "El pago por Mercado Pago todavía no está disponible. Escribinos desde Contacto y coordinamos el pago del semestre.";

/**
 * Arma el link de pago del semestre y devuelve la dirección de Mercado Pago a la que hay que mandar a la persona (no se cobra nada hasta que pague
 * ahí). El link vigente por el mismo semestre se reutiliza.
 */
export async function iniciarPagoDeSemestre(): Promise<Resultado<{ url: string }>> {
  const { usuario, institucion } = await requerirInstitucion();
  if (!mercadoPagoActivo()) return fallo(NO_DISPONIBLE);
  // Con un token de prueba, una institución real no puede pagar: el cobro no sería real.
  if (!(await pagoPorMercadoPagoDisponiblePara(institucion))) return fallo(NO_DISPONIBLE);
  if (!permitirLinkDeSemestre(usuario.id)) return fallo(DEMASIADOS_PEDIDOS);
  if (!puedeGestionarPlan(await rolEnInstitucion(institucion, usuario.id))) return fallo(SOLO_GESTORES);

  const r = await prepararPagoDeSemestre({ id: institucion.id, nombre: institucion.nombre }, usuario.id);
  return r.ok ? ok({ url: r.url }) : fallo(r.error);
}

/**
 * La persona volvió de Mercado Pago: se mira si el pago de su semestre ya se aprobó y, si es así, se registra sin esperar el aviso. Mira solo los pagos
 * de SU institución. Cualquiera del equipo puede preguntar (solo lee el estado de lo que ya se pagó).
 */
export async function confirmarPagoDelSemestre(): Promise<Resultado<{ estado: EstadoDeLaConfirmacion }>> {
  const { usuario, institucion } = await requerirInstitucion();
  if (!permitirConfirmarSemestre(usuario.id)) return fallo(DEMASIADOS_PEDIDOS);
  const estado = await confirmarPagoDeSemestre(institucion.id);
  if (estado === "registrado") {
    revalidatePath("/institucion/plan");
    revalidatePath(`/backoffice/cobros/${institucion.id}`);
  }
  return ok({ estado });
}
