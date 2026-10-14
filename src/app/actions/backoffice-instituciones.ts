"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { getDb, transaccion } from "@/db";
import { instituciones } from "@/db/schema";
import { fallo, ok, parsear, type Resultado } from "@/lib/acciones";
import { registrarAuditoria } from "@/lib/auditoria";
import { requerirUsuario } from "@/lib/auth";
import { datosDeCuentaSchema, planInstitucionSchema, suspensionSchema } from "@/lib/backoffice-instituciones";
import { esUuid } from "@/lib/busquedas";
import { encolarParaUsuarios } from "@/lib/correo/cola";
import { planes } from "@/lib/queries/planes";
import { borrarArchivos } from "@/lib/queries/archivos";
import { avisarAVarios } from "@/lib/queries/avisos";
import { borrarArchivosDeLaCuenta, borrarUsuarioDeAcceso } from "@/lib/queries/baja-docente";
import {
  ACCION_BAJA_DE_INSTITUCION_INCOMPLETA,
  borrarDatosDeLaInstitucion,
  borrarPathsPrivados,
} from "@/lib/queries/baja-institucion";
import { destinatariosDeInstitucion, type EjecutorBo } from "@/lib/queries/backoffice-instituciones";
import { guardarSedesDeInstitucion } from "@/lib/queries/sedes-guardar";
import { guardarVitrinaDeInstitucion } from "@/lib/queries/vitrina-guardar";
import type { SedeVista } from "@/lib/sedes";
import type { VitrinaGuardada } from "@/lib/vitrina";

/*
 * Acciones del equipo sobre una institución. Todas arrancan por `requerirUsuario("admin")`, no confían en
 * nada del cliente (el id se valida y la fila se relee dentro de la transacción), dejan auditoría y avisan
 * a la dueña de la cuenta y a los miembros activos.
 */

const NO_ENCONTRADA = "No encontramos esa institución.";

function revalidarInstitucion(id: string, slug?: string) {
  revalidatePath("/backoffice/instituciones");
  revalidatePath(`/backoffice/instituciones/${id}`);
  revalidatePath(`/backoffice/instituciones/${id}/editar`);
  revalidatePath("/backoffice/cobros");
  revalidatePath(`/backoffice/cobros/${id}`);
  revalidatePath("/institucion/dashboard");
  revalidatePath("/institucion/plan");
  if (slug) {
    revalidatePath("/");
    revalidatePath("/instituciones");
    revalidatePath(`/instituciones/${slug}`);
  }
}

/** Releé la institución con un lock de fila: dos operadores no se pisan al cambiar el mismo estado. */
const institucionBloqueada = (tx: EjecutorBo, id: string) =>
  tx
    .select({
      id: instituciones.id,
      slug: instituciones.slug,
      nombre: instituciones.nombre,
      plan: instituciones.plan,
      verificada: instituciones.verificada,
      suspendida: instituciones.suspendida,
    })
    .from(instituciones)
    // Una institución dada de baja ya no admite cambios: para estas acciones es como si no existiera.
    .where(and(eq(instituciones.id, id), isNull(instituciones.bajaEn)))
    .limit(1)
    .for("update");

/* ───────────────────────────── Verificación ───────────────────────────── */

/** Pone o quita el sello de verificada de una institución. */
export async function verificarInstitucion(institucionId: string, verificada: boolean): Promise<Resultado> {
  const admin = await requerirUsuario("admin");
  if (!esUuid(institucionId) || typeof verificada !== "boolean") return fallo(NO_ENCONTRADA);

  let slug: string | undefined;
  const resultado = await transaccion(async (tx) => {
    const [inst] = await institucionBloqueada(tx, institucionId);
    if (!inst) return fallo(NO_ENCONTRADA);
    if (inst.verificada === verificada) return ok();
    slug = inst.slug;

    await tx.update(instituciones).set({ verificada }).where(eq(instituciones.id, inst.id));
    await registrarAuditoria(
      {
        usuarioId: admin.id,
        accion: verificada ? "institucion.verificar" : "institucion.quitar_verificacion",
        entidad: "institucion",
        entidadId: inst.id,
        detalle: { institucionId: inst.id, nombre: inst.nombre },
      },
      tx,
    );
    await avisarAVarios(tx, await destinatariosDeInstitucion(tx, inst.id), {
      tipo: "verificacion",
      titulo: "UNIDOAR",
      texto: verificada
        ? "verificó tu institución. Ya mostrás el sello de verificada en tu perfil y en tus búsquedas."
        : "quitó la verificación de tu institución. Escribinos desde Contacto si querés revisar el motivo.",
      enlace: verificada ? "/institucion/dashboard" : "/contacto",
    });
    return ok();
  });

  if (resultado.ok) revalidarInstitucion(institucionId, slug);
  return resultado;
}

