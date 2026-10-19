import "server-only";
import { and, count, eq, inArray, isNotNull, or, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  auditoria,
  busquedas,
  codigosReferido,
  colaCorreos,
  contactosInstitucion,
  cursos,
  cvEnviados,
  facturas,
  favoritos,
  institucionFotos,
  institucionMiembros,
  institucionNovedades,
  institucionSedes,
  instituciones,
  mensajesContacto,
  notificaciones,
  postulaciones,
  referidosInstituciones,
  solicitudesPlan,
  usuarios,
} from "@/db/schema";
import { fallo, ok, type Resultado } from "@/lib/acciones";
import { registrarAuditoria } from "@/lib/auditoria";
import { almacenamientoConfigurado } from "@/lib/almacenamiento";
import { confirmaElTexto, cuentasDelEquipoParaBorrar, enLotes, impedimentoDeBajaDeInstitucion, patronQueContiene, slugDeBaja } from "@/lib/baja-cuenta";
import { clienteAdmin } from "@/lib/supabase/admin";
import type { Ejecutor } from "@/lib/queries/pipeline";

/*
 * Dar de baja a una institución. A diferencia de la baja de un profesional (src/lib/queries/baja-docente.ts, que borra todo), acá
 * se CONSERVA lo que hay que guardar por razones fiscales: el registro mínimo de la institución (nombre, tipo, CUIT, condición
 * fiscal y domicilio) y sus facturas. Todo lo demás se borra de verdad: su equipo y las cuentas de acceso, sus búsquedas con las
 * postulaciones, los cursos, los contactos privados, el perfil público, las sedes (menos el domicilio de la principal) y los
 * archivos. No se puede deshacer. La institución queda con `suspendida = true` y `baja_en` con la fecha, y nunca se reactiva.
 *
 * Los pasos van en este orden: la base (en la transacción de la acción), después Storage y por último los usuarios de Supabase
 * Auth. Si un paso posterior falla, la base ya quedó limpia y el equipo termina a mano lo que falte (la acción se lo dice).
 */

const NO_ENCONTRADA = "No encontramos esa institución.";

export const ACCION_BAJA_DE_INSTITUCION = "cuenta.baja_procesada";
export const ACCION_BAJA_DE_INSTITUCION_INCOMPLETA = "cuenta.baja_incompleta";

/** Lo que se va a llevar la baja (y lo que se conserva), para mostrarlo antes de confirmar. */
export type ResumenDeBajaInstitucion = {
  busquedas: number;
  postulaciones: number;
  cursos: number;
  contactos: number;
  /** Personas del equipo (con cuenta o solo invitadas). */
  equipo: number;
  facturas: number;
  /** Facturas sin pagar: quedan registradas, la deuda no se borra. */
  facturasImpagas: number;
};

export async function resumenParaBajaDeInstitucion(institucionId: string, ejecutor: Ejecutor = getDb()): Promise<ResumenDeBajaInstitucion> {
  const n = count();
  const [[b], [p], [c], [k], [e], [f], [i]] = await Promise.all([
    ejecutor.select({ n }).from(busquedas).where(eq(busquedas.institucionId, institucionId)),
    ejecutor
      .select({ n })
      .from(postulaciones)
      .innerJoin(busquedas, eq(busquedas.id, postulaciones.busquedaId))
      .where(eq(busquedas.institucionId, institucionId)),
    ejecutor.select({ n }).from(cursos).where(eq(cursos.institucionId, institucionId)),
    ejecutor.select({ n }).from(contactosInstitucion).where(eq(contactosInstitucion.institucionId, institucionId)),
    ejecutor.select({ n }).from(institucionMiembros).where(eq(institucionMiembros.institucionId, institucionId)),
    ejecutor.select({ n }).from(facturas).where(eq(facturas.institucionId, institucionId)),
    ejecutor.select({ n }).from(facturas).where(and(eq(facturas.institucionId, institucionId), sql`${facturas.estado} <> 'pagada'`)),
  ]);
  return {
    busquedas: b?.n ?? 0,
    postulaciones: p?.n ?? 0,
    cursos: c?.n ?? 0,
    contactos: k?.n ?? 0,
    equipo: e?.n ?? 0,
    facturas: f?.n ?? 0,
    facturasImpagas: i?.n ?? 0,
  };
}

