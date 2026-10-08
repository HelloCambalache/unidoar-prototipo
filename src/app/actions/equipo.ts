"use server";

import { revalidatePath } from "next/cache";
import { and, eq, ne, sql } from "drizzle-orm";
import { getDb, transaccion } from "@/db";
import { institucionMiembros, instituciones, usuarios } from "@/db/schema";
import { fallo, ok, parsear, type Resultado } from "@/lib/acciones";
import { requerirInstitucion } from "@/lib/auth";
import { esUuid } from "@/lib/busquedas";
import { encolarCorreo } from "@/lib/correo/cola";
import { cambioRolSchema, esRolGestor, infoDeRol, invitacionSchema } from "@/lib/equipo";
import { membresiaDeUsuario, miembroDeInstitucion, rolEnInstitucion } from "@/lib/queries/equipo";

/*
 * Equipo de la institución. Invitar, cambiar el rol y quitar gente es cosa del dueño y de los administradores;
 * cada acción lo verifica acá (no alcanza con esconder los botones). Invitar crea la membresía con estado "invitado"
 * y le manda un mail con el enlace al registro (si el envío está encendido; si no, el panel muestra el enlace para
 * copiar). La persona se une al registrarse con ese mismo email (ver `institucionComoMiembro` en src/lib/queries/equipo.ts).
 */

const SOLO_GESTORES = "Solo el dueño y los administradores pueden manejar el equipo.";
const NO_ENCONTRADO = "No encontramos a esa persona en el equipo.";
const DUENO_INTOCABLE = "El dueño de la cuenta no se puede degradar ni eliminar.";

function revalidarEquipo() {
  revalidatePath("/institucion/equipo");
  // El dashboard cuenta a las personas del equipo.
  revalidatePath("/institucion/dashboard");
}

function esViolacionUnica(e: unknown): boolean {
  const codigo = (e as { code?: string; cause?: { code?: string } })?.code ?? (e as { cause?: { code?: string } })?.cause?.code;
  return codigo === "23505";
}

/** Contexto común: sesión de la institución y permiso de gestión. */
async function gestor() {
  const { usuario, institucion } = await requerirInstitucion();
  const rol = await rolEnInstitucion(institucion, usuario.id);
  return { usuario, institucion, rol, permitido: esRolGestor(rol) };
}

/* ───────────────────────────── Invitar ───────────────────────────── */

export type InvitacionCreada = { id: string; email: string; rol: string };

/**
 * Crea la invitación: una membresía "invitado" con el email (en minúsculas) y el rol elegido. La persona se suma
 * cuando se registra con ESE email. No se puede invitar a quien ya está en el equipo ni a cuentas que no pueden
 * unirse (de docente, o que ya pertenecen a otra institución).
 */
