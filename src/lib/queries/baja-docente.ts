import "server-only";
import { and, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  auditoria,
  colaCorreos,
  cvEnviados,
  docentes,
  favoritos,
  inscripcionesCurso,
  mensajesContacto,
  notificaciones,
  postulaciones,
  usuarios,
} from "@/db/schema";
import { fallo, ok, type Resultado } from "@/lib/acciones";
import { registrarAuditoria } from "@/lib/auditoria";
import { almacenamientoConfigurado } from "@/lib/almacenamiento";
import { confirmaElEmail, enLotes, impedimentoDeBaja, nombreParaBuscar, patronQueContiene } from "@/lib/baja-cuenta";
import type { Ejecutor } from "@/lib/queries/pipeline";
import { clienteAdmin } from "@/lib/supabase/admin";
import { BUCKETS } from "@/lib/subidas";

/*
 * Dar de baja a un profesional: borrar sus datos de verdad. Lo que se hace NO se puede deshacer, así que cada paso está acá
 * y no repartido: `borrarDatosDelProfesional` (la base, dentro de la transacción de la acción), después
 * `borrarArchivosDeLaCuenta` (Storage) y por último `borrarUsuarioDeAcceso` (Supabase Auth). Primero la base, porque es donde
 * están los datos personales; si un paso posterior falla, no queda nada de la persona en la base y el equipo termina a mano lo
 * que falte (la acción se lo dice).
 */

const NO_ENCONTRADO = "No encontramos a ese profesional.";

/** Lo que se va a llevar la baja, para mostrarlo antes de confirmar. */
export type ResumenDeBaja = { postulaciones: number; cvEnviados: number; inscripciones: number };

export const ACCION_BAJA_PROCESADA = "cuenta.baja_procesada";
/** Se anota cuando la base ya quedó limpia pero un paso posterior (archivos o usuario de acceso) no se pudo hacer. */
export const ACCION_BAJA_INCOMPLETA = "cuenta.baja_incompleta";

/** Cuánto se lleva la baja de este profesional (la base o la transacción que se pase). */
export async function resumenParaBaja(docenteId: string, ejecutor: Ejecutor = getDb()): Promise<ResumenDeBaja> {
  const n = sql<number>`count(*)`.mapWith(Number);
  const [[p], [c], [i]] = await Promise.all([
    ejecutor.select({ n }).from(postulaciones).where(eq(postulaciones.docenteId, docenteId)),
    ejecutor.select({ n }).from(cvEnviados).where(eq(cvEnviados.docenteId, docenteId)),
    ejecutor.select({ n }).from(inscripcionesCurso).where(eq(inscripcionesCurso.docenteId, docenteId)),
  ]);
  return { postulaciones: p?.n ?? 0, cvEnviados: c?.n ?? 0, inscripciones: i?.n ?? 0 };
}

/** Lo que quedó borrado de la base, para la auditoría (solo números: nada de datos personales). */
export type DetalleDeBaja = ResumenDeBaja & { favoritos: number; avisos: number; correos: number; mensajes: number; buscadoPorNombre: boolean };

/**
 * Borra de la base todo lo del profesional, dentro de la transacción de la acción: relee y bloquea su fila, valida la
 * confirmación (el email de la cuenta), y borra el perfil con todo lo que cuelga de él (postulaciones y las notas que las
 * instituciones escribieron, CV enviados, inscripciones a cursos, datos y documentos), los avisos y mails que lo nombran, los
 * mensajes que mandó por Contacto y su usuario. De la auditoría borra el detalle de lo que se anotó sobre él (nombre, email) y
 * deja una entrada nueva con la baja, sin datos personales.
 */
