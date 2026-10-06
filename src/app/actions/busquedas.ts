"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { getDb, transaccion } from "@/db";
import { busquedas } from "@/db/schema";
import { fallo, ok, parsear, type Resultado } from "@/lib/acciones";
import { requerirInstitucion } from "@/lib/auth";
import {
  busquedaFormularioSchema,
  esUuid,
  filtrosCoincidenciaSchema,
  valoresDeBusqueda,
  type BusquedaFormulario,
  type EstadoFormularioBusqueda,
  type ResumenCoincidencias,
} from "@/lib/busquedas";
import { MS } from "@/lib/fechas";
import { avisarAVarios } from "@/lib/queries/avisos";
import { busquedaPropia } from "@/lib/queries/busquedas";
import { docentesAvisables, resumenCoincidencias } from "@/lib/queries/coincidencias";

/** Pantallas de la institución y del docente que muestran búsquedas o sus conteos. */
function revalidarBusquedas(busquedaId?: string) {
  revalidatePath("/institucion/dashboard");
  revalidatePath("/institucion/busquedas");
  revalidatePath("/institucion/postulantes");
  revalidatePath("/docente/oportunidades");
  revalidatePath("/docente/busquedas-rapidas");
  revalidatePath("/docente/dashboard");
  if (busquedaId) revalidatePath(`/docente/oferta/${busquedaId}`);
}

const activado = (formData: FormData, nombre: string) => formData.get(nombre) === "on";

/** Los criterios del formulario más los interruptores del panel lateral, con el mismo schema que usa el panel. */
function filtrosDeFormulario(d: BusquedaFormulario, zona: string | null | undefined, formData: FormData) {
  return filtrosCoincidenciaSchema.parse({
    categoria: d.categoria,
    disciplina: d.disciplina,
    nivel: d.nivel,
    turno: d.turno,
    zona: zona ?? undefined,
    ampliarZona: activado(formData, "ampliarZona"),
    incluirSinVerificar: activado(formData, "incluirSinVerificar"),
    turnoExtra: activado(formData, "turnoExtra"),
  });
}

/* ───────────────────────────── Publicar y editar ───────────────────────────── */

/**
 * Publica una búsqueda de la institución de la sesión y avisa (notificación) a los docentes con
 * cuenta que coinciden, hasta TOPE_AVISOS. Crear y avisar van en una sola transacción: no queda
 * una búsqueda publicada a medias.
 */
export async function crearBusqueda(
  _estado: EstadoFormularioBusqueda,
  formData: FormData,
): Promise<EstadoFormularioBusqueda> {
  const { institucion } = await requerirInstitucion();
  const datos = parsear(busquedaFormularioSchema, formData);
  if (!datos.ok) return fallo(datos.error, datos.campos);

  const valores = valoresDeBusqueda(datos.data);
  // Si no cambió la zona del formulario, la búsqueda hereda la de la institución.
  const zona = valores.zona ?? institucion.zona ?? null;
  const ahora = new Date();
  const venceEn = valores.rapida ? new Date(ahora.getTime() + (datos.data.venceEnHoras ?? 24) * MS.HORA) : null;

  const destinatarios = await docentesAvisables(filtrosDeFormulario(datos.data, zona, formData));

  const avisados = await transaccion(async (tx) => {
    const [creada] = await tx
      .insert(busquedas)
      .values({ institucionId: institucion.id, ...valores, zona, venceEn })
      .returning({ id: busquedas.id });
    await avisarAVarios(
      tx,
      destinatarios.map((d) => d.usuarioId),
      {
        tipo: valores.rapida ? "urgente" : "invitacion",
        titulo: institucion.nombre,
        texto: valores.rapida
          ? `necesita una suplencia urgente: ${valores.puesto}. Respondé antes de que venza.`
          : `publicó una búsqueda que encaja con tu perfil: ${valores.puesto}.`,
        enlace: `/docente/oferta/${creada!.id}`,
      },
    );
    return destinatarios.length;
  });

  revalidarBusquedas();
  redirect(`/institucion/busquedas?publicada=${avisados}`);
}

