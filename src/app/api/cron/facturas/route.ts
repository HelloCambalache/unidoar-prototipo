import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { transaccion } from "@/db";
import { cronAutorizado } from "@/lib/cron";
import { generarFacturasDelPeriodo } from "@/lib/queries/backoffice-cobros";
import { sincronizarSuscripciones } from "@/lib/queries/suscripcion-sincronizar";
import { resumenDeError } from "@/lib/errores";

// Se evalúa en cada pedido: crea facturas, no es algo cacheable.
export const dynamic = "force-dynamic";

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
    // Los montos de las suscripciones de débito automático siguen al plan y a las sedes (nunca lanza: si falla, queda en el log).
    const suscripciones = await sincronizarSuscripciones();
    console.info("Facturas automáticas", { periodo: resultado.periodo, creadas: resultado.creadas.length, omitidas: resultado.omitidas, suscripciones });
    return NextResponse.json(
      { periodo: resultado.periodo, creadas: resultado.creadas.length, omitidas: resultado.omitidas, sinFacturaPrevia: resultado.sinFacturaPrevia, suscripciones },
      { headers: SIN_CACHE },
    );
  } catch (e) {
    console.error("No se pudieron generar las facturas del período", resumenDeError(e));
    return NextResponse.json({ error: "No se pudieron generar las facturas" }, { status: 500, headers: SIN_CACHE });
  }
}
