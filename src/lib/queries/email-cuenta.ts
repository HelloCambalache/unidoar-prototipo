import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { transaccion } from "@/db";
import { docentes, institucionMiembros, usuarios, type Usuario } from "@/db/schema";
import { registrarAuditoria } from "@/lib/auditoria";
import { resumenDeError } from "@/lib/errores";

/**
 * Pone al día lo que la app copió del email de la cuenta cuando la persona lo cambió en Supabase Auth (confirmando
 * el enlace del mail): `usuarios.email`, el email de contacto del perfil de docente si era el mismo, y el de sus
 * membresías de equipo. Devuelve la fila actualizada, o null si no se pudo (queda como estaba y se reintenta en
 * el próximo pedido). Es seguro correrla varias veces a la vez: solo la primera encuentra el email viejo.
 */
export async function sincronizarEmailDeCuenta(fila: Usuario, emailNuevo: string): Promise<Usuario | null> {
  const nuevo = emailNuevo.trim().toLowerCase();
  const viejo = fila.email.toLowerCase();
  try {
    return await transaccion(async (tx) => {
      const [actualizado] = await tx
        .update(usuarios)
        .set({ email: nuevo })
        .where(and(eq(usuarios.id, fila.id), sql`lower(${usuarios.email}) = ${viejo}`))
        .returning();
      // Otro pedido ya lo hizo: no se repite nada (ni la auditoría).
      if (!actualizado) return null;
      await tx
        .update(docentes)
        .set({ email: nuevo })
        .where(and(eq(docentes.usuarioId, fila.id), sql`lower(${docentes.email}) = ${viejo}`));
      await tx
        .update(institucionMiembros)
        .set({ email: nuevo })
        .where(and(eq(institucionMiembros.usuarioId, fila.id), sql`lower(${institucionMiembros.email}) = ${viejo}`));
      await registrarAuditoria(
        { usuarioId: fila.id, accion: "cuenta.cambio_email", entidad: "usuario", entidadId: fila.id, detalle: { de: viejo, a: nuevo } },
        tx,
      );
      return actualizado;
    });
  } catch (e) {
    console.error("No se pudo poner al día el email de la cuenta", resumenDeError(e));
    return null;
  }
}
