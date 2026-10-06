import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { auditoria, type Institucion, type Usuario } from "@/db/schema";
import { partirNombre } from "@/lib/onboarding";
import { membresiaDeUsuario, rolEnInstitucion } from "@/lib/queries/equipo";
import { crearClienteServidor } from "@/lib/supabase/server";

export const ACCION_BAJA_SOLICITADA = "cuenta.baja_solicitada";
export const ACCION_BAJA_RETIRADA = "cuenta.baja_retirada";

/**
 * ¿La cuenta tiene contraseña propia? Una cuenta creada solo con Google no la tiene: ahí "Cambiar contraseña"
 * es en realidad "Crear una contraseña" y no hay una actual que pedir. Se lee del JWT de la sesión.
 */
export async function tieneContrasena(): Promise<boolean> {
  const supabase = await crearClienteServidor();
  const { data } = await supabase.auth.getClaims();
  const meta = (data?.claims?.app_metadata ?? {}) as { provider?: unknown; providers?: unknown };
  const proveedores = Array.isArray(meta.providers) ? meta.providers : meta.provider ? [meta.provider] : [];
  return proveedores.includes("email");
}

/** Cuándo pidió la baja la institución, si el pedido sigue en pie (el último movimiento no fue retirarlo). */
export async function bajaSolicitadaEn(institucionId: string): Promise<Date | null> {
  const [ultimo] = await getDb()
    .select({ accion: auditoria.accion, creadoEn: auditoria.creadoEn })
    .from(auditoria)
    .where(
      and(
        eq(auditoria.entidad, "institucion"),
        eq(auditoria.entidadId, institucionId),
        inArray(auditoria.accion, [ACCION_BAJA_SOLICITADA, ACCION_BAJA_RETIRADA]),
      ),
    )
    .orderBy(desc(auditoria.creadoEn))
    .limit(1);
  return ultimo?.accion === ACCION_BAJA_SOLICITADA ? ultimo.creadoEn : null;
}

/**
 * Datos de "Mi cuenta". El dueño edita los de contacto de la institución (nombre y teléfono); quien entró
 * por invitación edita su nombre en el equipo y no tiene teléfono propio (`telefono: null`).
 */
export async function datosDeCuenta(institucion: Institucion, usuario: Usuario) {
  const [rol, membresia, baja, conContrasena] = await Promise.all([
    rolEnInstitucion(institucion, usuario.id),
    membresiaDeUsuario(institucion.id, usuario.id),
    bajaSolicitadaEn(institucion.id),
    tieneContrasena(),
  ]);
  const esDueno = rol === "dueno";
  const completo = (esDueno ? institucion.contactoNombre : membresia?.nombre) ?? "";
  const { nombre, apellido } = partirNombre(completo, "");
  return {
    nombre,
    apellido,
    telefono: esDueno ? (institucion.telefono ?? "") : null,
    email: usuario.email,
    rol: rol ?? "colaborador",
    esDueno,
    bajaSolicitadaEn: baja,
    tieneContrasena: conContrasena,
  };
}
