"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { transaccion } from "@/db";
import type { Usuario } from "@/db/schema";
import { fallo, ok, parsear, type Resultado } from "@/lib/acciones";
import { registrarAuditoria } from "@/lib/auditoria";
import { requerirUsuario } from "@/lib/auth";
import { aplicarResolucionConMotivo, aplicarVerificacion } from "@/lib/backoffice-docentes-escrituras";
import { esUuid } from "@/lib/busquedas";

/*
 * Cola de verificación de identidad y antecedentes. Las tres acciones arrancan por requerirUsuario("admin"),
 * validan la entrada con Zod y no confían en nada del cliente: el estado se relee y se cambia dentro de una
 * transacción (src/lib/backoffice-docentes-escrituras.ts) que también avisa al docente y deja la auditoría.
 */

const NO_ENCONTRADO = "No encontramos a ese profesional.";

/** Pantallas que muestran el estado de verificación, del lado del equipo y del docente. */
function revalidarVerificacion(docenteId: string) {
  revalidatePath("/backoffice/verificacion");
  revalidatePath("/backoffice/docentes");
  revalidatePath(`/backoffice/docentes/${docenteId}`);
  revalidatePath("/backoffice/operacion");
  revalidatePath("/docente", "layout");
}

const motivoSchema = z.object({
  motivo: z
    .string()
    .trim()
    .min(5, "Contale qué tiene que corregir (mínimo 5 caracteres).")
    .max(500, "El motivo puede tener hasta 500 caracteres."),
});

const verificarSchema = z.object({
  identidad: z.literal(true, { error: "Confirmá que revisaste el DNI." }),
  titulo: z.boolean(),
  antecedentes: z.boolean(),
});

/**
 * Verifica al docente: la identidad es obligatoria; título y antecedentes según lo que se revisó.
 * Limpia la nota de corrección, marca cuándo se revisó y le avisa.
 */
export async function verificarDocente(
  docenteId: string,
  entrada: { identidad: boolean; titulo: boolean; antecedentes: boolean },
): Promise<Resultado> {
  const admin = await requerirUsuario("admin");
  if (!esUuid(docenteId)) return fallo(NO_ENCONTRADO);
  const datos = parsear(verificarSchema, entrada);
  if (!datos.ok) return fallo(datos.campos?.identidad ?? datos.error, datos.campos);

  const resultado = await transaccion(async (tx): Promise<Resultado> => {
    const r = await aplicarVerificacion(tx, docenteId, { titulo: datos.data.titulo, antecedentes: datos.data.antecedentes });
    if (!r.ok) return r;
    await registrarAuditoria(
      { usuarioId: admin.id, accion: "docente.verificar", entidad: "docente", entidadId: docenteId, detalle: r.data },
      tx,
    );
    return ok();
  });
  if (resultado.ok) revalidarVerificacion(docenteId);
  return resultado;
}

async function resolverConMotivo(
  admin: Usuario,
  docenteId: string,
  entrada: { motivo: string },
  destino: "correccion" | "rechazado",
): Promise<Resultado> {
  if (!esUuid(docenteId)) return fallo(NO_ENCONTRADO);
  const datos = parsear(motivoSchema, entrada);
  if (!datos.ok) return fallo(datos.campos?.motivo ?? datos.error, datos.campos);

  const resultado = await transaccion(async (tx): Promise<Resultado> => {
    const r = await aplicarResolucionConMotivo(tx, docenteId, destino, datos.data.motivo);
    if (!r.ok) return r;
    await registrarAuditoria(
      {
        usuarioId: admin.id,
        accion: destino === "correccion" ? "docente.pedir_correccion" : "docente.rechazar",
        entidad: "docente",
        entidadId: docenteId,
        detalle: r.data,
      },
      tx,
    );
    return ok();
  });
  if (resultado.ok) revalidarVerificacion(docenteId);
  return resultado;
}

/** Deja el perfil en «Corrección pedida» con el motivo para el docente. Sigue en la cola hasta que lo corrija. */
export async function pedirCorreccion(docenteId: string, entrada: { motivo: string }): Promise<Resultado> {
  const admin = await requerirUsuario("admin");
  return resolverConMotivo(admin, docenteId, entrada, "correccion");
}

/** Rechaza la verificación con el motivo. El docente puede escribir al equipo desde su aviso. */
export async function rechazarDocente(docenteId: string, entrada: { motivo: string }): Promise<Resultado> {
  const admin = await requerirUsuario("admin");
  return resolverConMotivo(admin, docenteId, entrada, "rechazado");
}
