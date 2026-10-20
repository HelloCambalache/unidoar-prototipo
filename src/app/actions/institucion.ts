"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { transaccion } from "@/db";
import { institucionMiembros, instituciones } from "@/db/schema";
import { fallo, ok, parsear, type Resultado } from "@/lib/acciones";
import { requerirInstitucion } from "@/lib/auth";
import { esRolGestor } from "@/lib/equipo";
import { registrarAuditoria } from "@/lib/auditoria";
import {
  ACCION_BAJA_RETIRADA,
  ACCION_BAJA_SOLICITADA,
  bajaSolicitadaEn,
} from "@/lib/queries/cuenta";
import { encolarParaEquipo } from "@/lib/correo/cola";
import { avisarAAdmins } from "@/lib/queries/avisos";
import { rolEnInstitucion } from "@/lib/queries/equipo";
import { guardarSedesDeInstitucion } from "@/lib/queries/sedes-guardar";
import { guardarVitrinaDeInstitucion } from "@/lib/queries/vitrina-guardar";
import type { SedeVista } from "@/lib/sedes";
import type { VitrinaGuardada } from "@/lib/vitrina";
import { DEMASIADOS_PEDIDOS, permitirPedidoAlEquipo } from "@/lib/pedidos";

/*
 * Acciones de la institución sobre su propia cuenta: vitrina (perfil público), datos de quien administra y
 * pedido de baja (la contraseña y el email son de cualquier rol: src/app/actions/cuenta.ts). Todas parten de `requerirInstitucion()`: nunca se acepta el id de una institución
 * que venga del cliente.
 */

/* ───────────────────────────── Vitrina ───────────────────────────── */

export type { VitrinaGuardada } from "@/lib/vitrina";

/**
 * "Guardar cambios" de Mi perfil: datos de la institución, valores, galería de instalaciones y novedades en una
 * sola transacción (las reglas están en `guardarVitrinaDeInstitucion`, que comparte con el backoffice). Devuelve las listas
 * ya con sus ids para que el formulario no duplique nada en el próximo guardado.
 */
export async function actualizarVitrina(entrada: unknown): Promise<Resultado<VitrinaGuardada>> {
  const { usuario, institucion } = await requerirInstitucion();
  if (!esRolGestor(await rolEnInstitucion(institucion, usuario.id))) {
    return fallo("Solo el dueño y los administradores pueden editar el perfil público.");
  }
  const r = await guardarVitrinaDeInstitucion(institucion, usuario.id, entrada);
  return r.ok ? ok(r.data.guardado) : r;
}

/**
 * "Guardar sedes" de Mi perfil: la lista completa de sedes de la institución (las reglas están en `guardarSedesDeInstitucion`, que
 * comparte con el backoffice). El CUE no lo carga la institución: lo respeta solo cuando lo carga el equipo.
 */
export async function actualizarSedes(entrada: unknown): Promise<Resultado<{ sedes: SedeVista[]; huella: string }>> {
  const { usuario, institucion } = await requerirInstitucion();
  if (!esRolGestor(await rolEnInstitucion(institucion, usuario.id))) {
    return fallo("Solo el dueño y los administradores pueden editar las sedes.");
  }
  const r = await guardarSedesDeInstitucion(institucion, entrada, { puedeEditarCue: false });
  if (!r.ok) return r;
  // Las sedes se ven en el menú, en las dos páginas de perfil, en el catálogo y en las ofertas de los profesionales.
  revalidatePath("/institucion", "layout");
  revalidatePath(`/instituciones/${institucion.slug}`);
  revalidatePath(`/docente/instituciones/${institucion.slug}`);
  revalidatePath("/docente/instituciones");
  revalidatePath("/instituciones");
  return ok({ sedes: r.data.sedes, huella: r.data.huella });
}

/* ───────────────────────────── Mi cuenta ───────────────────────────── */

const cuentaSchema = z.object({
  nombre: z.string().trim().min(2, "Completá tu nombre").max(60, "Máximo 60 caracteres"),
  apellido: z.string().trim().max(80, "Máximo 80 caracteres"),
  telefono: z.string().trim().max(40, "Máximo 40 caracteres").optional(),
});

/**
 * Datos de quien administra la cuenta. El dueño edita nombre y teléfono de contacto de la institución; quien
 * entró por invitación edita su nombre en el equipo (no tiene teléfono propio). El email es el de acceso y no se toca.
 */
