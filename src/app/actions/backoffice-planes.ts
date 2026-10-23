"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { transaccion } from "@/db";
import { planes, planesCondiciones } from "@/db/schema";
import { fallo, ok, type Resultado } from "@/lib/acciones";
import { registrarAuditoria } from "@/lib/auditoria";
import { requerirUsuario } from "@/lib/auth";
import {
  cambiosDePlanes,
  camposDeErrorDePlanes,
  CLAVES_PLAN,
  CONDICIONES_POR_DEFECTO,
  edicionDePlanesSchema,
  edicionDesdeCatalogo,
  huellaDePlanes,
} from "@/lib/planes";
import { ACCION_EDITAR_PLANES, leerCatalogoDePlanes } from "@/lib/queries/planes";

/*
 * Planes y aranceles editables por el equipo. Lo que se guarda rige desde ya para todo lo que se muestre o se calcule después
 * (página pública, planes de las instituciones, facturas que se creen): las facturas ya emitidas no cambian, guardan su monto.
 */

const SE_CAMBIO_MIENTRAS_TANTO = "Otra persona del equipo cambió los planes mientras los editabas. Recargá la página para ver lo último y volvé a hacer tus cambios.";

/**
 * Guarda los seis planes y sus condiciones. `base` es la huella de lo que se estaba viendo (`huellaDePlanes`): si lo guardado
 * ya es otra cosa, no se pisa. Si no cambió nada, no se escribe ni se anota nada.
 */
export async function guardarPlanes(entrada: unknown, base: string): Promise<Resultado<{ cambios: number }>> {
  const admin = await requerirUsuario("admin");
  const r = edicionDePlanesSchema.safeParse(entrada);
  if (!r.success) return fallo("Revisá los campos marcados.", camposDeErrorDePlanes(r.error));
  const nueva = r.data;

  const resultado = await transaccion(async (tx) => {
    // La fila de condiciones es el candado: dos ediciones a la vez se turnan, y la segunda ve lo que dejó la primera
    // (y, si no es lo que estaba mirando, no la pisa). Si por algo faltaba, se crea con los valores de lanzamiento.
    const inicial = CONDICIONES_POR_DEFECTO;
    await tx
      .insert(planesCondiciones)
      .values({ id: 1, sedesMultisede: inicial.sedesMultisede, descuentoSedeExtra: inicial.descuentoSedeExtra, packMeses: inicial.pack.meses, packMesesPagos: inicial.pack.mesesQueSePagan, packMesesReferido: inicial.pack.mesesConReferido, tiposColegio: inicial.tiposColegio })
      .onConflictDoNothing();
    await tx.select({ id: planesCondiciones.id }).from(planesCondiciones).where(eq(planesCondiciones.id, 1)).for("update");
    const actual = edicionDesdeCatalogo(await leerCatalogoDePlanes(tx));
    if (huellaDePlanes(actual) !== base) return fallo(SE_CAMBIO_MIENTRAS_TANTO);

    const cambios = cambiosDePlanes(actual, nueva);
    if (cambios.length === 0) return ok({ cambios: 0 });

    for (const clave of CLAVES_PLAN) {
      const p = nueva.planes[clave];
      await tx
        .insert(planes)
        .values({ clave, etiqueta: p.etiqueta, precio: p.precio, precioMinimo: p.precioMinimo, resumen: p.resumen, detalle: p.detalle, vigente: p.vigente })
        .onConflictDoUpdate({
          target: planes.clave,
          set: {
            etiqueta: p.etiqueta,
            precio: p.precio,
            precioMinimo: p.precioMinimo,
            resumen: p.resumen,
            detalle: p.detalle,
            vigente: p.vigente,
            actualizadoEn: new Date(),
          },
        });
    }
    const c = nueva.condiciones;
    await tx
      .update(planesCondiciones)
      .set({
        sedesMultisede: c.sedesMultisede,
        descuentoSedeExtra: c.descuentoSedeExtra,
        packMeses: c.pack.meses,
        packMesesPagos: c.pack.mesesQueSePagan,
        packMesesReferido: c.pack.mesesConReferido,
        tiposColegio: c.tiposColegio,
        actualizadoEn: new Date(),
      });

    await registrarAuditoria(
      { usuarioId: admin.id, accion: ACCION_EDITAR_PLANES, entidad: "planes", entidadId: "catalogo", detalle: { cambios } },
      tx,
    );
    return ok({ cambios: cambios.length });
  });

  if (resultado.ok) {
    // Todo lo que muestra o calcula con los planes: la página pública, las del equipo y las de cada institución.
    revalidatePath("/", "layout");
  }
  return resultado;
}
