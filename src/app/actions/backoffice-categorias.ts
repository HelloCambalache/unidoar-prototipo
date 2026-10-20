"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { transaccion } from "@/db";
import { asignaturas } from "@/db/schema";
import { fallo, ok, parsear, type Resultado } from "@/lib/acciones";
import { registrarAuditoria } from "@/lib/auditoria";
import { requerirUsuario } from "@/lib/auth";
import {
  asignaturaNuevaSchema,
  claveDeNombre,
  renombreAsignaturaSchema,
  renombreRubroSchema,
  type AsignaturaNueva,
} from "@/lib/backoffice-categorias";
import { esUuid } from "@/lib/busquedas";
import {
  asignaturaPorId,
  asignaturasDeCategoria,
  propagarRenombre,
  usoDeAsignatura,
  type UsoAsignatura,
} from "@/lib/queries/backoffice-categorias";
import { resumenDeError } from "@/lib/errores";

/*
 * ABM del catálogo de asignaturas. Cada acción exige rol admin, relee las filas dentro de la transacción y deja
 * auditoría. Las asignaturas se guardan como texto en perfiles docentes y búsquedas: renombrar actualiza esas
 * filas en la misma transacción para no dejar datos huérfanos; borrar solo saca la opción del catálogo.
 */

const NO_ENCONTRADA = "No encontramos esa asignatura.";
const REPETIDA = "Ya hay una asignatura con ese nombre en esta categoría.";

function revalidarCatalogo() {
  revalidatePath("/backoffice/categorias");
  // Pantallas que arman sus opciones con el catálogo.
  revalidatePath("/institucion/publicar");
  revalidatePath("/institucion/buscar-docentes");
  revalidatePath("/docente/perfil");
}

const esUnica = (e: unknown) =>
  ((e as { code?: string }).code ?? (e as { cause?: { code?: string } }).cause?.code) === "23505";

/* ───────────────────────────── Asignaturas ───────────────────────────── */

/**
 * Agrega una asignatura a un rubro. Con `nuevoRubro`, `rubro` es el nombre del rubro que se crea con esta
 * primera asignatura (un rubro existe mientras tenga al menos una).
 */
export async function agregarAsignatura(entrada: AsignaturaNueva): Promise<Resultado<{ id: string }>> {
  const admin = await requerirUsuario("admin");
  const datos = parsear(asignaturaNuevaSchema, entrada);
  if (!datos.ok) return fallo(Object.values(datos.campos ?? {})[0] ?? datos.error, datos.campos);
  const { categoria, rubro, nombre, nuevoRubro } = datos.data;

  try {
    const resultado = await transaccion(async (tx) => {
      const existentes = await asignaturasDeCategoria(tx, categoria);
      if (existentes.some((a) => claveDeNombre(a.nombre) === claveDeNombre(nombre))) {
        return fallo(REPETIDA, { nombre: "Ya existe en esta categoría" });
      }

      let orden: number;
      if (nuevoRubro) {
        if (existentes.some((a) => claveDeNombre(a.rubro) === claveDeNombre(rubro))) {
          return fallo("Ya hay un rubro con ese nombre en esta categoría.", { rubro: "Ya existe en esta categoría" });
        }
        // Los rubros se ordenan por centenas (0, 100, 200…): el nuevo va al final.
        const maximo = existentes.reduce((m, a) => Math.max(m, a.orden), -1);
        orden = (Math.floor(maximo / 100) + 1) * 100;
      } else {
        const delRubro = existentes.filter((a) => a.rubro === rubro);
        if (delRubro.length === 0) return fallo("Ese rubro ya no existe. Recargá la página.", { rubro: "No existe" });
        orden = delRubro.reduce((m, a) => Math.max(m, a.orden), -1) + 1;
      }

      const [nueva] = await tx
        .insert(asignaturas)
        .values({ categoria, rubro, nombre, orden })
        .returning({ id: asignaturas.id });
      await registrarAuditoria(
        {
          usuarioId: admin.id,
          accion: "asignatura.crear",
          entidad: "asignatura",
          entidadId: nueva!.id,
          detalle: { categoria, rubro, nombre, rubroNuevo: nuevoRubro },
        },
        tx,
      );
      return ok({ id: nueva!.id });
    });
    if (resultado.ok) revalidarCatalogo();
    return resultado;
  } catch (e) {
    if (esUnica(e)) return fallo(REPETIDA, { nombre: "Ya existe en esta categoría" });
    console.error("No se pudo agregar la asignatura", resumenDeError(e));
    return fallo("No pudimos agregar la asignatura. Probá de nuevo.");
  }
}

/**
 * Cambia el nombre de una asignatura y actualiza, en la misma transacción, los perfiles docentes y las
 * búsquedas de su categoría que la tenían. Devuelve a cuántos alcanzó.
 */