/** Lo que quedó borrado de la base, para la auditoría (solo números: nada de datos personales). */
export type DetalleDeBajaInstitucion = ResumenDeBajaInstitucion & {
  cuentas: number;
  avisos: number;
  correos: number;
  mensajes: number;
  favoritos: number;
};

export type BajaHecha = {
  /** Cuentas de acceso a borrar de Storage y de Supabase Auth después de confirmar la base. */
  cuentasABorrar: string[];
  /** Imágenes públicas (logo, portada, galería, fotos de cursos): ya no las usa ninguna fila. */
  imagenes: string[];
  /** Estudios del examen preocupacional (dato de salud) que la institución guardó sobre sus postulantes. */
  archivosDeExamen: string[];
  detalle: DetalleDeBajaInstitucion;
};

/** Una expresión regular (de Postgres) que encuentra cualquiera de estos uuid; solo letras, números y guiones: no hace falta escaparlos. */
const algunUuid = (ids: string[]) => ids.join("|");

/**
 * Borra de la base todo lo de la institución salvo el registro fiscal, dentro de la transacción de la acción: relee y bloquea su fila,
 * valida (`impedimentoDeBajaDeInstitucion`) y la confirmación (el nombre de la institución), y deja una entrada de auditoría sin datos
 * personales. De la auditoría anterior borra el detalle de lo anotado sobre la institución y su equipo.
 */
