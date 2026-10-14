import "server-only";
import { and, eq, inArray, or, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { auditoria, colaCorreos, docentes, institucionMiembros, instituciones, mensajesContacto, usuarios } from "@/db/schema";
import { fallo, ok, type Resultado } from "@/lib/acciones";
import { registrarAuditoria } from "@/lib/auditoria";
import { confirmaElEmail } from "@/lib/baja-cuenta";
import { HORAS_MINIMAS_SIN_TERMINAR, impedimentoDeBorrarCuentaSinTerminar } from "@/lib/cuentas-sin-terminar";
import type { EjecutorBo } from "@/lib/queries/backoffice-instituciones";
import { borrarDatosDelProfesional } from "@/lib/queries/baja-docente";

/*
 * Cuentas que nunca terminaron el alta: las que eligieron un rol y no siguieron (o empezaron el perfil y lo dejaron) y las que
 * se registraron y nunca entraron (solo existen en el acceso de Supabase). No tienen "Mi cuenta" desde donde pedir la baja y la lista
 * de profesionales del backoffice solo muestra altas completas, así que el equipo las ve y las borra desde "Altas sin terminar".
 */

const NO_ENCONTRADA = "No encontramos esa cuenta.";
/** Cuántas se muestran de cada lista (las más nuevas primero entre las que ya pasaron el tiempo mínimo). */
const LIMITE_DE_LISTA = 100;

export type CuentaSinTerminar = {
  id: string;
  email: string;
  /** El rol que eligió, o su pista si solo existe en el acceso; null si no se sabe. */
  rol: "docente" | "institucion" | null;
  creadaEn: Date;
  /** Si confirmó su mail (solo se sabe de quienes no tienen fila de usuario). */
  confirmoElMail: boolean | null;
  /** Empezó a llenar su perfil de profesional. */
  perfilEmpezado: boolean;
  /** Tiene fila en `usuarios` (eligió un rol); si no, solo existe en el acceso. */
  enUsuarios: boolean;
};

export type ListaDeCuentasSinTerminar = {
  conUsuario: CuentaSinTerminar[];
  totalConUsuario: number;
  soloAcceso: CuentaSinTerminar[];
  totalSoloAcceso: number;
};

const comoRol = (v: unknown): "docente" | "institucion" | null => (v === "docente" || v === "institucion" ? v : null);

/** Con fila en `usuarios` pero sin una alta completa: ni perfil de profesional terminado, ni institución propia, ni equipo. */
const SIN_ALTA = sql`u.rol in ('docente', 'institucion')
  and not exists (select 1 from docentes d where d.usuario_id = u.id and d.onboarding_completo)
  and not exists (select 1 from instituciones i where i.propietario_id = u.id)
  and not exists (select 1 from institucion_miembros m where m.usuario_id = u.id)
  and not exists (select 1 from docentes d where d.usuario_id = u.id and d.es_demo)`;

/** Las cuentas sin terminar que ya pasaron el tiempo mínimo (de lo contrario puede ser alguien completando el alta ahora mismo). */
export async function listarCuentasSinTerminar(db: EjecutorBo = getDb()): Promise<ListaDeCuentasSinTerminar> {
  const horas = sql.raw(String(HORAS_MINIMAS_SIN_TERMINAR));

  const [conUsuario, [totalU], soloAcceso, [totalA]] = await Promise.all([
    db.execute(sql`
      select u.id, u.email, u.rol, u.creado_en,
             exists (select 1 from docentes d where d.usuario_id = u.id) as perfil_empezado
      from usuarios u
      where ${SIN_ALTA} and u.creado_en < now() - make_interval(hours => ${horas})
      order by u.creado_en desc
      limit ${LIMITE_DE_LISTA}`),
    db.execute(sql`select count(*)::int as n from usuarios u where ${SIN_ALTA} and u.creado_en < now() - make_interval(hours => ${horas})`),
    db.execute(sql`
      select a.id, a.email, a.created_at as creado_en, (a.email_confirmed_at is not null) as confirmado,
             a.raw_user_meta_data->>'rol' as rol
      from auth.users a
      where not exists (select 1 from usuarios u where u.id = a.id)
        and a.email is not null
        and a.created_at < now() - make_interval(hours => ${horas})
      order by a.created_at desc
      limit ${LIMITE_DE_LISTA}`),
    db.execute(sql`
      select count(*)::int as n from auth.users a
      where not exists (select 1 from usuarios u where u.id = a.id) and a.email is not null
        and a.created_at < now() - make_interval(hours => ${horas})`),
  ]);

  return {
    conUsuario: (conUsuario as unknown as Record<string, unknown>[]).map((f) => ({
      id: String(f.id),
      email: String(f.email),
      rol: comoRol(f.rol),
      creadaEn: new Date(String(f.creado_en)),
      confirmoElMail: null,
      perfilEmpezado: Boolean(f.perfil_empezado),
      enUsuarios: true,
    })),
    totalConUsuario: Number((totalU as unknown as { n: number } | undefined)?.n ?? 0),
    soloAcceso: (soloAcceso as unknown as Record<string, unknown>[]).map((f) => ({
      id: String(f.id),
      email: String(f.email),
      rol: comoRol(f.rol),
      creadaEn: new Date(String(f.creado_en)),
      confirmoElMail: Boolean(f.confirmado),
      perfilEmpezado: false,
      enUsuarios: false,
    })),
    totalSoloAcceso: Number((totalA as unknown as { n: number } | undefined)?.n ?? 0),
  };
}

export type CuentaSinTerminarBorrada = { usuarioId: string; archivosDeExamen: string[] };

/**
 * Borra de la base todo lo de una cuenta que no terminó el alta, dentro de la transacción de la acción: relee y bloquea, valida
 * (`impedimentoDeBorrarCuentaSinTerminar` y la confirmación con el email) y borra. Si la persona había empezado su perfil de profesional,
 * lo borra con todo lo que tenga (DNI, documentos…) como la baja de un profesional; si no, solo su fila de usuario, sus avisos, mails y
 * mensajes. Lo que sigue (archivos de Storage y el usuario de acceso) lo hace la acción después de confirmar.
 */
export async function borrarDatosDeCuentaSinTerminar(
  tx: EjecutorBo,
  adminId: string,
  cuentaId: string,
  confirmacion: string,
  ahora: Date = new Date(),
): Promise<Resultado<CuentaSinTerminarBorrada>> {
  const [usuario] = await tx
    .select({ id: usuarios.id, email: usuarios.email, rol: usuarios.rol, creadoEn: usuarios.creadoEn })
    .from(usuarios)
    .where(eq(usuarios.id, cuentaId))
    .limit(1)
    .for("update");
  const acceso = ((await tx.execute(sql`select email, created_at from auth.users where id = ${cuentaId}`)) as unknown as { email: string | null; created_at: string }[])[0];
  const email = usuario?.email ?? acceso?.email ?? null;
  if (!email) return fallo(NO_ENCONTRADA);
  // La fecha de registro es la del acceso (la de la fila de usuario es de cuando eligió el rol, más tarde). Si no hay una fecha válida
  // no se la toma por antigua: se cuenta como de ahora y no se puede borrar todavía.
  const delAcceso = acceso?.created_at ? new Date(acceso.created_at) : null;
  const creadaEn = delAcceso && !Number.isNaN(delAcceso.getTime()) ? delAcceso : (usuario?.creadoEn ?? ahora);

  const [perfil] = await tx
    .select({ id: docentes.id, completo: docentes.onboardingCompleto, esDemo: docentes.esDemo })
    .from(docentes)
    .where(eq(docentes.usuarioId, cuentaId))
    .limit(1);
  const [propia] = await tx.select({ id: instituciones.id }).from(instituciones).where(eq(instituciones.propietarioId, cuentaId)).limit(1);
  const [miembro] = await tx.select({ id: institucionMiembros.id }).from(institucionMiembros).where(eq(institucionMiembros.usuarioId, cuentaId)).limit(1);

  const impedimento = impedimentoDeBorrarCuentaSinTerminar({
    rol: usuario?.rol ?? null,
    tieneAltaCompleta: Boolean(perfil?.completo) || Boolean(propia) || Boolean(miembro),
    esDemo: Boolean(perfil?.esDemo),
    creadaEn,
    ahora,
    esElMismoAdmin: cuentaId === adminId,
  });
  if (impedimento) return fallo(impedimento);
  if (!confirmaElEmail(confirmacion, email)) {
    return fallo("El email no coincide.", { confirmacion: `Escribí exactamente ${email} para confirmar.` });
  }

  // Empezó su perfil de profesional (hay datos suyos): se borra como en la baja de un profesional.
  if (perfil) {
    const hecho = await borrarDatosDelProfesional(tx, adminId, perfil.id, confirmacion);
    if (!hecho.ok) return hecho;
    return ok({ usuarioId: hecho.data.usuarioId, archivosDeExamen: hecho.data.archivosDeExamen });
  }

  const minusculas = email.toLowerCase();
  await tx
    .delete(colaCorreos)
    .where(or(eq(colaCorreos.usuarioId, cuentaId), sql`lower(${colaCorreos.para}) = ${minusculas}`, sql`lower(${colaCorreos.datos}->>'email') = ${minusculas}`));
  await tx.delete(mensajesContacto).where(sql`lower(${mensajesContacto.email}) = ${minusculas}`);
  // Lo anotado sobre la cuenta (el cambio de email guarda los dos emails) pierde el detalle; queda qué, cuándo y quién.
  await tx
    .update(auditoria)
    .set({ detalle: null })
    .where(or(and(eq(auditoria.entidad, "usuario"), eq(auditoria.entidadId, cuentaId)), eq(auditoria.usuarioId, cuentaId)));
  // La fila de usuario y, en cascada, sus avisos y favoritos. El usuario de acceso (Auth) se borra después.
  if (usuario) await tx.delete(usuarios).where(inArray(usuarios.id, [cuentaId]));

  await registrarAuditoria(
    {
      usuarioId: adminId,
      accion: "cuenta.sin_terminar_borrada",
      entidad: "usuario",
      entidadId: cuentaId,
      detalle: { conFilaDeUsuario: Boolean(usuario) },
    },
    tx,
  );
  return ok({ usuarioId: cuentaId, archivosDeExamen: [] });
}
