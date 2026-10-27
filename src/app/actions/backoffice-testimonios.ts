"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { transaccion } from "@/db";
import { testimonios } from "@/db/schema";
import { fallo, ok, parsear, type Resultado } from "@/lib/acciones";
import { quitados } from "@/lib/archivos";
import { registrarAuditoria } from "@/lib/auditoria";
import { requerirUsuario } from "@/lib/auth";
import { esUuid } from "@/lib/busquedas";
import { resumenDeError } from "@/lib/errores";
import { borrarArchivos } from "@/lib/queries/archivos";
import { esUrlPublicaPropia } from "@/lib/subidas";
import {
  etiquetaDePagina,
  fotoAceptada,
  hayLugarEnPagina,
  MAX_TESTIMONIOS_POR_PAGINA,
  siguienteOrden,
  testimonioSchema,
  type TestimonioNuevo,
} from "@/lib/testimonios";

/*
 * Testimonios de la portada y de las landings de categoría, que carga el equipo (Backoffice → Testimonios). Cada acción exige rol admin, relee la fila dentro
 * de la transacción y deja auditoría. Solo se muestran los visibles; ocultar no borra. La foto es opcional: se sube por /api/subir (carpeta `fotos`
 * del bucket público) y se acepta solo si es de quien guarda o si es la que ya tenía; la que se reemplaza o se elimina se borra de Storage después de guardar.
 */

const NO_ENCONTRADO = "Ese testimonio ya no existe. Recargá la página.";
const SIN_LUGAR = (pagina: string) =>
  `En ${etiquetaDePagina(pagina)} ya hay ${MAX_TESTIMONIOS_POR_PAGINA} testimonios (contando los ocultos). Eliminá alguno antes de sumar otro.`;

function revalidar() {
  revalidatePath("/backoffice/testimonios");
  // Las páginas donde se muestran (se generan en cada visita, pero así no queda nada guardado en caché).
  for (const ruta of ["/", "/educadores", "/entrenadores", "/guardavidas"]) revalidatePath(ruta);
}

/** Agrega un testimonio (`id` null) o edita uno. Si cambia de página, pasa al final de la nueva. */
export async function guardarTestimonio(id: string | null, entrada: TestimonioNuevo): Promise<Resultado<{ id: string }>> {
  const admin = await requerirUsuario("admin");
  if (id !== null && !esUuid(id)) return fallo(NO_ENCONTRADO);
  const datos = parsear(testimonioSchema, entrada);
  if (!datos.ok) return fallo(datos.error, datos.campos);
  const { pagina, cita, autor, cargo, fotoUrl } = datos.data;

  try {
    const resultado = await transaccion(async (tx) => {
      const delaPagina = await tx
        .select({ id: testimonios.id, orden: testimonios.orden })
        .from(testimonios)
        .where(eq(testimonios.pagina, pagina));

      if (id === null) {
        if (!fotoAceptada(fotoUrl, null, (u) => esUrlPublicaPropia(u, admin.id))) return fallo("Esa foto no es válida. Subila de nuevo.", { fotoUrl: "Subila de nuevo" });
        if (!hayLugarEnPagina(delaPagina.length)) return fallo(SIN_LUGAR(pagina), { pagina: "Sin lugar" });
        const [nuevo] = await tx
          .insert(testimonios)
          .values({ pagina, cita, autor, cargo, fotoUrl, orden: siguienteOrden(delaPagina.map((t) => t.orden)) })
          .returning({ id: testimonios.id });
        await registrarAuditoria(
          { usuarioId: admin.id, accion: "testimonio.crear", entidad: "testimonio", entidadId: nuevo!.id, detalle: { pagina, autor } },
          tx,
        );
        return ok({ id: nuevo!.id, fotoAnterior: null as string | null });
      }

      const [actual] = await tx.select().from(testimonios).where(eq(testimonios.id, id)).for("update");
      if (!actual) return fallo(NO_ENCONTRADO);
      if (!fotoAceptada(fotoUrl, actual.fotoUrl, (u) => esUrlPublicaPropia(u, admin.id))) return fallo("Esa foto no es válida. Subila de nuevo.", { fotoUrl: "Subila de nuevo" });

      const cambiaDePagina = actual.pagina !== pagina;
      if (cambiaDePagina && !hayLugarEnPagina(delaPagina.length)) return fallo(SIN_LUGAR(pagina), { pagina: "Sin lugar" });
      await tx
        .update(testimonios)
        .set({ pagina, cita, autor, cargo, fotoUrl, ...(cambiaDePagina ? { orden: siguienteOrden(delaPagina.map((t) => t.orden)) } : {}) })
        .where(eq(testimonios.id, id));
      await registrarAuditoria(
        {
          usuarioId: admin.id,
          accion: "testimonio.editar",
          entidad: "testimonio",
          entidadId: id,
          detalle: { pagina, autor, ...(cambiaDePagina ? { desde: actual.pagina } : {}) },
        },
        tx,
      );
      return ok({ id, fotoAnterior: actual.fotoUrl });
    });

    if (!resultado.ok) return resultado;
    revalidar();
    // Después de confirmar: si se cambió o se quitó la foto, la anterior se borra de Storage (si nadie más la usa).
    await borrarArchivos(quitados([resultado.data.fotoAnterior], [fotoUrl]));
    return ok({ id: resultado.data.id });
  } catch (e) {
    console.error("No se pudo guardar el testimonio", resumenDeError(e));
    return fallo("No pudimos guardar el testimonio. Probá de nuevo.");
  }
}

