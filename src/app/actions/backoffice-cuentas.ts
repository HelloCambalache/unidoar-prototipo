"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb, transaccion } from "@/db";
import { fallo, ok, parsear, type Resultado } from "@/lib/acciones";
import { registrarAuditoria } from "@/lib/auditoria";
import { requerirUsuario } from "@/lib/auth";
import { esUuid } from "@/lib/busquedas";
import { reenviarConfirmacion } from "@/app/actions/auth";
import { encolarVariosCorreos } from "@/lib/correo/cola";
import { modoCorreo } from "@/lib/correo/config";
import {
  MAX_CONFIRMACIONES_POR_ENVIO,
  MAX_RECORDATORIOS_POR_ENVIO,
  SIN_AVISOS,
  cupoDeAvisosDeHoy,
  impedimentoDeAvisar,
  tipoDeAvisoDeAlta,
  type TipoDeAviso,
} from "@/lib/cuentas-sin-terminar";
import { borrarArchivosDeLaCuenta, borrarUsuarioDeAcceso, ACCION_BAJA_INCOMPLETA } from "@/lib/queries/baja-docente";
import {
  ACCION_CONFIRMACION_REENVIADA,
  ACCION_RECORDATORIO_DE_ALTA,
  avisosDeLasUltimas24Horas,
  borrarDatosDeCuentaSinTerminar,
  cuentasParaAvisar,
  historialDeAvisosDe,
  type CuentaParaAvisar,
} from "@/lib/queries/cuentas-sin-terminar";

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

/* ───────────────────────── Avisos para que terminen el registro (2026-11-18) ───────────────────────── */

export type ResultadoDeAvisos = {
  /** A cuántas se les mandó (o se les pidió mandar: el mail sale en unos segundos). */
  enviados: number;
  /** Cuántas de las elegidas no correspondían. */
  rechazadas: number;
  /** Por qué no correspondían, sin repetir. */
  motivos: string[];
  /** Si el envío se cortó a la mitad (por ejemplo, Supabase limitó los mails de acceso): qué dijo. */
  corte: string | null;
};

const PIDE_ELEGIR = "Elegí al menos una cuenta.";

/** Los ids que llegan de la pantalla: una lista de uuid sin repetir y no más larga que el tope del clic. Todo lo demás se rechaza. */
function idsDeCuentas(entrada: unknown, maximo: number): Resultado<string[]> {
  if (!Array.isArray(entrada) || entrada.length === 0) return fallo(PIDE_ELEGIR);
  const ids = [...new Set(entrada.filter((x): x is string => typeof x === "string" && esUuid(x)))];
  if (ids.length === 0) return fallo(PIDE_ELEGIR);
  if (ids.length > maximo) return fallo(`Elegí hasta ${maximo} cuentas por vez.`);
  return ok(ids);
}

/**
 * De las cuentas elegidas, a cuáles se les puede mandar ESTE tipo de aviso ahora: las relee (con las mismas condiciones de la lista), aplica
 * las reglas (24 horas, máximo por persona, días entre avisos) y el cupo del día. Devuelve a quiénes sí y por qué no a las demás.
 */
async function aQuienesAvisar(ids: string[], tipo: TipoDeAviso, adminId: string) {
  const db = getDb();
  const ahora = new Date();
  const [cuentas, historial, yaHoy] = await Promise.all([cuentasParaAvisar(db, ids), historialDeAvisosDe(db, ids), avisosDeLasUltimas24Horas(db)]);
  const motivos: string[] = [];
  const quedan: (CuentaParaAvisar & { numeroDeAviso: number })[] = [];

  const encontradas = new Set(cuentas.map((c) => c.id));
  for (const id of ids) if (!encontradas.has(id)) motivos.push("Ya no figura en la lista: terminó el alta o se borró.");

  for (const c of cuentas) {
    if (tipoDeAvisoDeAlta(c) !== tipo) {
      motivos.push(tipo === "recordatorio" ? "No confirmó el mail: se le reenvía la confirmación." : "Ya confirmó el mail: le corresponde el recordatorio.");
      continue;
    }
    const previo = historial.get(c.id) ?? SIN_AVISOS;
    const impedimento = impedimentoDeAvisar(
      { rol: c.rol, tieneAltaCompleta: false, esDemo: false, creadaEn: c.creadaEn, ahora, esElMismoAdmin: c.id === adminId },
      previo,
    );
    if (impedimento) motivos.push(impedimento);
    else quedan.push({ ...c, numeroDeAviso: previo.cantidad + 1 });
  }

  const cupo = cupoDeAvisosDeHoy(yaHoy);
  const aEnviar = quedan.slice(0, cupo);
  if (quedan.length > aEnviar.length) motivos.push("Se llegó al tope de avisos de hoy: probá mañana con el resto.");
  return { aEnviar, motivos: [...new Set(motivos)], rechazadas: ids.length - aEnviar.length };
}

