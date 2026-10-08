import "server-only";
import { and, eq, gt, inArray, isNotNull, ne } from "drizzle-orm";
import { docentes, notificaciones, postulaciones, usuarios, type EtapaPostulacion } from "@/db/schema";
import { textoDeCierreDeBusqueda } from "@/lib/postulaciones";
import type { Ejecutor } from "@/lib/queries/pipeline";
import { docenteVisible } from "@/lib/visibilidad";

type Aviso = { tipo: string; titulo: string; texto: string; enlace?: string };

/**
 * Igual que `notificar()` (queries/notificaciones.ts) pero sobre el ejecutor que se le pase,
 * para que el aviso viva en la misma transacción que el cambio que lo origina.
 */
export async function avisar(ejecutor: Ejecutor, usuarioId: string | null | undefined, aviso: Aviso) {
  if (!usuarioId) return;
  await ejecutor.insert(notificaciones).values({ usuarioId, ...aviso });
}

/** Una misma notificación para muchas cuentas, en un solo INSERT. */
export async function avisarAVarios(ejecutor: Ejecutor, usuarioIds: string[], aviso: Aviso) {
  if (usuarioIds.length === 0) return;
  await ejecutor.insert(notificaciones).values(usuarioIds.map((usuarioId) => ({ usuarioId, ...aviso })));
}

/** Una notificación para todas las cuentas admin (el equipo de UNIDOAR), en la misma transacción que el cambio. */
export async function avisarAAdmins(ejecutor: Ejecutor, aviso: { titulo: string; texto: string; enlace: string }) {
  const admins = await ejecutor.select({ id: usuarios.id }).from(usuarios).where(eq(usuarios.rol, "admin"));
  await avisarAVarios(ejecutor, admins.map((a) => a.id), { tipo: "sistema", ...aviso });
}

/**
 * La institución cerró una búsqueda: avisa en la campanita (NO por mail) a todos los que estaban en ella, menos a quien ya
 * fue contratado, que ya se enteró. Solo a quienes tienen cuenta y no están suspendidos. Si la búsqueda se cierra, se reabre
 * y se vuelve a cerrar en el día, no repite el aviso. Corre en la misma transacción que el cierre. Devuelve a cuántos avisó.
 */
export async function avisarCierreDeBusqueda(
  ejecutor: Ejecutor,
  b: { busquedaId: string; puesto: string; institucionNombre: string },
): Promise<number> {
  const filas = await ejecutor
    .select({ usuarioId: docentes.usuarioId, origen: postulaciones.origen })
    .from(postulaciones)
    .innerJoin(docentes, eq(docentes.id, postulaciones.docenteId))
    .where(and(eq(postulaciones.busquedaId, b.busquedaId), ne(postulaciones.etapa, "contratado"), isNotNull(docentes.usuarioId), docenteVisible));
  if (filas.length === 0) return 0;

  const textoInvitado = textoDeCierreDeBusqueda(b.puesto, true);
  const textoPostulante = textoDeCierreDeBusqueda(b.puesto, false);
  const ids = [...new Set(filas.map((f) => f.usuarioId!))];
  const yaAvisados = await ejecutor
    .select({ usuarioId: notificaciones.usuarioId, texto: notificaciones.texto })
    .from(notificaciones)
    .where(
      and(
        inArray(notificaciones.usuarioId, ids),
        eq(notificaciones.titulo, b.institucionNombre),
        inArray(notificaciones.texto, [textoInvitado, textoPostulante]),
        gt(notificaciones.creadoEn, new Date(Date.now() - 24 * 3_600_000)),
      ),
    );
  const repetidos = new Set(yaAvisados.map((n) => `${n.usuarioId}|${n.texto}`));

  const nuevas = filas
    .map((f) => ({ usuarioId: f.usuarioId!, texto: f.origen === "invitacion" ? textoInvitado : textoPostulante }))
    .filter((n) => !repetidos.has(`${n.usuarioId}|${n.texto}`))
    .map((n) => ({ ...n, tipo: "postulacion", titulo: b.institucionNombre, enlace: "/docente/oportunidades" }));
  if (nuevas.length === 0) return 0;
  await ejecutor.insert(notificaciones).values(nuevas);
  return nuevas.length;
}

/** Qué le decimos al docente cuando la institución lo cambia de etapa. Null = no vale la pena avisar. */
export function avisoDeEtapa(etapa: EtapaPostulacion, puesto: string): { tipo: string; texto: string } | null {
  switch (etapa) {
    case "preseleccionados":
      return { tipo: "postulacion", texto: `te preseleccionó para «${puesto}».` };
    case "entrevista":
      return { tipo: "entrevista", texto: `te pasó a la etapa de entrevista en «${puesto}».` };
    case "oferta":
      return { tipo: "postulacion", texto: `te envió una oferta para «${puesto}».` };
    case "contratado":
      return { tipo: "postulacion", texto: `te eligió para «${puesto}». ¡Felicitaciones!` };
    case "descartado":
      return { tipo: "postulacion", texto: `actualizó tu postulación a «${puesto}»: por ahora no seguirá en el proceso.` };
    default:
      return null;
  }
}