export async function renombrarAsignatura(id: string, nombre: string): Promise<Resultado<UsoAsignatura>> {
  const admin = await requerirUsuario("admin");
  if (!esUuid(id)) return fallo(NO_ENCONTRADA);
  const datos = parsear(renombreAsignaturaSchema, { nombre });
  if (!datos.ok) return fallo(datos.campos?.nombre ?? datos.error, datos.campos);
  const nuevo = datos.data.nombre;

  try {
    const resultado = await transaccion(async (tx) => {
      const actual = await asignaturaPorId(tx, id);
      if (!actual) return fallo(NO_ENCONTRADA);
      if (actual.nombre === nuevo) return ok({ docentes: 0, busquedasActivas: 0, busquedasTotal: 0 });

      const otras = await asignaturasDeCategoria(tx, actual.categoria);
      if (otras.some((a) => a.id !== actual.id && claveDeNombre(a.nombre) === claveDeNombre(nuevo))) {
        return fallo(REPETIDA);
      }

      await tx.update(asignaturas).set({ nombre: nuevo }).where(eq(asignaturas.id, actual.id));
      const alcance = await propagarRenombre(tx, actual.categoria, actual.nombre, nuevo);
      await registrarAuditoria(
        {
          usuarioId: admin.id,
          accion: "asignatura.renombrar",
          entidad: "asignatura",
          entidadId: actual.id,
          detalle: { categoria: actual.categoria, rubro: actual.rubro, de: actual.nombre, a: nuevo, ...alcance },
        },
        tx,
      );
      return ok(alcance);
    });
    if (resultado.ok) revalidarCatalogo();
    return resultado;
  } catch (e) {
    if (esUnica(e)) return fallo(REPETIDA);
    console.error("No se pudo renombrar la asignatura", resumenDeError(e));
    return fallo("No pudimos renombrar la asignatura. Probá de nuevo.");
  }
}

/**
 * Saca una asignatura del catálogo: deja de ofrecerse al publicar búsquedas y en el alta. Los perfiles y
 * búsquedas que ya la tienen la conservan. Si es la última del rubro, el rubro desaparece con ella, así que
 * hay que confirmarlo (`confirmarRubroVacio`); la última de toda la categoría no se puede borrar.
 */
export async function eliminarAsignatura(
  id: string,
  confirmarRubroVacio = false,
): Promise<Resultado<{ rubroEliminado: boolean } & UsoAsignatura>> {
  const admin = await requerirUsuario("admin");
  if (!esUuid(id)) return fallo(NO_ENCONTRADA);

  const resultado = await transaccion(async (tx) => {
    const actual = await asignaturaPorId(tx, id);
    if (!actual) return fallo(NO_ENCONTRADA);

    const deLaCategoria = await asignaturasDeCategoria(tx, actual.categoria);
    if (deLaCategoria.length <= 1) {
      return fallo("Es la única asignatura de la categoría: agregá otra antes de borrarla.");
    }
    const rubroEliminado = deLaCategoria.filter((a) => a.rubro === actual.rubro).length <= 1;
    if (rubroEliminado && confirmarRubroVacio !== true) {
      return fallo(`Es la última asignatura de «${actual.rubro}»: al borrarla el rubro también desaparece. Confirmalo para seguir.`);
    }

    const uso = await usoDeAsignatura(tx, actual.categoria, actual.nombre);
    await tx.delete(asignaturas).where(eq(asignaturas.id, actual.id));
    await registrarAuditoria(
      {
        usuarioId: admin.id,
        accion: "asignatura.eliminar",
        entidad: "asignatura",
        entidadId: actual.id,
        detalle: { categoria: actual.categoria, rubro: actual.rubro, nombre: actual.nombre, rubroEliminado, ...uso },
      },
      tx,
    );
    return ok({ rubroEliminado, ...uso });
  });

  if (resultado.ok) revalidarCatalogo();
  return resultado;
}

/* ───────────────────────────── Rubros ───────────────────────────── */

/** Cambia el nombre de un rubro (afecta a todas sus asignaturas; no hay otras filas que lo guarden). */
export async function renombrarRubro(
  categoria: string,
  rubro: string,
  nuevoNombre: string,
): Promise<Resultado<{ asignaturas: number }>> {
  const admin = await requerirUsuario("admin");
  const datos = parsear(renombreRubroSchema, { categoria, rubro, nuevoNombre });
  if (!datos.ok) return fallo(datos.campos?.nuevoNombre ?? datos.error, datos.campos);

  const resultado = await transaccion(async (tx) => {
    const existentes = await asignaturasDeCategoria(tx, datos.data.categoria);
    const propias = existentes.filter((a) => a.rubro === datos.data.rubro);
    if (propias.length === 0) return fallo("Ese rubro ya no existe. Recargá la página.");
    if (datos.data.rubro === datos.data.nuevoNombre) return ok({ asignaturas: 0 });
    if (
      existentes.some(
        (a) => a.rubro !== datos.data.rubro && claveDeNombre(a.rubro) === claveDeNombre(datos.data.nuevoNombre),
      )
    ) {
      return fallo("Ya hay un rubro con ese nombre en esta categoría.");
    }

    await tx
      .update(asignaturas)
      .set({ rubro: datos.data.nuevoNombre })
      .where(and(eq(asignaturas.categoria, datos.data.categoria), eq(asignaturas.rubro, datos.data.rubro)));
    await registrarAuditoria(
      {
        usuarioId: admin.id,
        accion: "rubro.renombrar",
        entidad: "rubro",
        entidadId: `${datos.data.categoria}:${datos.data.rubro}`,
        detalle: {
          categoria: datos.data.categoria,
          de: datos.data.rubro,
          a: datos.data.nuevoNombre,
          asignaturas: propias.length,
        },
      },
      tx,
    );
    return ok({ asignaturas: propias.length });
  });

  if (resultado.ok) revalidarCatalogo();
  return resultado;
}