/* ───────────────────────────── Editar el perfil ───────────────────────────── */

/**
 * Edita el perfil público (la vitrina) de una institución desde el backoffice: el mismo formulario y las mismas validaciones
 * que usa la institución (`guardarVitrinaDeInstitucion`), pero por el id que se pasa y solo para admin. Las imágenes nuevas tienen
 * que ser de las que subió el propio admin. Queda en la actividad de la cuenta con los nombres de lo que se tocó (sin los
 * valores) y no se le avisa a la institución.
 */
export async function actualizarVitrinaComoAdmin(institucionId: string, entrada: unknown): Promise<Resultado<VitrinaGuardada>> {
  const admin = await requerirUsuario("admin");
  if (!esUuid(institucionId)) return fallo(NO_ENCONTRADA);
  const [inst] = await getDb().select().from(instituciones).where(eq(instituciones.id, institucionId)).limit(1);
  if (!inst || inst.bajaEn) return fallo(NO_ENCONTRADA);

  const r = await guardarVitrinaDeInstitucion(inst, admin.id, entrada);
  if (!r.ok) return r;
  if (r.data.cambios.length > 0) {
    await registrarAuditoria({
      usuarioId: admin.id,
      accion: "institucion.editar_perfil",
      entidad: "institucion",
      entidadId: inst.id,
      detalle: { institucionId: inst.id, nombre: inst.nombre, campos: r.data.cambios },
    });
  }
  revalidarInstitucion(inst.id, inst.slug);
  return ok(r.data.guardado);
}

/**
 * Edita las sedes de una institución desde el backoffice: la misma lista y las mismas validaciones que usa la institución
 * (`guardarSedesDeInstitucion`), más el CUE de cada sede, que solo carga el equipo. Queda en la actividad de la cuenta con los
 * nombres de lo que se tocó (sin los valores) y no se le avisa a la institución.
 */
export async function actualizarSedesComoAdmin(institucionId: string, entrada: unknown): Promise<Resultado<{ sedes: SedeVista[] }>> {
  const admin = await requerirUsuario("admin");
  if (!esUuid(institucionId)) return fallo(NO_ENCONTRADA);
  const [inst] = await getDb().select().from(instituciones).where(eq(instituciones.id, institucionId)).limit(1);
  if (!inst || inst.bajaEn) return fallo(NO_ENCONTRADA);

  const r = await guardarSedesDeInstitucion(inst, entrada, { puedeEditarCue: true });
  if (!r.ok) return r;
  if (r.data.cambios.length > 0) {
    await registrarAuditoria({
      usuarioId: admin.id,
      accion: "institucion.editar_sedes",
      entidad: "institucion",
      entidadId: inst.id,
      detalle: { institucionId: inst.id, nombre: inst.nombre, campos: r.data.cambios },
    });
  }
  revalidarInstitucion(inst.id, inst.slug);
  revalidatePath(`/docente/instituciones/${inst.slug}`);
  revalidatePath("/docente/instituciones");
  return ok({ sedes: r.data.sedes });
}

/**
 * Corrige los datos de la cuenta que la institución no edita sola: teléfono y CUIT (el CUE es de cada sede: se carga en sus sedes).
 * Deja auditoría con los nombres de lo que cambió, nunca los valores.
 */
export async function actualizarDatosDeInstitucion(institucionId: string, entrada: unknown): Promise<Resultado> {
  const admin = await requerirUsuario("admin");
  if (!esUuid(institucionId)) return fallo(NO_ENCONTRADA);
  const datos = parsear(datosDeCuentaSchema, typeof entrada === "object" && entrada !== null ? (entrada as Record<string, unknown>) : {});
  if (!datos.ok) return fallo(datos.error, datos.campos);

  const resultado = await transaccion(async (tx) => {
    const [inst] = await tx
      .select({
        id: instituciones.id,
        nombre: instituciones.nombre,
        telefono: instituciones.telefono,
        cuit: instituciones.cuit,
      })
      .from(instituciones)
      .where(and(eq(instituciones.id, institucionId), isNull(instituciones.bajaEn)))
      .limit(1)
      .for("update");
    if (!inst) return fallo(NO_ENCONTRADA);

    const nuevo = { telefono: datos.data.telefono, cuit: datos.data.cuit };
    const campos = [
      ...(nuevo.telefono !== (inst.telefono ?? null) ? ["teléfono"] : []),
      ...(nuevo.cuit !== (inst.cuit ?? null) ? ["CUIT"] : []),
    ];
    if (campos.length === 0) return ok();

    await tx.update(instituciones).set(nuevo).where(eq(instituciones.id, inst.id));
    await registrarAuditoria(
      {
        usuarioId: admin.id,
        accion: "institucion.editar_datos",
        entidad: "institucion",
        entidadId: inst.id,
        detalle: { institucionId: inst.id, nombre: inst.nombre, campos },
      },
      tx,
    );
    return ok();
  });

  if (resultado.ok) revalidarInstitucion(institucionId);
  return resultado;
}