export async function borrarDatosDelProfesional(
  tx: Ejecutor,
  adminId: string,
  docenteId: string,
  confirmacion: string,
): Promise<Resultado<{ usuarioId: string; detalle: DetalleDeBaja; archivosDeExamen: string[] }>> {
  const [docente] = await tx
    .select({ id: docentes.id, usuarioId: docentes.usuarioId, nombre: docentes.nombre, apellido: docentes.apellido, email: docentes.email, esDemo: docentes.esDemo })
    .from(docentes)
    .where(eq(docentes.id, docenteId))
    .limit(1)
    .for("update");
  if (!docente) return fallo(NO_ENCONTRADO);

  const [cuenta] = docente.usuarioId
    ? await tx.select({ id: usuarios.id, email: usuarios.email, rol: usuarios.rol }).from(usuarios).where(eq(usuarios.id, docente.usuarioId)).limit(1)
    : [];
  const impedimento = impedimentoDeBaja({
    rol: cuenta?.rol ?? null,
    esDemo: docente.esDemo,
    tieneCuenta: Boolean(cuenta),
    esElMismoAdmin: cuenta?.id === adminId,
  });
  if (impedimento || !cuenta) return fallo(impedimento ?? NO_ENCONTRADO);
  if (!confirmaElEmail(confirmacion, cuenta.email)) {
    return fallo("El email no coincide.", { confirmacion: `Escribí exactamente ${cuenta.email} para confirmar.` });
  }

  const resumen = await resumenParaBaja(docenteId, tx);
  // Los estudios del examen preocupacional que las instituciones guardaron sobre sus postulaciones (dato de salud): viven en la
  // carpeta de la institución, no en la de ella, así que se anotan ahora y se borran de Storage después.
  const conExamen = await tx
    .select({ archivos: postulaciones.examenPreocupacionalArchivos })
    .from(postulaciones)
    .where(eq(postulaciones.docenteId, docenteId));
  const archivosDeExamen = conExamen.flatMap((p) => p.archivos.map((a) => a.path));
  const nombre = nombreParaBuscar(docente.nombre, docente.apellido);
  const emails = [...new Set([cuenta.email, docente.email].filter((e): e is string => Boolean(e)).map((e) => e.toLowerCase()))];

  // Avisos (a la institución, al equipo) que nombran a la persona o llevan a su ficha.
  const avisos = await tx
    .delete(notificaciones)
    .where(
      or(
        sql`${notificaciones.enlace} like ${patronQueContiene(docenteId)}`,
        ...(nombre ? [ilike(notificaciones.titulo, patronQueContiene(nombre)), ilike(notificaciones.texto, patronQueContiene(nombre))] : []),
      ),
    )
    .returning({ id: notificaciones.id });

  // Mails en cola o ya enviados: a ella, o que la nombran (los que llegan a una institución o al equipo).
  const correos = await tx
    .delete(colaCorreos)
    .where(
      or(
        eq(colaCorreos.usuarioId, cuenta.id),
        inArray(sql`lower(${colaCorreos.para})`, emails),
        // El mensaje que mandó por Contacto vive también en el mail al equipo (M60), con su email adentro de `datos`.
        inArray(sql`lower(${colaCorreos.datos}->>'email')`, emails),
        sql`${colaCorreos.datos}::text like ${patronQueContiene(docenteId)}`,
        ...(nombre ? [sql`${colaCorreos.datos}::text ilike ${patronQueContiene(nombre)}`] : []),
      ),
    )
    .returning({ id: colaCorreos.id });

  const mensajes = await tx
    .delete(mensajesContacto)
    .where(inArray(sql`lower(${mensajesContacto.email})`, emails))
    .returning({ id: mensajesContacto.id });

  // Las instituciones que la guardaron como favorita (no hay una clave foránea que lo borre solo).
  const guardada = await tx
    .delete(favoritos)
    .where(and(eq(favoritos.tipo, "docente"), eq(favoritos.refId, docenteId)))
    .returning({ ref: favoritos.refId });

  // Lo que el equipo anotó sobre ella (verificaciones, suspensiones, el pedido de baja) lleva su nombre y su email adentro:
  // queda qué se hizo, cuándo y quién, sin esos datos.
  // También lo que se anotó sobre su cuenta (por ejemplo el cambio de email, que guarda los dos emails) y lo que ella misma hizo.
  await tx
    .update(auditoria)
    .set({ detalle: null })
    .where(
      or(
        and(eq(auditoria.entidad, "docente"), eq(auditoria.entidadId, docenteId)),
        and(eq(auditoria.entidad, "usuario"), eq(auditoria.entidadId, cuenta.id)),
        eq(auditoria.usuarioId, cuenta.id),
      ),
    );

  // El perfil y, en cascada, postulaciones (con sus notas), CV enviados, inscripciones y datos personales.
  await tx.delete(docentes).where(eq(docentes.id, docenteId));
  // La fila de la cuenta y, en cascada, sus avisos y favoritos. El usuario de acceso (Auth) se borra después.
  await tx.delete(usuarios).where(eq(usuarios.id, cuenta.id));

  const detalle: DetalleDeBaja = {
    ...resumen,
    favoritos: guardada.length,
    avisos: avisos.length,
    correos: correos.length,
    mensajes: mensajes.length,
    buscadoPorNombre: nombre !== null,
  };
  await registrarAuditoria(
    { usuarioId: adminId, accion: ACCION_BAJA_PROCESADA, entidad: "docente", entidadId: docenteId, detalle },
    tx,
  );
  return ok({ usuarioId: cuenta.id, detalle, archivosDeExamen });
}

