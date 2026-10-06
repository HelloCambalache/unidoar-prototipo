"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { transaccion } from "@/db";
import { instituciones } from "@/db/schema";
import { fallo, ok, parsear, type Resultado } from "@/lib/acciones";
import { registrarAuditoria } from "@/lib/auditoria";
import { requerirUsuario } from "@/lib/auth";
import { planInstitucionSchema, suspensionSchema } from "@/lib/backoffice-instituciones";
import { esUuid } from "@/lib/busquedas";
import { precioDePlan } from "@/lib/cobros";
import { planDe } from "@/lib/planes";
import { avisarAVarios } from "@/lib/queries/avisos";
import { destinatariosDeInstitucion, type EjecutorBo } from "@/lib/queries/backoffice-instituciones";

/*
 * Acciones del equipo sobre una institución. Todas arrancan por `requerirUsuario("admin")`, no confían en
 * nada del cliente (el id se valida y la fila se relee dentro de la transacción), dejan auditoría y avisan
 * a la dueña de la cuenta y a los miembros activos.
 */

const NO_ENCONTRADA = "No encontramos esa institución.";

function revalidarInstitucion(id: string, slug?: string) {
  revalidatePath("/backoffice/instituciones");
  revalidatePath(`/backoffice/instituciones/${id}`);
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
    .where(eq(instituciones.id, id))
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
      texto: `cambió el plan de ${inst.nombre} a ${planDe(nuevo).label} (${precioDePlan(nuevo)}).`,
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
    await avisarAVarios(tx, await destinatariosDeInstitucion(tx, inst.id), {
      tipo: "sistema",
      titulo: "UNIDOAR",
      texto: `suspendió la cuenta de ${inst.nombre}. Motivo: ${datos.data.motivo.toLowerCase()}. Escribinos desde Contacto para regularizarla.`,
      enlace: "/contacto",
    });
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
    await avisarAVarios(tx, await destinatariosDeInstitucion(tx, inst.id), {
      tipo: "sistema",
      titulo: "UNIDOAR",
      texto: `reactivó la cuenta de ${inst.nombre}. Ya podés volver a usar UNIDOAR con normalidad.`,
      enlace: "/institucion/dashboard",
    });
    return ok();
  });

  if (resultado.ok) revalidarInstitucion(institucionId);
  return resultado;
}