/**
 * Manda a las cuentas elegidas un mail (M69) para que terminen el registro. Solo a quienes ya confirmaron el mail: a los demás se les reenvía
 * la confirmación (`reenviarConfirmacionesDeAlta`). Máximo `MAX_RECORDATORIOS_POR_ENVIO` por clic; dos avisos por persona, una semana entre uno y
 * otro, y un tope por día. Cada uno queda en la auditoría sobre la cuenta (sin su email).
 */
export async function enviarRecordatoriosDeAlta(cuentaIds: string[]): Promise<Resultado<ResultadoDeAvisos>> {
  const admin = await requerirUsuario("admin");
  const ids = idsDeCuentas(cuentaIds, MAX_RECORDATORIOS_POR_ENVIO);
  if (!ids.ok) return ids;
  if (modoCorreo() === "apagado") return fallo("El envío de mails está apagado: no se puede mandar nada.");

  const { aEnviar, motivos, rechazadas } = await aQuienesAvisar(ids.data, "recordatorio", admin.id);
  if (aEnviar.length > 0) {
    await transaccion(async (tx) => {
      await encolarVariosCorreos(
        tx,
        aEnviar.map((c) => ({
          plantilla: "M69" as const,
          datos: { rol: c.rol },
          para: c.email,
          usuarioId: c.enUsuarios ? c.id : null,
          // La misma clave no se anota dos veces: apretar dos veces el botón, o un mail ya pedido, no repite el aviso.
          clave: `M69:${c.id}:${c.numeroDeAviso}`,
          topeClave: "M69",
        })),
        { tandas: Math.ceil(MAX_RECORDATORIOS_POR_ENVIO / 15) },
      );
      for (const c of aEnviar) {
        await registrarAuditoria(
          { usuarioId: admin.id, accion: ACCION_RECORDATORIO_DE_ALTA, entidad: "usuario", entidadId: c.id, detalle: { rol: c.rol, numeroDeAviso: c.numeroDeAviso } },
          tx,
        );
      }
    });
  }
  revalidatePath("/backoffice/altas-sin-terminar");
  return ok({ enviados: aEnviar.length, rechazadas, motivos, corte: null });
}

/**
 * Reenvía el mail de confirmación a quienes se registraron y nunca confirmaron su email (es el mismo mail de siempre, con su enlace). Máximo
 * `MAX_CONFIRMACIONES_POR_ENVIO` por clic porque Supabase limita cuántos mails de acceso salen por hora: si corta, se frena y se dice cuántas salieron.
 */
export async function reenviarConfirmacionesDeAlta(cuentaIds: string[]): Promise<Resultado<ResultadoDeAvisos>> {
  const admin = await requerirUsuario("admin");
  const ids = idsDeCuentas(cuentaIds, MAX_CONFIRMACIONES_POR_ENVIO);
  if (!ids.ok) return ids;

  const { aEnviar, motivos, rechazadas } = await aQuienesAvisar(ids.data, "confirmacion", admin.id);
  let enviados = 0;
  let corte: string | null = null;
  for (const c of aEnviar) {
    const r = await reenviarConfirmacion(c.rol, c.email);
    if (!r.ok) {
      corte = r.error;
      break;
    }
    enviados += 1;
    await registrarAuditoria({ usuarioId: admin.id, accion: ACCION_CONFIRMACION_REENVIADA, entidad: "usuario", entidadId: c.id, detalle: { rol: c.rol, numeroDeAviso: c.numeroDeAviso } });
  }
  revalidatePath("/backoffice/altas-sin-terminar");
  return ok({ enviados, rechazadas: rechazadas + (aEnviar.length - enviados), motivos, corte });
}
