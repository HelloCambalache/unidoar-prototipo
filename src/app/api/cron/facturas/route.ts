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
export const maxDuration = 120;

const SIN_CACHE = { "Cache-Control": "no-store" };

/**
 * Crea las facturas del mes en curso (ver `generarFacturasDelPeriodo`). Corre todos los días: es idempotente, así que
 * un día que falla se recupera al siguiente y los días sin nada que crear no tocan la base. Se programa en vercel.json.
 */
export async function GET(request: Request) {
  if (!cronAutorizado(request)) return NextResponse.json({ error: "No autorizado" }, { status: 401, headers: SIN_CACHE });

  try {
    const resultado = await transaccion((tx) => generarFacturasDelPeriodo(tx));
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
    // Débito automático (ninguna de las dos lanza: si algo falla, queda en el log y se reintenta mañana). Primero se pone al día lo que
    // Mercado Pago cobró o cambió sin que llegara el aviso, y después los montos siguen al plan y a las sedes.
    const reconciliacion = await reconciliarSuscripciones();
    const suscripciones = await sincronizarSuscripciones();
    // Las búsquedas puntuales que ya cumplieron su plazo se cierran solas (nunca lanza: lo que falle se reintenta mañana).
    const puntuales = await cerrarPuntualesVencidas();
    if (puntuales.cerradas > 0) {
      revalidatePath("/institucion/busquedas");
      revalidatePath("/institucion/dashboard");
      revalidatePath("/institucion/plan");
      revalidatePath("/docente/oportunidades");
      revalidatePath("/docente/dashboard");
    }
    const bonificadas = resultado.bonificadas.length;
    console.info("Facturas automáticas", { periodo: resultado.periodo, creadas: resultado.creadas.length, bonificadas, omitidas: resultado.omitidas, reconciliacion, suscripciones, puntuales });
    return NextResponse.json(
      { periodo: resultado.periodo, creadas: resultado.creadas.length, bonificadas, omitidas: resultado.omitidas, sinFacturaPrevia: resultado.sinFacturaPrevia, reconciliacion, suscripciones, puntuales },
      { headers: SIN_CACHE },
    );
  } catch (e) {
    console.error("No se pudieron generar las facturas del período", resumenDeError(e));
    return NextResponse.json({ error: "No se pudieron generar las facturas" }, { status: 500, headers: SIN_CACHE });
  }
}
