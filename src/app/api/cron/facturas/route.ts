import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { transaccion } from "@/db";
import { cronAutorizado } from "@/lib/cron";
import { generarFacturasDelPeriodo } from "@/lib/queries/backoffice-cobros";
import { cerrarPuntualesVencidas } from "@/lib/queries/puntuales";
import { reconciliarSuscripciones } from "@/lib/queries/suscripcion-reconciliar";
import { sincronizarSuscripciones } from "@/lib/queries/suscripcion-sincronizar";
import { resumenDeError } from "@/lib/errores";

// Se evalúa en cada pedido: crea facturas, no es algo cacheable.
export const dynamic = "force-dynamic";
// La revisión de las suscripciones hace llamadas a Mercado Pago (dos por suscripción viva): el tiempo crece con la cantidad.
export const maxDuration = 300;

const SIN_CACHE = { "Cache-Control": "no-store" };

/**
 * Corre un paso del cron sin que su falla frene a los demás: si lanza, lo anota (sin datos de la base) y sigue. Así un día en que, por ejemplo, no se
 * pueden leer los precios y no se crean las facturas, igual se cierran las búsquedas puntuales vencidas y se revisa Mercado Pago.
 */
async function paso<T>(nombre: string, fallidos: string[], fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (e) {
    console.error(`Falló un paso del cron diario de facturas: ${nombre}`, resumenDeError(e));
    fallidos.push(nombre);
    return null;
  }
}

/**
 * Tareas diarias de cobros: cierra las búsquedas puntuales vencidas, crea las facturas del mes en curso (ver `generarFacturasDelPeriodo`) y revisa el
 * débito automático. Corre todos los días: es idempotente, así que un día que falla se recupera al siguiente y los días sin nada que hacer no tocan
 * la base. Cada paso va por separado (`paso`): lo que falla se reintenta mañana sin frenar lo demás, y el pedido responde error si algo falló, para que
 * se note. Se programa en vercel.json.
 */
export async function GET(request: Request) {
  if (!cronAutorizado(request)) return NextResponse.json({ error: "No autorizado" }, { status: 401, headers: SIN_CACHE });

  const fallidos: string[] = [];

  // 1. Las búsquedas puntuales que ya cumplieron su plazo se cierran solas: lo primero porque solo toca la base y es lo más barato (nunca lanza,
  // pero se envuelve igual).
  const puntuales = await paso("cerrar-puntuales", fallidos, () => cerrarPuntualesVencidas());
  if (puntuales && puntuales.cerradas > 0) {
    revalidatePath("/institucion/busquedas");
    revalidatePath("/institucion/dashboard");
    revalidatePath("/institucion/plan");
    revalidatePath("/docente/oportunidades");
    revalidatePath("/docente/dashboard");
  }

  // 2. Las facturas del mes. Con los precios vigentes o nada: si no se pueden leer, este paso falla y se reintenta mañana.
  const resultado = await paso("facturas", fallidos, () => transaccion((tx) => generarFacturasDelPeriodo(tx)));
  if (resultado) {
    if (resultado.creadas.length > 0) {
      revalidatePath("/backoffice/cobros");
      revalidatePath("/backoffice/instituciones");
      revalidatePath("/institucion/plan");
      for (const { institucionId } of resultado.creadas) {
        revalidatePath(`/backoffice/cobros/${institucionId}`);
        revalidatePath(`/backoffice/cobros/${institucionId}/resumen`);
        revalidatePath(`/backoffice/instituciones/${institucionId}`);
      }
    }
    // Los meses bonificados por recomendar que se gastaron hoy: la institución los ve en Plan y facturación y en Referidos.
    for (const institucionId of resultado.bonificadas) {
      revalidatePath("/institucion/plan");
      revalidatePath("/institucion/referidos");
      revalidatePath(`/backoffice/cobros/${institucionId}`);
    }
  }

  // 3. Débito automático (llaman a Mercado Pago). Primero se pone al día lo que Mercado Pago cobró o cambió sin que llegara el aviso, y después
  // los montos siguen al plan y a las sedes.
  const reconciliacion = await paso("reconciliar-suscripciones", fallidos, () => reconciliarSuscripciones());
  const suscripciones = await paso("sincronizar-suscripciones", fallidos, () => sincronizarSuscripciones());

  const bonificadas = resultado?.bonificadas.length ?? 0;
  console.info("Facturas automáticas", {
    periodo: resultado?.periodo,
    creadas: resultado?.creadas.length,
    bonificadas,
    omitidas: resultado?.omitidas,
    reconciliacion,
    suscripciones,
    puntuales,
    fallidos,
  });
  return NextResponse.json(
    {
      periodo: resultado?.periodo ?? null,
      creadas: resultado?.creadas.length ?? null,
      bonificadas: resultado ? bonificadas : null,
      omitidas: resultado?.omitidas ?? null,
      sinFacturaPrevia: resultado?.sinFacturaPrevia ?? null,
      reconciliacion,
      suscripciones,
      puntuales,
      ...(fallidos.length > 0 ? { fallidos } : {}),
    },
    // Con un paso caído responde error: Vercel lo marca y se nota, pero todo lo demás ya corrió.
    { status: fallidos.length > 0 ? 500 : 200, headers: SIN_CACHE },
  );
}
