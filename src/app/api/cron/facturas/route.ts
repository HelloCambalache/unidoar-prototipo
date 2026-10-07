import { timingSafeEqual } from "node:crypto";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { transaccion } from "@/db";
import { generarFacturasDelPeriodo } from "@/lib/queries/backoffice-cobros";

// Se evalúa en cada pedido: crea facturas, no es algo cacheable.
export const dynamic = "force-dynamic";

const SIN_CACHE = { "Cache-Control": "no-store" };

/** Vercel Cron manda `Authorization: Bearer <CRON_SECRET>`. Sin el secreto configurado no se acepta nada. */
function autorizado(request: Request) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || secreto.length < 16) return false;
  const recibido = Buffer.from(request.headers.get("authorization") ?? "");
  const esperado = Buffer.from(`Bearer ${secreto}`);
  return recibido.length === esperado.length && timingSafeEqual(recibido, esperado);
}

/**
 * Crea las facturas del mes en curso (ver `generarFacturasDelPeriodo`). Corre todos los días: es idempotente, así que
 * un día que falla se recupera al siguiente y los días sin nada que crear no tocan la base. Se programa en vercel.json.
 */
export async function GET(request: Request) {
  if (!autorizado(request)) return NextResponse.json({ error: "No autorizado" }, { status: 401, headers: SIN_CACHE });

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
    console.info("Facturas automáticas", { periodo: resultado.periodo, creadas: resultado.creadas.length, omitidas: resultado.omitidas });
    return NextResponse.json(
      { periodo: resultado.periodo, creadas: resultado.creadas.length, omitidas: resultado.omitidas, sinFacturaPrevia: resultado.sinFacturaPrevia },
      { headers: SIN_CACHE },
    );
  } catch (e) {
    console.error("No se pudieron generar las facturas del período", e);
    return NextResponse.json({ error: "No se pudieron generar las facturas" }, { status: 500, headers: SIN_CACHE });
  }
}