export async function invitarMiembro(_previo: Resultado<InvitacionCreada> | null, formData: FormData): Promise<Resultado<InvitacionCreada>> {
  const { usuario, institucion, rol: rolDeQuienInvita, permitido } = await gestor();
  if (!permitido) return fallo(SOLO_GESTORES);

  const r = parsear(invitacionSchema, formData);
  if (!r.ok) return fallo(r.error, r.campos);
  const { email, rol } = r.data;

  if (email === usuario.email.toLowerCase()) {
    return fallo("Ese es tu propio email.", { email: "Ese es tu propio email: ya estás en el equipo." });
  }

  const db = getDb();
  const [yaEsta] = await db
    .select({ estado: institucionMiembros.estado })
    .from(institucionMiembros)
    .where(and(eq(institucionMiembros.institucionId, institucion.id), eq(sql`lower(${institucionMiembros.email})`, email)))
    .limit(1);
  if (yaEsta) {
    const mensaje =
      yaEsta.estado === "activo"
        ? "Esa persona ya forma parte del equipo."
        : "Ya invitaste a esa persona. Está en la tabla con la invitación pendiente.";
    return fallo(mensaje, { email: mensaje });
  }

  const [cuenta] = await db
    .select({ id: usuarios.id, rol: usuarios.rol })
    .from(usuarios)
    .where(eq(sql`lower(${usuarios.email})`, email))
    .limit(1);
  if (cuenta) {
    if (cuenta.rol !== "institucion") {
      const mensaje = "Ese email ya se usa en otro tipo de cuenta. Invitá a la persona con otro email.";
      return fallo(mensaje, { email: mensaje });
    }
    const [propia] = await db
      .select({ id: instituciones.id })
      .from(instituciones)
      .where(and(eq(instituciones.propietarioId, cuenta.id), ne(instituciones.id, institucion.id)))
      .limit(1);
    const [enOtra] = await db
      .select({ id: institucionMiembros.id })
      .from(institucionMiembros)
      .where(
        and(
          eq(institucionMiembros.usuarioId, cuenta.id),
          eq(institucionMiembros.estado, "activo"),
          ne(institucionMiembros.institucionId, institucion.id),
        ),
      )
      .limit(1);
    if (propia || enOtra) {
      const mensaje = "Esa persona ya pertenece a otra institución.";
      return fallo(mensaje, { email: mensaje });
    }
  }

  // Quién invita, para el mail: el dueño figura con el nombre de contacto de la institución; el resto, con su nombre en el equipo.
  const nombreDeQuienInvita =
    (rolDeQuienInvita === "dueno" ? institucion.contactoNombre : (await membresiaDeUsuario(institucion.id, usuario.id))?.nombre)?.trim() || null;

  let creada: { id: string } | undefined;
  try {
    // La invitación y el mail se anotan juntos: si falla una, no queda la otra.
    creada = await transaccion(async (tx) => {
      const [fila] = await tx
        .insert(institucionMiembros)
        .values({ institucionId: institucion.id, email, rol, estado: "invitado" })
        .returning({ id: institucionMiembros.id });
      await encolarCorreo(tx, {
        plantilla: "M06",
        datos: { institucion: institucion.nombre, rol: infoDeRol(rol).label, invitadoPor: nombreDeQuienInvita, email, ruta: "/registro" },
        para: email,
        topeClave: `M06:${institucion.id}`,
      });
      return fila;
    });
  } catch (e) {
    if (!esViolacionUnica(e)) throw e;
    const mensaje = "Esa persona ya está en el equipo o ya la invitaste.";
    return fallo(mensaje, { email: mensaje });
  }

  revalidarEquipo();
  return ok({ id: creada!.id, email, rol });
}

/* ───────────────────────────── Cambiar rol y quitar ───────────────────────────── */

/** Cambia el rol de alguien del equipo. El dueño es único: no se toca ni se puede asignar. */
export async function cambiarRolMiembro(miembroId: string, rol: string): Promise<Resultado> {
  const { institucion, permitido } = await gestor();
  if (!permitido) return fallo(SOLO_GESTORES);
  if (!esUuid(miembroId)) return fallo(miembroId === "propietario" ? DUENO_INTOCABLE : NO_ENCONTRADO);
  const nuevo = cambioRolSchema.safeParse({ rol });
  if (!nuevo.success) return fallo("Ese rol no existe.");

  const miembro = await miembroDeInstitucion(institucion.id, miembroId);
  if (!miembro) return fallo(NO_ENCONTRADO);
  if (miembro.rol === "dueno" || (miembro.usuarioId && miembro.usuarioId === institucion.propietarioId)) {
    return fallo(DUENO_INTOCABLE);
  }

  await getDb()
    .update(institucionMiembros)
    .set({ rol: nuevo.data.rol })
    .where(and(eq(institucionMiembros.id, miembro.id), eq(institucionMiembros.institucionId, institucion.id)));

  revalidarEquipo();
  return ok();
}

/** Saca a alguien del equipo (o cancela una invitación pendiente). No se puede quitar al dueño ni a uno mismo. */
export async function quitarMiembro(miembroId: string): Promise<Resultado> {
  const { usuario, institucion, permitido } = await gestor();
  if (!permitido) return fallo(SOLO_GESTORES);
  if (!esUuid(miembroId)) return fallo(miembroId === "propietario" ? DUENO_INTOCABLE : NO_ENCONTRADO);

  const miembro = await miembroDeInstitucion(institucion.id, miembroId);
  if (!miembro) return fallo(NO_ENCONTRADO);
  if (miembro.rol === "dueno" || (miembro.usuarioId && miembro.usuarioId === institucion.propietarioId)) {
    return fallo(DUENO_INTOCABLE);
  }
  if (miembro.usuarioId === usuario.id) return fallo("No podés quitarte a vos mismo del equipo.");

  await getDb()
    .delete(institucionMiembros)
    .where(and(eq(institucionMiembros.id, miembro.id), eq(institucionMiembros.institucionId, institucion.id)));

  revalidarEquipo();
  return ok();
}