export async function borrarDatosDeLaInstitucion(
  tx: Ejecutor,
  adminId: string,
  institucionId: string,
  confirmacion: string,
): Promise<Resultado<BajaHecha>> {
  const [inst] = await tx
    .select({
      id: instituciones.id,
      slug: instituciones.slug,
      nombre: instituciones.nombre,
      esDemo: instituciones.esDemo,
      bajaEn: instituciones.bajaEn,
      propietarioId: instituciones.propietarioId,
      logoUrl: instituciones.logoUrl,
      portadaUrl: instituciones.portadaUrl,
    })
    .from(instituciones)
    .where(eq(instituciones.id, institucionId))
    .limit(1)
    .for("update");
  if (!inst) return fallo(NO_ENCONTRADA);

  const impedimento = impedimentoDeBajaDeInstitucion({ esDemo: inst.esDemo, yaDeBaja: inst.bajaEn !== null });
  if (impedimento) return fallo(impedimento);
  if (!confirmaElTexto(confirmacion, inst.nombre)) {
    return fallo("El nombre no coincide.", { confirmacion: `Escribí exactamente ${inst.nombre} para confirmar.` });
  }

  const resumen = await resumenParaBajaDeInstitucion(institucionId, tx);

  // Quiénes son: la dueña y el equipo (con cuenta o solo invitado). Sus emails sirven para encontrar sus mails y mensajes.
  const miembros = await tx
    .select({ usuarioId: institucionMiembros.usuarioId, email: institucionMiembros.email })
    .from(institucionMiembros)
    .where(eq(institucionMiembros.institucionId, institucionId));
  const idsDeCuentas = [...new Set([inst.propietarioId, ...miembros.map((m) => m.usuarioId)].filter((id): id is string => Boolean(id)))];
  const cuentas = idsDeCuentas.length
    ? await tx.select({ id: usuarios.id, email: usuarios.email, rol: usuarios.rol }).from(usuarios).where(inArray(usuarios.id, idsDeCuentas))
    : [];
  const cuentasABorrar = cuentasDelEquipoParaBorrar(cuentas, adminId);
  const emails = [...new Set([...miembros.map((m) => m.email), ...cuentas.map((c) => c.email)].filter(Boolean).map((e) => e.toLowerCase()))];

  // Lo que hay que borrar de Storage después: se anota ahora, antes de que las filas desaparezcan.
  const [fotos, fotosDeCursos, conExamen, lasBusquedas] = await Promise.all([
    tx.select({ url: institucionFotos.url }).from(institucionFotos).where(eq(institucionFotos.institucionId, institucionId)),
    tx
      .select({ url: cursos.fotoUrl })
      .from(cursos)
      .where(and(eq(cursos.institucionId, institucionId), isNotNull(cursos.fotoUrl))),
    tx
      .select({ archivos: postulaciones.examenPreocupacionalArchivos })
      .from(postulaciones)
      .innerJoin(busquedas, eq(busquedas.id, postulaciones.busquedaId))
      .where(eq(busquedas.institucionId, institucionId)),
    tx.select({ id: busquedas.id }).from(busquedas).where(eq(busquedas.institucionId, institucionId)),
  ]);
  const imagenes = [inst.logoUrl, inst.portadaUrl, ...fotos.map((f) => f.url), ...fotosDeCursos.map((c) => c.url)].filter((u): u is string => Boolean(u));
  const archivosDeExamen = conExamen.flatMap((p) => p.archivos.map((a) => a.path));
  const idsDeBusquedas = lasBusquedas.map((b) => b.id);

  /* ── Avisos que llevan a la institución o a sus búsquedas (a profesionales, al equipo de UNIDOAR). Los del propio equipo se van con sus cuentas. ── */
  const caminosDeLaInstitucion = [`/docente/instituciones/${inst.slug}`, `/instituciones/${inst.slug}`];
  const avisos = await tx
    .delete(notificaciones)
    .where(
      or(
        sql`${notificaciones.enlace} like ${patronQueContiene(institucionId)}`,
        inArray(notificaciones.enlace, caminosDeLaInstitucion),
        ...(idsDeBusquedas.length ? [sql`${notificaciones.enlace} ~ ${algunUuid(idsDeBusquedas)}`] : []),
      ),
    )
    .returning({ id: notificaciones.id });

  /* ── Mails en cola o ya enviados: al equipo de la institución o que la nombran. ── */
  const correos = await tx
    .delete(colaCorreos)
    .where(
      or(
        ...(cuentasABorrar.length ? [inArray(colaCorreos.usuarioId, cuentasABorrar)] : []),
        ...(emails.length
          ? [
              inArray(sql`lower(${colaCorreos.para})`, emails),
              // El mensaje que alguien del equipo mandó por Contacto vive también en el mail al equipo (M60), con su email adentro.
              inArray(sql`lower(${colaCorreos.datos}->>'email')`, emails),
            ]
          : []),
        sql`${colaCorreos.datos}::text like ${patronQueContiene(institucionId)}`,
        // Los que traen el nombre de la institución como dato propio ("institucion": "Colegio X"): igualdad exacta, no "contiene".
        sql`lower(${colaCorreos.datos}->>'institucion') = ${inst.nombre.trim().toLowerCase()}`,
        sql`lower(${colaCorreos.datos}->>'cuenta') = ${inst.nombre.trim().toLowerCase()}`,
      ),
    )
    .returning({ id: colaCorreos.id });

  const mensajes = emails.length
    ? await tx.delete(mensajesContacto).where(inArray(sql`lower(${mensajesContacto.email})`, emails)).returning({ id: mensajesContacto.id })
    : [];

  // Quienes la guardaron como favorita y las búsquedas guardadas (no hay una clave foránea que lo borre solo).
  const guardadas = await tx
    .delete(favoritos)
    .where(
      or(
        and(eq(favoritos.tipo, "institucion"), eq(favoritos.refId, institucionId)),
        ...(idsDeBusquedas.length ? [and(eq(favoritos.tipo, "busqueda"), inArray(favoritos.refId, idsDeBusquedas))] : []),
      ),
    )
    .returning({ ref: favoritos.refId });

  // Lo que el equipo de UNIDOAR anotó sobre la institución (suspensiones, cambios de plan, el pedido de baja) lleva su nombre y el
  // de sus datos adentro; y lo que hizo su equipo (el cambio de email guarda los dos emails): queda qué, cuándo y quién, sin esos datos.
  await tx
    .update(auditoria)
    .set({ detalle: null })
    .where(
      or(
        and(eq(auditoria.entidad, "institucion"), eq(auditoria.entidadId, institucionId)),
        ...(cuentasABorrar.length
          ? [and(eq(auditoria.entidad, "usuario"), inArray(auditoria.entidadId, cuentasABorrar)), inArray(auditoria.usuarioId, cuentasABorrar)]
          : []),
      ),
    );

  /* ── Lo que cuelga de la institución: se borra todo menos las facturas. ── */
  await tx.delete(busquedas).where(eq(busquedas.institucionId, institucionId)); // y en cascada, postulaciones y sus notas
  await tx.delete(cursos).where(eq(cursos.institucionId, institucionId)); // y en cascada, inscripciones
  await tx.delete(cvEnviados).where(eq(cvEnviados.institucionId, institucionId));
  await tx.delete(contactosInstitucion).where(eq(contactosInstitucion.institucionId, institucionId));
  await tx.delete(institucionNovedades).where(eq(institucionNovedades.institucionId, institucionId));
  await tx.delete(institucionFotos).where(eq(institucionFotos.institucionId, institucionId));
  await tx.delete(solicitudesPlan).where(eq(solicitudesPlan.institucionId, institucionId));
  // Su código de referidos y las recomendaciones de las dos puntas (las que hizo y la que la trajo): el registro que queda es solo lo fiscal.
  await tx
    .delete(referidosInstituciones)
    .where(or(eq(referidosInstituciones.referidorId, institucionId), eq(referidosInstituciones.referidoId, institucionId)));
  await tx.delete(codigosReferido).where(eq(codigosReferido.institucionId, institucionId));
  await tx.delete(institucionMiembros).where(eq(institucionMiembros.institucionId, institucionId));
  // De las sedes queda solo la principal, con el domicilio (el de los comprobantes): sin ubicación en el mapa ni CUE.
  await tx.delete(institucionSedes).where(and(eq(institucionSedes.institucionId, institucionId), eq(institucionSedes.esPrincipal, false)));
  await tx
    .update(institucionSedes)
    .set({ zona: null, lat: null, lng: null, cue: null })
    .where(eq(institucionSedes.institucionId, institucionId));

  // El registro de la institución queda mínimo: nombre, tipo, CUIT, condición fiscal y domicilio, más el plan y el día de cobro que
  // explican sus facturas. Sin dueña, sin enlace público con su nombre, suspendida para siempre.
  await tx
    .update(instituciones)
    .set({
      slug: slugDeBaja(institucionId),
      propietarioId: null,
      contactoNombre: null,
      contactoRol: null,
      telefono: null,
      cue: null,
      fundada: null,
      zona: null,
      lat: null,
      lng: null,
      logoUrl: null,
      portadaUrl: null,
      descripcion: null,
      alumnos: null,
      niveles: null,
      turnos: null,
      docentesPlanta: null,
      mision: null,
      vision: null,
      valores: [],
      horarioAdministracion: null,
      medioPago: null,
      verificada: false,
      suspendida: true,
      bajaEn: new Date(),
    })
    .where(eq(instituciones.id, institucionId));

  // Las cuentas de acceso del equipo y, en cascada, sus avisos y favoritos. Los usuarios de Supabase Auth se borran después.
  if (cuentasABorrar.length) await tx.delete(usuarios).where(inArray(usuarios.id, cuentasABorrar));

  const detalle: DetalleDeBajaInstitucion = {
    ...resumen,
    cuentas: cuentasABorrar.length,
    avisos: avisos.length,
    correos: correos.length,
    mensajes: mensajes.length,
    favoritos: guardadas.length,
  };
  await registrarAuditoria(
    { usuarioId: adminId, accion: ACCION_BAJA_DE_INSTITUCION, entidad: "institucion", entidadId: institucionId, detalle },
    tx,
  );
  return ok({ cuentasABorrar, imagenes, archivosDeExamen, detalle });
}

/** Borra de Storage estos paths del bucket privado (de a cien). Devuelve si pudo con todos. */
export async function borrarPathsPrivados(paths: string[]): Promise<boolean> {
  if (paths.length === 0 || !almacenamientoConfigurado()) return true;
  let completo = true;
  for (const lote of enLotes(paths, 100)) {
    const { error } = await clienteAdmin().storage.from("privado").remove(lote);
    if (error) {
      completo = false;
      console.error("[baja-institucion] no se pudo borrar de \"privado\":", error.message);
    }
  }
  return completo;
}
