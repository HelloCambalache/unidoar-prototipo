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
import { diaHoraLegible } from "@/lib/calendario";
import { correoDeBusquedaUrgente } from "@/lib/correo/eventos";
import { MS } from "@/lib/fechas";
import { permisoParaPublicarPuntual, puedeReabrirPuntual, venceEnDePuntual } from "@/lib/puntual";
import { avisarAVarios, avisarCierreDeBusqueda } from "@/lib/queries/avisos";
import { busquedaPropia } from "@/lib/queries/busquedas";
import { planes as cargarPlanes } from "@/lib/queries/planes";
import { consumirCredito, saldoDeBusquedas, vencimientoDePuntual } from "@/lib/queries/puntuales";
import { sedeParaBusqueda, sedesDeInstitucion } from "@/lib/queries/sedes";
import { sedesElegidas } from "@/lib/sedes";
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

/** Se corta la publicación (y se deshace la transacción) cuando una búsqueda puntual ya no tiene una búsqueda pagada para consumir. */
class SinBusquedaPagada extends Error {}

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

  // Varias sedes a la vez ("sedeIds"): se crea una búsqueda igual en cada una. Si no vienen, la sede única de siempre ("sedeId").
  const pedidas = formData.getAll("sedeIds").map(String);
  let sedes: { id: string; zona: string | null }[];
  if (pedidas.length > 0) {
    const eleccion = sedesElegidas(pedidas, await sedesDeInstitucion(institucion.id));
    if (!eleccion.ok) return fallo("Revisá los campos marcados.", { sedeId: eleccion.error });
    sedes = eleccion.sedes;
  } else {
    const sede = await sedeParaBusqueda(institucion.id, datos.data.sedeId);
    if (!sede) return fallo("Revisá los campos marcados.", { sedeId: "Elegí una sede de la lista." });
    sedes = [sede];
  }

  const valores = valoresDeBusqueda(datos.data);
  const varias = sedes.length > 1;
  const ahora = new Date();
  const venceEn = valores.rapida ? new Date(ahora.getTime() + (datos.data.venceEnHoras ?? 24) * MS.HORA) : null;

  // Búsqueda puntual (el plan sin abono): hace falta una búsqueda pagada y disponible, una sola sede y no pasarse del tope de abiertas. Se mira
  // acá para dar el motivo; el crédito se consume adentro de la transacción (si dos publicaciones compiten, una sola se lo lleva).
  const P = await cargarPlanes();
  const puntual = P.esPuntual(institucion.plan);
  if (puntual) {
    const saldo = await saldoDeBusquedas(getDb(), institucion.id);
    const permiso = permisoParaPublicarPuntual({
      ...saldo,
      maxAbiertas: P.condiciones.puntual.busquedasAbiertas,
      sedes: sedes.length,
      precio: P.precioDePlan(institucion.plan),
    });
    if (!permiso.ok) return fallo(permiso.error, permiso.campo ? { [permiso.campo]: permiso.error } : undefined);
  }

  // Con una sede, la zona del formulario (o la de la sede). Con varias, cada búsqueda toma la zona de su sede.
  const planes = await Promise.all(
    sedes.map(async (sede) => {
      const zona = (varias ? null : valores.zona) ?? sede.zona ?? institucion.zona ?? null;
      return { sede, zona, destinatarios: await docentesAvisables(filtrosDeFormulario(datos.data, zona, formData)) };
    }),
  );

  let avisados: number;
  try {
    avisados = await transaccion(async (tx) => {
    // A cada profesional se le avisa una sola vez por publicación, aunque encaje en varias sedes (por la primera en la que encaja).
    const yaAvisados = new Set<string>();
    for (const { sede, zona, destinatarios } of planes) {
      const [creada] = await tx
        .insert(busquedas)
        .values({ institucionId: institucion.id, sedeId: sede.id, ...valores, zona, venceEn })
        .returning({ id: busquedas.id });
      // La búsqueda puntual consume la búsqueda pagada y queda con su plazo (pasado, el cron la cierra).
      if (puntual && !(await consumirCredito(tx, institucion.id, creada!.id, venceEnDePuntual(ahora, P.condiciones.puntual.vigenciaDias)))) {
        throw new SinBusquedaPagada();
      }
      const nuevos = destinatarios.map((d) => d.usuarioId).filter((u) => !yaAvisados.has(u));
      nuevos.forEach((u) => yaAvisados.add(u));
      if (nuevos.length === 0) continue;
      await avisarAVarios(tx, nuevos, {
        tipo: valores.rapida ? "urgente" : "invitacion",
        titulo: institucion.nombre,
        texto: valores.rapida
          ? `necesita una suplencia urgente: ${valores.puesto}. Respondé antes de que venza.`
          : `publicó una búsqueda que encaja con tu perfil: ${valores.puesto}.`,
        enlace: `/docente/oferta/${creada!.id}`,
      });
      // Solo las búsquedas rápidas se avisan por mail: las comunes quedan en la campanita (y, más adelante, en el resumen semanal).
      if (valores.rapida) {
        await correoDeBusquedaUrgente(tx, {
          usuarioIds: nuevos,
          institucion: institucion.nombre,
          puesto: valores.puesto,
          zona,
          plazo: venceEn ? diaHoraLegible(venceEn) : null,
          busquedaId: creada!.id,
        });
      }
    }
    return yaAvisados.size;
    });
  } catch (e) {
    if (e instanceof SinBusquedaPagada) {
      return fallo("Ya no tenés una búsqueda pagada disponible (otra publicación la usó). Escribinos desde Contacto para abonar otra.");
    }
    throw e;
  }

  revalidarBusquedas();
  redirect(`/institucion/busquedas?publicada=${avisados}${varias ? `&sedes=${sedes.length}` : ""}`);
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

  // La sede que se manda, o la que ya tenía (una búsqueda vieja sin sede pasa a la principal).
  const sede = await sedeParaBusqueda(institucion.id, datos.data.sedeId, actual.sedeId);
  if (!sede) return fallo("Revisá los campos marcados.", { sedeId: "Elegí una sede de la lista." });

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
    .set({ ...valores, sedeId: sede.id, zona: valores.zona ?? sede.zona ?? institucion.zona ?? null, venceEn })
    .where(and(eq(busquedas.id, actual.id), eq(busquedas.institucionId, institucion.id)));

  revalidarBusquedas(actual.id);
  redirect(`/institucion/postulantes?busqueda=${actual.id}`);
}

