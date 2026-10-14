"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { transaccion } from "@/db";
import { fallo, ok, parsear, type Resultado } from "@/lib/acciones";
import { registrarAuditoria } from "@/lib/auditoria";
import { requerirUsuario } from "@/lib/auth";
import { esUuid } from "@/lib/busquedas";
import { borrarArchivosDeLaCuenta, borrarUsuarioDeAcceso, ACCION_BAJA_INCOMPLETA } from "@/lib/queries/baja-docente";
import { borrarDatosDeCuentaSinTerminar } from "@/lib/queries/cuentas-sin-terminar";

/*
 * Cuentas que nunca terminaron el alta (pantalla "Altas sin terminar" del backoffice). Solo admin; no se confía en nada del cliente.
 */

const NO_ENCONTRADA = "No encontramos esa cuenta.";

const borrarSchema = z.object({ confirmacion: z.string().trim().min(1, "Escribí el email de la cuenta para confirmar.") });

/**
 * Borra de verdad una cuenta que no terminó el alta (y no se puede deshacer): sus datos en la base, sus archivos de Storage y su
 * usuario de acceso. Exige escribir el email de la cuenta y que hayan pasado al menos 24 horas desde que se registró. Primero la base
 * (en una transacción, con la auditoría), después Storage y Supabase Auth: si alguno de esos dos falla, la base ya quedó limpia y se lo
 * dice a quien la procesa para que termine a mano.
 */
export async function borrarCuentaSinTerminar(cuentaId: string, entrada: { confirmacion: string }): Promise<Resultado<{ pendientes: string[] }>> {
  const admin = await requerirUsuario("admin");
  if (!esUuid(cuentaId)) return fallo(NO_ENCONTRADA);
  const datos = parsear(borrarSchema, typeof entrada === "object" && entrada !== null ? entrada : {});
  if (!datos.ok) return fallo(datos.campos?.confirmacion ?? datos.error, datos.campos);

  const hecho = await transaccion((tx) => borrarDatosDeCuentaSinTerminar(tx, admin.id, cuentaId, datos.data.confirmacion));
  if (!hecho.ok) return hecho;

  // La base ya está limpia. Lo que sigue es Storage y el usuario de acceso: no se deshace lo anterior si algo falla.
  const archivos = await borrarArchivosDeLaCuenta(hecho.data.usuarioId, hecho.data.archivosDeExamen);
  const acceso = await borrarUsuarioDeAcceso(hecho.data.usuarioId);
  const pendientes: string[] = [];
  if (!archivos.completo) pendientes.push("No se pudieron borrar todos sus archivos de Storage: corré pnpm db:limpiar-archivos --borrar.");
  if (!acceso) pendientes.push("No se pudo borrar su usuario de acceso: borralo desde Supabase → Authentication → Users.");
  if (pendientes.length > 0) {
    await registrarAuditoria({
      usuarioId: admin.id,
      accion: ACCION_BAJA_INCOMPLETA,
      entidad: "usuario",
      entidadId: hecho.data.usuarioId,
      detalle: { archivosCompletos: archivos.completo, accesoBorrado: acceso },
    });
  }

  revalidatePath("/backoffice/altas-sin-terminar");
  revalidatePath("/backoffice/docentes");
  return ok({ pendientes });
}
