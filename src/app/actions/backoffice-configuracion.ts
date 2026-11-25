"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { transaccion } from "@/db";
import { configuracionSitio } from "@/db/schema";
import { fallo, ok, type Resultado } from "@/lib/acciones";
import { registrarAuditoria } from "@/lib/auditoria";
import { requerirUsuario } from "@/lib/auth";
import { resumenDeError } from "@/lib/errores";

/*
 * Configuración del sitio público (Backoffice → Sitio, solo admin). Hoy: mostrar u ocultar las cifras de la red (profesionales e instituciones
 * verificados, búsquedas activas, disciplinas) en la portada, las tarjetas de categoría y las landings. Pedido del cliente (2026-11-25): mientras la
 * red es chica, no mostrarlas. Arranca oculto; el cambio rige en el momento (esas páginas se arman en cada visita). Queda en la actividad del equipo.
 */

const ACCION_MOSTRAR = "sitio.cifras_mostrar";
const ACCION_OCULTAR = "sitio.cifras_ocultar";

export async function cambiarCifrasDelSitio(mostrar: boolean): Promise<Resultado<{ cambio: boolean }>> {
  const admin = await requerirUsuario("admin");
  if (typeof mostrar !== "boolean") return fallo("No pudimos guardar el cambio. Probá de nuevo.");

  try {
    const resultado = await transaccion(async (tx) => {
      // Se relee con la fila bloqueada: dos personas del equipo no se pisan. Sin fila (nadie la creó todavía) vale «oculto».
      const [actual] = await tx
        .select({ mostrarCifras: configuracionSitio.mostrarCifras })
        .from(configuracionSitio)
        .where(eq(configuracionSitio.id, 1))
        .limit(1)
        .for("update");
      if ((actual?.mostrarCifras ?? false) === mostrar) return ok({ cambio: false });

      await tx
        .insert(configuracionSitio)
        .values({ id: 1, mostrarCifras: mostrar, actualizadoPor: admin.id })
        .onConflictDoUpdate({ target: configuracionSitio.id, set: { mostrarCifras: mostrar, actualizadoPor: admin.id, actualizadoEn: new Date() } });
      await registrarAuditoria({ usuarioId: admin.id, accion: mostrar ? ACCION_MOSTRAR : ACCION_OCULTAR, entidad: "sitio", entidadId: "cifras" }, tx);
      return ok({ cambio: true });
    });
    if (!resultado.ok) return resultado;
    // Todo lo público que muestra o esconde las cifras (portada, /categorias y las tres landings) y la propia pantalla.
    revalidatePath("/", "layout");
    revalidatePath("/backoffice/sitio");
    return resultado;
  } catch (e) {
    // Lo más probable: falta crear la tabla (`pnpm db:configuracion-sitio`). El detalle queda en el log, sin datos.
    console.error("[backoffice-configuracion] no se pudo guardar", resumenDeError(e));
    return fallo("No pudimos guardar el cambio. Probá de nuevo.");
  }
}
