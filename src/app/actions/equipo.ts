"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, ne, sql } from "drizzle-orm";
import { getDb, transaccion } from "@/db";
import { institucionMiembros, instituciones, usuarios } from "@/db/schema";
import { fallo, ok, parsear, type Resultado } from "@/lib/acciones";
import { requerirInstitucion } from "@/lib/auth";
import { esUuid } from "@/lib/busquedas";
import { encolarCorreo } from "@/lib/correo/cola";
import {
  cambioRolSchema,
  corteDeInvitaciones,
  esRolGestor,
  infoDeRol,
  invitacionSchema,
  invitacionVencida,
  motivoDeTopeDeEquipo,
  rutaDeInvitacion,
} from "@/lib/equipo";
import { avisarAVarios } from "@/lib/queries/avisos";
import { membresiaDeUsuario, miembroDeInstitucion, rolEnInstitucion } from "@/lib/queries/equipo";
import { usuariosDeInstitucion } from "@/lib/queries/instituciones";
import { crearTope } from "@/lib/tope";

/*
 * Equipo de la institución. Invitar, cambiar el rol y quitar gente es cosa del dueño y de los administradores;
 * cada acción lo verifica acá (no alcanza con esconder los botones). Invitar crea la membresía con estado "invitado"

 * y le manda un mail con el enlace de la invitación, `/invitacion/<id>` (si el envío está encendido; si no, el panel muestra
 * el enlace para copiar). La persona se suma al registrarse con ese mismo email y **aceptar** la invitación en el paso 2 del alta (ver
 * `sumarseAlEquipo` en src/lib/queries/equipo.ts): una invitación nunca se activa sola y vence a los 30 días.
 */

const SOLO_GESTORES = "Solo el dueño y los administradores pueden manejar el equipo.";
const NO_ENCONTRADO = "No encontramos a esa persona en el equipo.";
const DUENO_INTOCABLE = "El dueño de la cuenta no se puede degradar ni eliminar.";

/**
 * Intentos de invitar por institución y hora (cuentan también los que terminan en error): las respuestas de `invitarMiembro` distinguen
 * si un email es de un profesional o de otra institución, y sin un tope servían para ir probando emails de a miles. Vive en la memoria
 * de la instancia: frena un bucle, no es exacto con varias instancias.
 */
const permitirIntentoDeInvitar = crearTope(30, 60 * 60 * 1000);

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
  if (!permitirIntentoDeInvitar(institucion.id)) return fallo("Hiciste muchos intentos de invitar seguidos. Esperá un rato y probá de nuevo.");

  const r = parsear(invitacionSchema, formData);
  if (!r.ok) return fallo(r.error, r.campos);
  const { email, rol } = r.data;

  if (email === usuario.email.toLowerCase()) {
    return fallo("Ese es tu propio email.", { email: "Ese es tu propio email: ya estás en el equipo." });
  }

  const db = getDb();
  const [yaEsta] = await db
    .select({ id: institucionMiembros.id, estado: institucionMiembros.estado, creadoEn: institucionMiembros.creadoEn })
    .from(institucionMiembros)
    .where(and(eq(institucionMiembros.institucionId, institucion.id), eq(sql`lower(${institucionMiembros.email})`, email)))
    .limit(1);
  // Una invitación que venció sin que la acepten se puede volver a mandar: se reemplaza por la nueva.
  const vencida = Boolean(yaEsta && yaEsta.estado !== "activo" && invitacionVencida(yaEsta.creadoEn));
  if (yaEsta && vencida) {
    await db
      .delete(institucionMiembros)
      .where(and(eq(institucionMiembros.id, yaEsta.id), eq(institucionMiembros.institucionId, institucion.id), eq(institucionMiembros.estado, "invitado")));
  }
  if (yaEsta && !vencida) {
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

  const [conteo] = await db
    .select({
      activos: sql<number>`count(*) filter (where ${institucionMiembros.estado} = 'activo')`.mapWith(Number),
      // Las invitaciones vencidas no cuentan para el tope: ya no pueden aceptarse.
      pendientes:
        sql<number>`count(*) filter (where ${institucionMiembros.estado} = 'invitado' and ${institucionMiembros.creadoEn} > ${corteDeInvitaciones().toISOString()}::timestamptz)`.mapWith(
          Number,
        ),
    })
    .from(institucionMiembros)
    .where(eq(institucionMiembros.institucionId, institucion.id));
  const tope = motivoDeTopeDeEquipo(conteo?.activos ?? 0, conteo?.pendientes ?? 0);
  if (tope) return fallo(tope);

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
        datos: { institucion: institucion.nombre, rol: infoDeRol(rol).label, invitadoPor: nombreDeQuienInvita, email, ruta: rutaDeInvitacion(fila!.id) },
        para: email,
        topeClave: `M06:${email}`,
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

/* ───────────────────────────── Salir del equipo ───────────────────────────── */

/**
 * Quien es miembro de un equipo (no el dueño) puede salir por su cuenta desde Mi cuenta: se borra su membresía, se avisa al resto del
 * equipo y vuelve al paso 2 del alta, donde puede crear su propia institución. No borra su cuenta de acceso. El dueño no puede salir:
 * si quiere cerrar la institución, pide la baja.
 */
export async function salirDelEquipo(): Promise<Resultado> {
  const { usuario, institucion } = await requerirInstitucion();
  if (institucion.propietarioId === usuario.id) {
    return fallo("El dueño de la cuenta no puede salir del equipo. Si querés cerrar la institución, pedí la baja desde Mi cuenta.");
  }
  const membresia = await membresiaDeUsuario(institucion.id, usuario.id);
  if (!membresia || membresia.estado !== "activo" || membresia.rol === "dueno") return fallo("No formás parte de este equipo.");

  const destinatarios = (await usuariosDeInstitucion(institucion.id)).filter((id) => id !== usuario.id);
  const nombre = membresia.nombre?.trim() || membresia.email;
  await transaccion(async (tx) => {
    await tx
      .delete(institucionMiembros)
      .where(and(eq(institucionMiembros.id, membresia.id), eq(institucionMiembros.usuarioId, usuario.id)));
    await avisarAVarios(tx, destinatarios, { tipo: "sistema", titulo: nombre, texto: "salió del equipo.", enlace: "/institucion/equipo" });
  });

  revalidatePath("/institucion", "layout");
  redirect("/onboarding/institucion/2");
}