export async function actualizarCuenta(_previo: Resultado | null, formData: FormData): Promise<Resultado> {
  const { usuario, institucion } = await requerirInstitucion();
  const rol = await rolEnInstitucion(institucion, usuario.id);
  const esDueno = rol === "dueno";

  const r = parsear(cuentaSchema, formData);
  // El teléfono de contacto es obligatorio para el dueño: se avisa junto con los otros errores, no de a uno.
  const telefonoCorto = esDueno && String(formData.get("telefono") ?? "").trim().length < 6;
  if (!r.ok) {
    return fallo(r.error, {
      ...r.campos,
      ...(telefonoCorto && !r.campos?.telefono ? { telefono: "Poné un teléfono de contacto" } : {}),
    });
  }
  const { nombre, apellido, telefono } = r.data;
  if (telefonoCorto) return fallo("Revisá los campos marcados.", { telefono: "Poné un teléfono de contacto" });
  const completo = `${nombre} ${apellido}`.trim();

  await transaccion(async (tx) => {
    if (esDueno) {
      await tx
        .update(instituciones)
        .set({ contactoNombre: completo, telefono: telefono ?? null })
        .where(eq(instituciones.id, institucion.id));
    }
    await tx
      .update(institucionMiembros)
      .set({ nombre: completo })
      .where(and(eq(institucionMiembros.institucionId, institucion.id), eq(institucionMiembros.usuarioId, usuario.id)));
  });

  // El avatar del encabezado sale de estos datos.
  revalidatePath("/institucion", "layout");
  return ok();
}

/* ───────────────────────────── Baja de la cuenta ───────────────────────────── */

const bajaSchema = z.object({ confirmacion: z.string().trim().min(1, "Escribí el nombre de tu institución") });

const comparable = (t: string) => t.trim().replace(/\s+/g, " ").toLowerCase();

/**
 * Pedido de baja. NO borra nada ni despublica nada: deja constancia en `auditoria` ("cuenta.baja_solicitada")
 * para que el equipo de UNIDOAR se contacte y la procese. Solo la puede pedir el dueño de la cuenta, y hay que
 * escribir el nombre de la institución para confirmar. Pedirla dos veces no duplica el registro.
 */
export async function solicitarBajaCuenta(_previo: Resultado | null, formData: FormData): Promise<Resultado> {
  const { usuario, institucion } = await requerirInstitucion();
  if (!permitirPedidoAlEquipo(usuario.id)) return fallo(DEMASIADOS_PEDIDOS);
  if ((await rolEnInstitucion(institucion, usuario.id)) !== "dueno") {
    return fallo("Solo el dueño de la cuenta puede pedir la baja.");
  }

  const r = parsear(bajaSchema, formData);
  if (!r.ok) return fallo(r.error, r.campos);
  if (comparable(r.data.confirmacion) !== comparable(institucion.nombre)) {
    return fallo("El nombre no coincide.", { confirmacion: `Escribí exactamente «${institucion.nombre}» para confirmar.` });
  }

  if (!(await bajaSolicitadaEn(institucion.id))) {
    await transaccion(async (tx) => {
      await registrarAuditoria(
        {
          usuarioId: usuario.id,
          accion: ACCION_BAJA_SOLICITADA,
          entidad: "institucion",
          entidadId: institucion.id,
          detalle: { institucion: institucion.nombre, email: usuario.email, plan: institucion.plan },
        },
        tx,
      );
      await avisarAAdmins(tx, {
        titulo: institucion.nombre,
        texto: `pidió la baja de la cuenta. Hay que escribirle a ${usuario.email} para confirmarla.`,
        enlace: `/backoffice/instituciones/${institucion.id}`,
      });
      await encolarParaEquipo(tx, "M62", { cuenta: institucion.nombre, tipo: "institución", ruta: `/backoffice/instituciones/${institucion.id}` });
    });
  }

  revalidatePath("/institucion/cuenta");
  return ok();
}

/** Retira un pedido de baja que todavía no se procesó (la cuenta sigue exactamente como estaba). */
export async function retirarBajaCuenta(): Promise<Resultado> {
  const { usuario, institucion } = await requerirInstitucion();
  if (!permitirPedidoAlEquipo(usuario.id)) return fallo(DEMASIADOS_PEDIDOS);
  if ((await rolEnInstitucion(institucion, usuario.id)) !== "dueno") {
    return fallo("Solo el dueño de la cuenta puede retirar el pedido de baja.");
  }

  if (await bajaSolicitadaEn(institucion.id)) {
    await transaccion(async (tx) => {
      await registrarAuditoria(
        {
          usuarioId: usuario.id,
          accion: ACCION_BAJA_RETIRADA,
          entidad: "institucion",
          entidadId: institucion.id,
          detalle: { institucion: institucion.nombre },
        },
        tx,
      );
      await avisarAAdmins(tx, {
        titulo: institucion.nombre,
        texto: "retiró el pedido de baja: la cuenta sigue como estaba.",
        enlace: `/backoffice/instituciones/${institucion.id}`,
      });
    });
  }

  revalidatePath("/institucion/cuenta");
  return ok();
}
