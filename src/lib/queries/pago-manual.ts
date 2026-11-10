import "server-only";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { habilitacionesPagoManual } from "@/db/schema";
import { resumenDeError } from "@/lib/errores";
import { formaDeCobroDe, resumenParaElEquipo, type FormaDeCobro } from "@/lib/pago-manual";
import { acuerdoDe } from "@/lib/queries/acuerdos";
import { debitoDisponiblePara } from "@/lib/queries/mercadopago-modo";
import { planes } from "@/lib/queries/planes";

/*
 * Cómo paga una institución (reglas y textos en src/lib/pago-manual.ts): con Mercado Pago, salvo que el equipo la haya habilitado a pagar por
 * transferencia o efectivo. No se guarda el resultado: se calcula al mirar, así que habilitarla (o prender Mercado Pago) se nota enseguida.
 */

type DeLaInstitucion = { id: string; esDemo: boolean; plan: string };

/**
 * ¿El equipo habilitó a esta institución a pagar por transferencia o efectivo? Si la tabla todavía no existe (la migración `pnpm db:pago-manual` se
 * corre antes de desplegar, pero por si acaso) o falla la lectura, responde que no y lo deja en el log: nunca rompe la pantalla.
 */
export async function habilitadaParaPagoManual(institucionId: string): Promise<boolean> {
  try {
    const [fila] = await getDb()
      .select({ id: habilitacionesPagoManual.institucionId })
      .from(habilitacionesPagoManual)
      .where(eq(habilitacionesPagoManual.institucionId, institucionId))
      .limit(1);
    return Boolean(fila);
  } catch (e) {
    console.error("[pago-manual] no se pudo leer la habilitación", resumenDeError(e));
    return false;
  }
}

const calcular = cache(async (id: string, esDemo: boolean, plan: string): Promise<FormaDeCobro> => {
  // Sin Mercado Pago disponible para ella no hay nada que decidir: paga como siempre (y no se lee la tabla).
  if (!(await debitoDisponiblePara({ esDemo }))) return "manual";
  const P = await planes();
  // Solo un plan por sede (Multisede) necesita un convenio para tener un monto que cobrar.
  const precioDefinido = P.planDe(plan).porSede ? P.precioDefinido(plan, await acuerdoDe(getDb(), id)) : true;
  return formaDeCobroDe({
    habilitadaManual: await habilitadaParaPagoManual(id),
    mercadoPagoDisponible: true,
    precioDefinido,
  });
});

/** Cómo paga esta institución hoy (una lectura por pedido). */
export const formaDePagoDeCobro = (institucion: DeLaInstitucion): Promise<FormaDeCobro> => calcular(institucion.id, institucion.esDemo, institucion.plan);

/** Lo que muestra la tarjeta «Forma de pago» de la ficha del equipo: si está habilitada y qué significa hoy. */
export async function formaDePagoParaElEquipo(institucion: DeLaInstitucion): Promise<{ habilitada: boolean; forma: FormaDeCobro; resumen: string }> {
  const [habilitada, forma] = await Promise.all([habilitadaParaPagoManual(institucion.id), formaDePagoDeCobro(institucion)]);
  return { habilitada, forma, resumen: resumenParaElEquipo(forma, habilitada) };
}
