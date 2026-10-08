import "server-only";
import { eq } from "drizzle-orm";
import { docenteDetalle, docentes } from "@/db/schema";
import { fallo, ok, type Resultado } from "@/lib/acciones";
import { VERIFICACION_BO } from "@/lib/backoffice-docentes";
import { encolarParaUsuarios } from "@/lib/correo/cola";
import { avisar } from "@/lib/queries/avisos";
import type { Ejecutor } from "@/lib/queries/pipeline";

/*
 * Los cambios de estado de un docente que hace el equipo (verificar, pedir corrección, rechazar, suspender y
 * reactivar). Cada función corre DENTRO de la transacción que abre la server action: relee el estado con el
 * registro bloqueado (dos personas del equipo no se pisan), cambia y avisa al docente. Devuelven el detalle que la
 * acción anota en la auditoría, en esa misma transacción. No es un módulo "use server": las acciones
 * (src/app/actions/backoffice-*.ts) son quienes exigen rol admin y validan la entrada antes de llamar acá.
 */

type Detalle = Record<string, unknown>;

const NO_ENCONTRADO = "No encontramos a ese docente.";
const ENLACE_PERFIL = "/docente/perfil";
const AVISO_DE = "UNIDOAR";

const unir = (xs: string[]) => (xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}`);

type EnCola =
  | { error: ReturnType<typeof fallo>; docente?: undefined }
  | { error?: undefined; docente: { id: string; usuarioId: string | null; nombre: string; verificacion: "pendiente" | "correccion" } };

/** El docente bloqueado para escribir, siempre que siga en la cola (alta completa y pendiente o con corrección pedida). */
async function docenteEnCola(tx: Ejecutor, docenteId: string): Promise<EnCola> {
  const [d] = await tx
    .select({
      id: docentes.id,
      usuarioId: docentes.usuarioId,
      nombre: docentes.nombre,
      verificacion: docentes.verificacion,
      onboardingCompleto: docentes.onboardingCompleto,
    })
    .from(docentes)
    .where(eq(docentes.id, docenteId))
    .limit(1)
    .for("update");
  if (!d) return { error: fallo(NO_ENCONTRADO) };
  if (!d.onboardingCompleto) return { error: fallo("Este docente todavía no terminó el alta.") };
  if (d.verificacion !== "pendiente" && d.verificacion !== "correccion") {
    return { error: fallo(`Este perfil ya figura como «${VERIFICACION_BO[d.verificacion].etiqueta}». Actualizá la pantalla.`) };
  }
  return { docente: { id: d.id, usuarioId: d.usuarioId, nombre: d.nombre, verificacion: d.verificacion } };
}

/**
 * `verificacion = 'verificado'` y, según lo que se revisó, título y antecedentes. Si el DNI no está cargado en la
 * plataforma igual se verifica (quien revisa pudo comprobarlo por otro medio), pero la auditoría anota qué faltaba.
 */
export async function aplicarVerificacion(
  tx: Ejecutor,
  docenteId: string,
  revisado: { titulo: boolean; antecedentes: boolean },
): Promise<Resultado<Detalle>> {
  const cola = await docenteEnCola(tx, docenteId);
  if (cola.error) return cola.error;
  const { docente } = cola;

  const [detalle] = await tx
    .select({ documentos: docenteDetalle.documentos })
    .from(docenteDetalle)
    .where(eq(docenteDetalle.docenteId, docente.id))
    .limit(1);
  const docs = detalle?.documentos ?? {};
  const sinDocumento = [
    ...(docs.dniFrente && docs.dniDorso ? [] : ["dni"]),
    ...(revisado.titulo && !docs.credencial ? ["credencial"] : []),
    ...(revisado.antecedentes && !docs.conducta ? ["conducta"] : []),
  ];

  await tx
    .update(docentes)
    .set({
      verificacion: "verificado",
      tituloVerificado: revisado.titulo,
      antecedentesVerificados: revisado.antecedentes,
      verificacionNota: null,
      verificacionRevisadaEn: new Date(),
    })
    .where(eq(docentes.id, docente.id));

  const queSeVerifico = [
    "tu identidad",
    ...(revisado.titulo ? ["tu título o credencial"] : []),
    ...(revisado.antecedentes ? ["tu certificado de buena conducta"] : []),
  ];
  await avisar(tx, docente.usuarioId, {
    tipo: "verificacion",
    titulo: AVISO_DE,
    texto: `verificó ${unir(queSeVerifico)}. Tu perfil ya figura como verificado para las instituciones.`,
    enlace: ENLACE_PERFIL,
  });
  await encolarParaUsuarios(tx, docente.usuarioId ? [docente.usuarioId] : [], "M11", { nombre: docente.nombre });
  return ok({ estadoAnterior: docente.verificacion, titulo: revisado.titulo, antecedentes: revisado.antecedentes, sinDocumento });
}

/** Pasa a «Corrección pedida» o «Rechazado» con el motivo, que se le muestra al docente. */
export async function aplicarResolucionConMotivo(
  tx: Ejecutor,
  docenteId: string,
  destino: "correccion" | "rechazado",
  motivo: string,
): Promise<Resultado<Detalle>> {
  const cola = await docenteEnCola(tx, docenteId);
  if (cola.error) return cola.error;
  const { docente } = cola;

  await tx
    .update(docentes)
    .set({ verificacion: destino, verificacionNota: motivo, verificacionRevisadaEn: new Date() })
    .where(eq(docentes.id, docente.id));

  await avisar(tx, docente.usuarioId, {
    tipo: "verificacion",
    titulo: AVISO_DE,
    texto:
      destino === "correccion" ? `te pidió corregir tu documentación: ${motivo}` : `no pudo verificar tu perfil: ${motivo}`,
    enlace: ENLACE_PERFIL,
  });
  await encolarParaUsuarios(tx, docente.usuarioId ? [docente.usuarioId] : [], destino === "correccion" ? "M12" : "M13", {
    nombre: docente.nombre,
    motivo,
  });
  return ok({ estadoAnterior: docente.verificacion, motivo });
}

/** Bloquea el acceso (`docentes.suspendido`; el bloqueo en sí lo hace requerirDocente) y avisa con el motivo. */
export async function aplicarSuspension(tx: Ejecutor, adminId: string, docenteId: string, motivo: string): Promise<Resultado<Detalle>> {
  const [d] = await tx
    .select({ id: docentes.id, usuarioId: docentes.usuarioId, nombre: docentes.nombre, suspendido: docentes.suspendido })
    .from(docentes)
    .where(eq(docentes.id, docenteId))
    .limit(1)
    .for("update");
  if (!d) return fallo(NO_ENCONTRADO);
  if (d.usuarioId === adminId) return fallo("No podés suspender tu propia cuenta.");
  if (d.suspendido) return fallo("Esta cuenta ya está suspendida. Actualizá la pantalla.");

  await tx.update(docentes).set({ suspendido: true }).where(eq(docentes.id, d.id));
  await avisar(tx, d.usuarioId, { tipo: "sistema", titulo: AVISO_DE, texto: `suspendió tu cuenta. Motivo: ${motivo}`, enlace: "/contacto" });
  await encolarParaUsuarios(tx, d.usuarioId ? [d.usuarioId] : [], "M15", { nombre: d.nombre, institucion: null, motivo });
  return ok({ motivo });
}

export async function aplicarReactivacion(tx: Ejecutor, docenteId: string, nota?: string): Promise<Resultado<Detalle>> {
  const [d] = await tx
    .select({ id: docentes.id, usuarioId: docentes.usuarioId, suspendido: docentes.suspendido })
    .from(docentes)
    .where(eq(docentes.id, docenteId))
    .limit(1)
    .for("update");
  if (!d) return fallo(NO_ENCONTRADO);
  if (!d.suspendido) return fallo("Esta cuenta no está suspendida. Actualizá la pantalla.");

  await tx.update(docentes).set({ suspendido: false }).where(eq(docentes.id, d.id));
  await avisar(tx, d.usuarioId, {
    tipo: "sistema",
    titulo: AVISO_DE,
    texto: "reactivó tu cuenta. Ya podés volver a usar UNIDOAR con normalidad.",
    enlace: "/docente/dashboard",
  });
  return ok(nota ? { nota } : {});
}