/* ───────────────────────────── Plan ───────────────────────────── */

/**
 * Cambia el plan de la institución desde la ficha. No toca facturas: las ya emitidas quedan como están y
 * el equipo ajusta lo que haga falta desde Cobros (el cambio por pedido de la institución sí arma la factura).
 */
export async function cambiarPlanInstitucion(institucionId: string, plan: string): Promise<Resultado> {
  const admin = await requerirUsuario("admin");
  if (!esUuid(institucionId)) return fallo(NO_ENCONTRADA);
  const datos = parsear(planInstitucionSchema, { plan });
  if (!datos.ok) return fallo(datos.campos?.plan ?? datos.error, datos.campos);
  const nuevo = datos.data.plan;
  const P = await planes();

  const resultado = await transaccion(async (tx) => {
    const [inst] = await institucionBloqueada(tx, institucionId);
    if (!inst) return fallo(NO_ENCONTRADA);
    if (inst.plan === nuevo) return ok();

    await tx.update(instituciones).set({ plan: nuevo }).where(eq(instituciones.id, inst.id));
    await registrarAuditoria(
      {
        usuarioId: admin.id,
        accion: "institucion.cambiar_plan",
        entidad: "institucion",
        entidadId: inst.id,
        detalle: { institucionId: inst.id, nombre: inst.nombre, de: inst.plan, a: nuevo },
      },
      tx,
    );
    await avisarAVarios(tx, await destinatariosDeInstitucion(tx, inst.id), {
      tipo: "sistema",
      titulo: "UNIDOAR",
      texto: `cambió el plan de ${inst.nombre} a ${P.planDe(nuevo).label} (${P.precioDePlan(nuevo)}).`,
      enlace: "/institucion/plan",
    });
    return ok();
  });

  if (resultado.ok) revalidarInstitucion(institucionId);
  return resultado;
}

/* ───────────────────────────── Suspensión ───────────────────────────── */

/**
 * Suspende la cuenta: el equipo de la institución deja de poder entrar a su área (se hace cumplir en
 * `requerirInstitucion`). El motivo queda en la auditoría y se le dice a la institución; la nota es interna.
 */
export async function suspenderInstitucion(
  institucionId: string,
  entrada: { motivo: string; nota?: string },
): Promise<Resultado> {
  const admin = await requerirUsuario("admin");
  if (!esUuid(institucionId)) return fallo(NO_ENCONTRADA);
  const datos = parsear(suspensionSchema, entrada);
  if (!datos.ok) return fallo(datos.campos?.motivo ?? datos.campos?.nota ?? datos.error, datos.campos);

  const resultado = await transaccion(async (tx) => {
    const [inst] = await institucionBloqueada(tx, institucionId);
    if (!inst) return fallo(NO_ENCONTRADA);
    if (inst.suspendida) return fallo("Esta cuenta ya está suspendida.");

    await tx.update(instituciones).set({ suspendida: true }).where(eq(instituciones.id, inst.id));
    await registrarAuditoria(
      {
        usuarioId: admin.id,
        accion: "institucion.suspender",
        entidad: "institucion",
        entidadId: inst.id,
        detalle: { institucionId: inst.id, nombre: inst.nombre, motivo: datos.data.motivo, nota: datos.data.nota ?? null },
      },
      tx,
    );
    const destinatarios = await destinatariosDeInstitucion(tx, inst.id);
    await avisarAVarios(tx, destinatarios, {
      tipo: "sistema",
      titulo: "UNIDOAR",
      texto: `suspendió la cuenta de ${inst.nombre}. Motivo: ${datos.data.motivo.toLowerCase()}. Escribinos desde Contacto para regularizarla.`,
      enlace: "/contacto",
    });
    // Una cuenta suspendida no ve la campanita: el mail es la única forma de que el equipo se entere.
    await encolarParaUsuarios(tx, destinatarios, "M15", { nombre: null, institucion: inst.nombre, motivo: datos.data.motivo });
    return ok();
  });

  if (resultado.ok) revalidarInstitucion(institucionId);
  return resultado;
}