/** Todos los archivos de un bucket bajo un prefijo, bajando por las carpetas (`<usuario>/<carpeta>/<archivo>`). */
async function listarArchivos(bucket: string, prefijo: string): Promise<string[]> {
  const supabase = clienteAdmin();
  const paths: string[] = [];
  for (let desde = 0; ; desde += 100) {
    const { data, error } = await supabase.storage.from(bucket).list(prefijo, { limit: 100, offset: desde });
    if (error) throw new Error(`No pude listar "${bucket}/${prefijo}": ${error.message}`);
    for (const item of data) {
      const ruta = `${prefijo}/${item.name}`;
      // Las carpetas vienen sin id; los archivos, con metadata.
      if (item.id === null) paths.push(...(await listarArchivos(bucket, ruta)));
      else paths.push(ruta);
    }
    if (data.length < 100) return paths;
  }
}

/**
 * Borra de Storage TODO lo que subió la cuenta (`<usuarioId>/…` en los dos buckets: foto, CV, documentos y subidas a medio
 * confirmar) y los estudios del examen preocupacional que las instituciones guardaron sobre ella. Va después de la base. Devuelve cuántos archivos borró y si algo falló (en ese caso quedan huérfanos y los barre
 * `pnpm db:limpiar-archivos`, que ya no los encuentra en ninguna fila).
 */
export async function borrarArchivosDeLaCuenta(usuarioId: string, archivosDeExamen: string[] = []): Promise<{ borrados: number; completo: boolean }> {
  if (!almacenamientoConfigurado()) return { borrados: 0, completo: true };
  let borrados = 0;
  let completo = true;
  for (const bucket of BUCKETS) {
    try {
      const paths = await listarArchivos(bucket, usuarioId);
      // Los estudios médicos de sus postulaciones están en el bucket privado, en la carpeta de la institución.
      if (bucket === "privado") paths.push(...archivosDeExamen);
      for (const lote of enLotes(paths, 100)) {
        const { error } = await clienteAdmin().storage.from(bucket).remove(lote);
        if (error) {
          completo = false;
          console.error(`[baja] no se pudo borrar de "${bucket}":`, error.message);
        } else borrados += lote.length;
      }
    } catch (error) {
      completo = false;
      console.error(`[baja] no se pudieron listar los archivos de "${bucket}"`, error);
    }
  }
  return { borrados, completo };
}

/** Borra el usuario de acceso en Supabase Auth: sin él, la persona ya no puede iniciar sesión con ese email ni con Google. */
export async function borrarUsuarioDeAcceso(usuarioId: string): Promise<boolean> {
  try {
    const { error } = await clienteAdmin().auth.admin.deleteUser(usuarioId);
    if (error) {
      console.error("[baja] no se pudo borrar el usuario de acceso:", error.message);
      return false;
    }
    return true;
  } catch (error) {
    console.error("[baja] no se pudo borrar el usuario de acceso", error);
    return false;
  }
}
