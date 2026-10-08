import "server-only";
import { and, asc, eq, isNull, ne, sql } from "drizzle-orm";
import { getDb, transaccion } from "@/db";
import {
  institucionMiembros,
  instituciones,
  usuarios,
  type Institucion,
  type Usuario,
} from "@/db/schema";
import { infoDeRol, nombreDeEmail, mesYAnio, puedeSumarseAlEquipo, type MiembroVista } from "@/lib/equipo";
import { avisarAVarios } from "@/lib/queries/avisos";
import { usuariosDeInstitucion } from "@/lib/queries/instituciones";
import type { Ejecutor } from "@/lib/queries/pipeline";
import { iniciales } from "@/lib/utils";

/** Id con el que llega a la pantalla el dueño de una cuenta que no tiene fila en `institucion_miembros`. */
export const ID_PROPIETARIO = "propietario";

/**
 * Personas del equipo para la tabla: primero el dueño, después el resto por antigüedad.
 * Si la cuenta tiene propietario pero no su fila de miembro (cuentas viejas), se arma a partir de la cuenta.
 */
export async function miembrosDeInstitucion(
  institucion: Pick<Institucion, "id" | "propietarioId" | "contactoNombre">,
  usuarioId: string,
): Promise<MiembroVista[]> {
  const db = getDb();
  const filas = await db
    .select()
    .from(institucionMiembros)
    .where(eq(institucionMiembros.institucionId, institucion.id))
    .orderBy(asc(institucionMiembros.creadoEn));

  const vistas: MiembroVista[] = filas.map((f) => {
    const nombre = f.nombre?.trim() || nombreDeEmail(f.email);
    return {
      id: f.id,
      nombre,
      email: f.email,
      rol: f.rol,
      estado: f.estado === "activo" ? "activo" : "invitado",
      desde: mesYAnio(f.creadoEn),
      esDueno: f.rol === "dueno",
      esYo: f.usuarioId === usuarioId,
      iniciales: iniciales(nombre),
    };
  });

  if (institucion.propietarioId && !vistas.some((m) => m.esDueno)) {
    const [dueno] = await db
      .select({ email: usuarios.email, creadoEn: usuarios.creadoEn })
      .from(usuarios)
      .where(eq(usuarios.id, institucion.propietarioId))
      .limit(1);
    if (dueno) {
      const nombre = institucion.contactoNombre?.trim() || nombreDeEmail(dueno.email);
      vistas.push({
        id: ID_PROPIETARIO,
        nombre,
        email: dueno.email,
        rol: "dueno",
        estado: "activo",
        desde: mesYAnio(dueno.creadoEn),
        esDueno: true,
        esYo: institucion.propietarioId === usuarioId,
        iniciales: iniciales(nombre),
      });
    }
  }

  return vistas.sort((a, b) => Number(b.esDueno) - Number(a.esDueno));
}

/** Rol de la cuenta dentro de la institución: "dueno" si la posee, el de su membresía activa, o null si no pertenece. */
export async function rolEnInstitucion(
  institucion: Pick<Institucion, "id" | "propietarioId">,
  usuarioId: string,
  ejecutor: Ejecutor = getDb(),
): Promise<string | null> {
  if (institucion.propietarioId === usuarioId) return "dueno";
  const [m] = await ejecutor
    .select({ rol: institucionMiembros.rol })
    .from(institucionMiembros)
    .where(
      and(
        eq(institucionMiembros.institucionId, institucion.id),
        eq(institucionMiembros.usuarioId, usuarioId),
        eq(institucionMiembros.estado, "activo"),
      ),
    )
    .limit(1);
  return m?.rol ?? null;
}

/**
 * La membresía, solo si es de la institución. Es la verificación de propiedad de las acciones del equipo:
 * un id que viene del cliente no se usa nunca sin pasar por acá.
 */
export async function miembroDeInstitucion(institucionId: string, miembroId: string, ejecutor: Ejecutor = getDb()) {
  const [fila] = await ejecutor
    .select()
    .from(institucionMiembros)
    .where(and(eq(institucionMiembros.id, miembroId), eq(institucionMiembros.institucionId, institucionId)))
    .limit(1);
  return fila ?? null;
}

/**
 * La invitación pendiente que abre el enlace del mail: para mostrar a qué institución y con qué rol se invitó, y con
 * qué email. Null si el id no existe, ya se usó (la persona se unió) o no es una invitación (el dueño).
 */
export async function invitacionPendiente(invitacionId: string) {
  const [fila] = await getDb()
    .select({
      id: institucionMiembros.id,
      email: institucionMiembros.email,
      rol: institucionMiembros.rol,
      institucion: { nombre: instituciones.nombre, suspendida: instituciones.suspendida },
    })
    .from(institucionMiembros)
    .innerJoin(instituciones, eq(instituciones.id, institucionMiembros.institucionId))
    .where(
      and(
        eq(institucionMiembros.id, invitacionId),
        eq(institucionMiembros.estado, "invitado"),
        isNull(institucionMiembros.usuarioId),
        ne(institucionMiembros.rol, "dueno"),
      ),
    )
    .limit(1);
  return fila && !fila.institucion.suspendida ? fila : null;
}