/** Guarda los cambios de una búsqueda propia. No vuelve a avisar a los docentes. */
export async function editarBusqueda(
  busquedaId: string,
  _estado: EstadoFormularioBusqueda,
  formData: FormData,
): Promise<EstadoFormularioBusqueda> {
  const { institucion } = await requerirInstitucion();
  if (!esUuid(busquedaId)) return fallo("No encontramos esa búsqueda.");
  const datos = parsear(busquedaFormularioSchema, formData);
  if (!datos.ok) return fallo(datos.error, datos.campos);

  const actual = await busquedaPropia(institucion.id, busquedaId);
  if (!actual) return fallo("No encontramos esa búsqueda.");

  const valores = valoresDeBusqueda(datos.data);
  const ahora = new Date();
  let venceEn: Date | null = null;
  if (valores.rapida) {
    // Sin plazo nuevo se conserva el vigente; una rápida sin plazo previo arranca con 24 hs.
    venceEn = datos.data.venceEnHoras
      ? new Date(ahora.getTime() + datos.data.venceEnHoras * MS.HORA)
      : (actual.venceEn ?? new Date(ahora.getTime() + 24 * MS.HORA));
  }

  await getDb()
    .update(busquedas)
    .set({ ...valores, zona: valores.zona ?? institucion.zona ?? null, venceEn })
    .where(and(eq(busquedas.id, actual.id), eq(busquedas.institucionId, institucion.id)));

  revalidarBusquedas(actual.id);
  redirect(`/institucion/postulantes?busqueda=${actual.id}`);
}

/* ───────────────────────────── Cerrar y reabrir ───────────────────────────── */

/** Cierra una búsqueda propia. Los postulantes no se tocan: el docente la ve como "Búsqueda cerrada". */
export async function cerrarBusqueda(busquedaId: string): Promise<Resultado> {
  const { institucion } = await requerirInstitucion();
  if (!esUuid(busquedaId)) return fallo("No encontramos esa búsqueda.");

  const cerradas = await getDb()
    .update(busquedas)
    .set({ estado: "cerrada", cerradaEn: new Date() })
    .where(and(eq(busquedas.id, busquedaId), eq(busquedas.institucionId, institucion.id)))
    .returning({ id: busquedas.id });
  if (cerradas.length === 0) return fallo("No encontramos esa búsqueda.");

  revalidarBusquedas(busquedaId);
  return ok();
}

/**
 * Reabre una búsqueda cerrada. Una rápida cuyo plazo ya venció recibe 24 hs más:
 * si no, quedaría "abierta" pero sin aceptar respuestas.
 */
export async function reabrirBusqueda(busquedaId: string): Promise<Resultado> {
  const { institucion } = await requerirInstitucion();
  if (!esUuid(busquedaId)) return fallo("No encontramos esa búsqueda.");

  const actual = await busquedaPropia(institucion.id, busquedaId);
  if (!actual) return fallo("No encontramos esa búsqueda.");

  const ahora = new Date();
  const plazoVencido = actual.rapida && (!actual.venceEn || actual.venceEn.getTime() <= ahora.getTime());
  await getDb()
    .update(busquedas)
    .set({
      estado: "activa",
      cerradaEn: null,
      ...(plazoVencido ? { venceEn: new Date(ahora.getTime() + 24 * MS.HORA) } : {}),
    })
    .where(and(eq(busquedas.id, actual.id), eq(busquedas.institucionId, institucion.id)));

  revalidarBusquedas(actual.id);
  return ok();
}

/* ───────────────────────────── Panel "Se actualiza mientras completás" ───────────────────────────── */

/**
 * Solo lectura: cuántos docentes de la base coinciden con los criterios que lleva el formulario
 * y cómo cambia el número con cada interruptor. Se llama con debounce desde el cliente.
 */
export async function contarCoincidencias(filtros: unknown): Promise<Resultado<ResumenCoincidencias>> {
  await requerirInstitucion();
  const datos = filtrosCoincidenciaSchema.safeParse(filtros);
  if (!datos.success) return fallo("Los criterios no son válidos.");
  return ok(await resumenCoincidencias(datos.data));
}