/** Muestra u oculta un testimonio en el sitio, sin borrarlo. */
export async function cambiarVisibilidadDeTestimonio(id: string, visible: boolean): Promise<Resultado> {
  const admin = await requerirUsuario("admin");
  if (!esUuid(id)) return fallo(NO_ENCONTRADO);

  try {
    const resultado = await transaccion(async (tx) => {
      const [fila] = await tx
        .update(testimonios)
        .set({ visible })
        .where(eq(testimonios.id, id))
        .returning({ pagina: testimonios.pagina, autor: testimonios.autor });
      if (!fila) return fallo(NO_ENCONTRADO);
      await registrarAuditoria(
        {
          usuarioId: admin.id,
          accion: visible ? "testimonio.mostrar" : "testimonio.ocultar",
          entidad: "testimonio",
          entidadId: id,
          detalle: { pagina: fila.pagina, autor: fila.autor },
        },
        tx,
      );
      return ok();
    });
    if (resultado.ok) revalidar();
    return resultado;
  } catch (e) {
    console.error("No se pudo cambiar la visibilidad del testimonio", resumenDeError(e));
    return fallo("No pudimos hacer el cambio. Probá de nuevo.");
  }
}

/** Elimina un testimonio (y su foto de Storage). No se puede deshacer; para sacarlo del sitio sin perderlo, ocultarlo. */
export async function eliminarTestimonio(id: string): Promise<Resultado> {
  const admin = await requerirUsuario("admin");
  if (!esUuid(id)) return fallo(NO_ENCONTRADO);

  try {
    const resultado = await transaccion(async (tx) => {
      const [fila] = await tx
        .delete(testimonios)
        .where(eq(testimonios.id, id))
        .returning({ pagina: testimonios.pagina, autor: testimonios.autor, fotoUrl: testimonios.fotoUrl });
      if (!fila) return fallo(NO_ENCONTRADO);
      await registrarAuditoria(
        { usuarioId: admin.id, accion: "testimonio.eliminar", entidad: "testimonio", entidadId: id, detalle: { pagina: fila.pagina, autor: fila.autor } },
        tx,
      );
      return ok({ fotoUrl: fila.fotoUrl });
    });
    if (!resultado.ok) return resultado;
    revalidar();
    await borrarArchivos([resultado.data.fotoUrl]);
    return ok();
  } catch (e) {
    console.error("No se pudo eliminar el testimonio", resumenDeError(e));
    return fallo("No pudimos eliminar el testimonio. Probá de nuevo.");
  }
}
