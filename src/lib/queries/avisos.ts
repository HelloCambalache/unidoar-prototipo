import "server-only";
import { eq } from "drizzle-orm";
import { notificaciones, usuarios, type EtapaPostulacion } from "@/db/schema";
import type { Ejecutor } from "@/lib/queries/pipeline";

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