/**
 * La invitación pendiente que tiene un email (la más antigua): a qué institución y con qué rol lo invitaron. Sirve para pedirle
 * que acepte los términos antes de sumarse al equipo. Null si no hay ninguna.
 */
export async function invitacionDeEmail(email: string) {
  const [fila] = await getDb()
    .select({ rol: institucionMiembros.rol, institucion: { nombre: instituciones.nombre, suspendida: instituciones.suspendida } })
    .from(institucionMiembros)
    .innerJoin(instituciones, eq(instituciones.id, institucionMiembros.institucionId))
    .where(
      and(
        eq(sql`lower(${institucionMiembros.email})`, email.trim().toLowerCase()),
        eq(institucionMiembros.estado, "invitado"),
        isNull(institucionMiembros.usuarioId),
        ne(institucionMiembros.rol, "dueno"),
      ),
    )
    .orderBy(asc(institucionMiembros.creadoEn))
    .limit(1);
  return fila && !fila.institucion.suspendida ? { institucion: fila.institucion.nombre, rol: fila.rol } : null;
}

/** Datos de la membresía de una cuenta (para "Mi cuenta"). */
export async function membresiaDeUsuario(institucionId: string, usuarioId: string) {
  const [fila] = await getDb()
    .select()
    .from(institucionMiembros)
    .where(and(eq(institucionMiembros.institucionId, institucionId), eq(institucionMiembros.usuarioId, usuarioId)))
    .limit(1);
  return fila ?? null;
}

/**
 * Institución a la que la cuenta pertenece como miembro (no como dueña). Si ya es miembro activo, devuelve esa;
 * si no, busca una invitación pendiente hecha a su mismo email y la activa: la membresía pasa a "activo" con su
 * cuenta y se avisa al resto del equipo. Devuelve null si no tiene ninguna, o si todavía no aceptó los términos (en ese
 * caso el paso 2 del alta se los pide antes: ver `invitacionDeEmail`).
 *
 * No está cacheada a propósito: el paso 2 del alta la llama en el mismo request que crea la fila `usuarios`.
 * Las invitaciones se guardan con el email en minúsculas y se comparan sin distinguir mayúsculas.
 */
export async function institucionComoMiembro(
  usuario: Pick<Usuario, "id" | "email" | "rol" | "terminosAceptadosEn">,
  nombre?: string | null,
): Promise<Institucion | null> {
  if (usuario.rol !== "institucion") return null;
  const db = getDb();

  const activa = async () => {
    const [m] = await db
      .select({ institucion: instituciones })
      .from(institucionMiembros)
      .innerJoin(instituciones, eq(instituciones.id, institucionMiembros.institucionId))
      .where(and(eq(institucionMiembros.usuarioId, usuario.id), eq(institucionMiembros.estado, "activo")))
      .limit(1);
    return m?.institucion ?? null;
  };

  const yaMiembro = await activa();
  if (yaMiembro) return yaMiembro;
  if (!puedeSumarseAlEquipo(usuario)) return null;

  const email = usuario.email.trim().toLowerCase();
  const [pendiente] = await db
    .select({ miembro: institucionMiembros, institucion: instituciones })
    .from(institucionMiembros)
    .innerJoin(instituciones, eq(instituciones.id, institucionMiembros.institucionId))
    .where(
      and(
        eq(sql`lower(${institucionMiembros.email})`, email),
        isNull(institucionMiembros.usuarioId),
        eq(institucionMiembros.estado, "invitado"),
        ne(institucionMiembros.rol, "dueno"),
      ),
    )
    .orderBy(asc(institucionMiembros.creadoEn))
    .limit(1);
  if (!pendiente) return null;

  const destinatarios = (await usuariosDeInstitucion(pendiente.institucion.id)).filter((id) => id !== usuario.id);
  const nombreFinal = pendiente.miembro.nombre?.trim() || nombre?.trim() || nombreDeEmail(usuario.email);

  const activada = await transaccion(async (tx) => {
    const [fila] = await tx
      .update(institucionMiembros)
      .set({ usuarioId: usuario.id, estado: "activo", nombre: nombreFinal })
      .where(
        and(
          eq(institucionMiembros.id, pendiente.miembro.id),
          isNull(institucionMiembros.usuarioId),
          eq(institucionMiembros.estado, "invitado"),
        ),
      )
      .returning({ id: institucionMiembros.id });
    if (!fila) return false;
    await avisarAVarios(tx, destinatarios, {
      tipo: "sistema",
      titulo: nombreFinal,
      texto: `aceptó la invitación y se sumó al equipo como ${infoDeRol(pendiente.miembro.rol).label}.`,
      enlace: "/institucion/equipo",
    });
    return true;
  });

  // Si otra request la activó primero, ya figura como miembro activo.
  return activada ? pendiente.institucion : activa();
}