/** Levanta la suspensión: el equipo de la institución vuelve a entrar a su área. */
export async function reactivarInstitucion(institucionId: string): Promise<Resultado> {
  const admin = await requerirUsuario("admin");
  if (!esUuid(institucionId)) return fallo(NO_ENCONTRADA);

  const resultado = await transaccion(async (tx) => {
    const [inst] = await institucionBloqueada(tx, institucionId);
    if (!inst) return fallo(NO_ENCONTRADA);
    if (!inst.suspendida) return ok();

    await tx.update(instituciones).set({ suspendida: false }).where(eq(instituciones.id, inst.id));
    await registrarAuditoria(
      {
        usuarioId: admin.id,
        accion: "institucion.reactivar",
        entidad: "institucion",
        entidadId: inst.id,
        detalle: { institucionId: inst.id, nombre: inst.nombre },
      },
      tx,
    );
    const destinatarios = await destinatariosDeInstitucion(tx, inst.id);
    await avisarAVarios(tx, destinatarios, {
      tipo: "sistema",
      titulo: "UNIDOAR",
      texto: `reactivó la cuenta de ${inst.nombre}. Ya podés volver a usar UNIDOAR con normalidad.`,
      enlace: "/institucion/dashboard",
    });
    // Como la suspensión (M15): quien estaba suspendido no veía la campanita, así que el mail es la forma de enterarse de que ya puede entrar.
    await encolarParaUsuarios(tx, destinatarios, "M16", { nombre: null, institucion: inst.nombre });
    return ok();
  });

  if (resultado.ok) revalidarInstitucion(institucionId);
  return resultado;
}

/* ───────────────────────────── Baja de la cuenta ───────────────────────────── */

const bajaSchema = z.object({ confirmacion: z.string().trim().min(1, "Escribí el nombre de la institución para confirmar.") });

/**
 * Procesa la baja de una institución: borra de verdad su equipo y sus cuentas de acceso, sus búsquedas y postulaciones, los cursos,
 * los contactos privados, el perfil público y los archivos, y CONSERVA el registro fiscal (nombre, tipo, CUIT, domicilio) y las
 * facturas. No se puede deshacer. Exige escribir el nombre de la institución. Primero la base (en una transacción, con la
 * auditoría), después Storage y los usuarios de Supabase Auth: si alguno de esos falla, la base ya quedó limpia y se lo dice a quien
 * la procesa para que termine a mano. Ver src/lib/queries/baja-institucion.ts.
 */
export async function procesarBajaInstitucion(institucionId: string, entrada: { confirmacion: string }): Promise<Resultado<{ pendientes: string[] }>> {
  const admin = await requerirUsuario("admin");
  if (!esUuid(institucionId)) return fallo(NO_ENCONTRADA);
  const datos = parsear(bajaSchema, typeof entrada === "object" && entrada !== null ? entrada : {});
  if (!datos.ok) return fallo(datos.campos?.confirmacion ?? datos.error, datos.campos);

  // El enlace público de antes, para que deje de mostrarse.
  const [antes] = await getDb().select({ slug: instituciones.slug }).from(instituciones).where(eq(instituciones.id, institucionId)).limit(1);

  const hecho = await transaccion((tx) => borrarDatosDeLaInstitucion(tx, admin.id, institucionId, datos.data.confirmacion));
  if (!hecho.ok) return hecho;
  const { cuentasABorrar, imagenes, archivosDeExamen } = hecho.data;

  // La base ya está limpia. Lo que sigue es Storage y los usuarios de acceso: no se deshace lo anterior si algo falla.
  await borrarArchivos(imagenes);
  let archivosCompletos = await borrarPathsPrivados(archivosDeExamen);
  const sinBorrarElAcceso: string[] = [];
  for (const cuentaId of cuentasABorrar) {
    if (!(await borrarArchivosDeLaCuenta(cuentaId)).completo) archivosCompletos = false;
    if (!(await borrarUsuarioDeAcceso(cuentaId))) sinBorrarElAcceso.push(cuentaId);
  }

  const pendientes: string[] = [];
  if (!archivosCompletos) pendientes.push("No se pudieron borrar todos sus archivos de Storage: corré pnpm db:limpiar-archivos --borrar.");
  if (sinBorrarElAcceso.length > 0) {
    pendientes.push("No se pudo borrar el usuario de acceso de alguien de su equipo: borralo desde Supabase → Authentication → Users.");
  }
  if (pendientes.length > 0) {
    await registrarAuditoria({
      usuarioId: admin.id,
      accion: ACCION_BAJA_DE_INSTITUCION_INCOMPLETA,
      entidad: "institucion",
      entidadId: institucionId,
      detalle: { archivosCompletos, accesosSinBorrar: sinBorrarElAcceso },
    });
  }

  revalidarInstitucion(institucionId, antes?.slug);
  revalidatePath("/backoffice/instituciones");
  return ok({ pendientes });
}