/* ───────────────────────────── Cerrar y reabrir ───────────────────────────── */

/**
 * Cierra una búsqueda propia. Los postulantes no se tocan (el docente la ve como "Búsqueda cerrada"), pero se les avisa en la
 * campanita —no por mail— que el puesto ya se cubrió, con las gracias y la invitación a seguir postulándose.
 */
export async function cerrarBusqueda(busquedaId: string): Promise<Resultado> {
  const { institucion } = await requerirInstitucion();
  if (!esUuid(busquedaId)) return fallo("No encontramos esa búsqueda.");

  const resultado = await transaccion(async (tx) => {
    const [actual] = await tx
      .select({ id: busquedas.id, puesto: busquedas.puesto, estado: busquedas.estado })
      .from(busquedas)
      .where(and(eq(busquedas.id, busquedaId), eq(busquedas.institucionId, institucion.id)))
      .limit(1)
      .for("update");
    if (!actual) return fallo("No encontramos esa búsqueda.");
    // Cerrar una ya cerrada no vuelve a avisar.
    if (actual.estado === "cerrada") return ok();

    await tx.update(busquedas).set({ estado: "cerrada", cerradaEn: new Date() }).where(eq(busquedas.id, actual.id));
    await avisarCierreDeBusqueda(tx, { busquedaId: actual.id, puesto: actual.puesto, institucionNombre: institucion.nombre });
    return ok();
  });

  if (resultado.ok) revalidarBusquedas(busquedaId);
  return resultado;
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

  // Una búsqueda puntual pasada de su plazo no se reabre: sería publicar otra sin pagarla.
  const puntual = await vencimientoDePuntual(getDb(), actual.id);
  if (puntual.esPuntual && !puedeReabrirPuntual(puntual.venceEn)) {
    return fallo("Esta búsqueda puntual ya cumplió su plazo: para publicar otra hace falta abonar una nueva.");
  }

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
