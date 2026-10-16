import "server-only";
import { eq } from "drizzle-orm";
import { docenteDetalle, docentes } from "@/db/schema";
import { fallo, ok, type Resultado } from "@/lib/acciones";
import { MENSAJE_REAPERTURA, puedeReabrirRevision, VERIFICACION_BO } from "@/lib/backoffice-docentes";
import { encolarParaUsuarios } from "@/lib/correo/cola";
import { esEstudiante } from "@/lib/estudiantes";
import { sinArchivosDeDni } from "@/lib/perfil-docente";
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

const NO_ENCONTRADO = "No encontramos a ese profesional.";
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
  if (!d.onboardingCompleto) return { error: fallo("Este profesional todavía no terminó el alta.") };
  if (d.verificacion !== "pendiente" && d.verificacion !== "correccion") {
    return { error: fallo(`Este perfil ya figura como «${VERIFICACION_BO[d.verificacion].etiqueta}». Actualizá la pantalla.`) };
  }
  return { docente: { id: d.id, usuarioId: d.usuarioId, nombre: d.nombre, verificacion: d.verificacion } };
}

/**
 * `verificacion = 'verificado'` y, según lo que se revisó, título y antecedentes. Si el DNI no está cargado en la
 * plataforma igual se verifica (quien revisa pudo comprobarlo por otro medio), pero la auditoría anota qué faltaba.
 *
 * Verificar la identidad borra las fotos del DNI: acá se quitan de la base (en la misma transacción) y se devuelven en
 * `archivosDni` para que la acción las borre de Storage cuando la transacción ya se confirmó (`borrarArchivos`). El número
 * de DNI se conserva.
 */
export async function aplicarVerificacion(
  tx: Ejecutor,
  docenteId: string,
  revisado: { titulo: boolean; antecedentes: boolean },
): Promise<Resultado<{ detalle: Detalle; archivosDni: string[] }>> {
  const cola = await docenteEnCola(tx, docenteId);
  if (cola.error) return cola.error;
  const { docente } = cola;

  const [detalle] = await tx
    .select({ documentos: docenteDetalle.documentos, situacionEstudio: docenteDetalle.situacionEstudio })
    .from(docenteDetalle)
    .where(eq(docenteDetalle.docenteId, docente.id))
    .limit(1);
  const docs = detalle?.documentos ?? {};
  // Quien todavía estudia presenta la constancia de alumno regular: respalda su identidad y su condición de estudiante, pero NO
  // verifica un título que todavía no existe (aunque el pedido diga lo contrario).
  const estudiante = esEstudiante(detalle?.situacionEstudio);
  const tituloVerificado = estudiante ? false : revisado.titulo;
  const sinDocumento = [
    ...(docs.dniFrente && docs.dniDorso ? [] : ["dni"]),
    ...(estudiante && !docs.constancia ? ["constancia"] : []),
    ...(tituloVerificado && !docs.credencial ? ["credencial"] : []),
    ...(revisado.antecedentes && !docs.conducta ? ["conducta"] : []),
  ];

  await tx
    .update(docentes)
    .set({
      verificacion: "verificado",
      tituloVerificado,
      antecedentesVerificados: revisado.antecedentes,
      verificacionNota: null,
      verificacionRevisadaEn: new Date(),
    })
    .where(eq(docentes.id, docente.id));

  const { restantes, archivos: archivosDni } = sinArchivosDeDni(docs);
  if (archivosDni.length > 0) {
    await tx.update(docenteDetalle).set({ documentos: restantes }).where(eq(docenteDetalle.docenteId, docente.id));
  }

  const queSeVerifico = [
    "tu identidad",
    ...(tituloVerificado ? ["tu título o credencial"] : []),
    ...(revisado.antecedentes ? ["tu certificado de buena conducta"] : []),
  ];
  await avisar(tx, docente.usuarioId, {
    tipo: "verificacion",
    titulo: AVISO_DE,
    texto: `verificó ${unir(queSeVerifico)}. Tu perfil ya figura como verificado para las instituciones.`,
    enlace: ENLACE_PERFIL,
  });
  await encolarParaUsuarios(tx, docente.usuarioId ? [docente.usuarioId] : [], "M11", { nombre: docente.nombre });
  return ok({
    detalle: {
      estadoAnterior: docente.verificacion,
      titulo: tituloVerificado,
      estudiante,
      antecedentes: revisado.antecedentes,
      sinDocumento,
      dniBorrado: archivosDni.length > 0,
    },
    archivosDni,
  });
}

/**
 * Valida el título de un profesional cuya identidad ya estaba verificada: pasa cuando quien estudiaba se recibe y lo sube
 * después desde Mi perfil (ya no está en la cola). Solo marca el título; la identidad y los antecedentes no se tocan.
 */
export async function aplicarVerificacionDeTitulo(tx: Ejecutor, docenteId: string): Promise<Resultado<Detalle>> {
  const [d] = await tx
    .select({
      id: docentes.id,
      usuarioId: docentes.usuarioId,
      verificacion: docentes.verificacion,
      tituloVerificado: docentes.tituloVerificado,
    })
    .from(docentes)
    .where(eq(docentes.id, docenteId))
    .limit(1)
    .for("update");
  if (!d) return fallo(NO_ENCONTRADO);
  if (d.verificacion !== "verificado") return fallo("Este perfil todavía no está verificado: el título se revisa desde la cola de verificación.");
  if (d.tituloVerificado) return fallo("El título ya figura como verificado. Actualizá la pantalla.");

  const [detalle] = await tx
    .select({ documentos: docenteDetalle.documentos, situacionEstudio: docenteDetalle.situacionEstudio })
    .from(docenteDetalle)
    .where(eq(docenteDetalle.docenteId, d.id))
    .limit(1);
  if (esEstudiante(detalle?.situacionEstudio)) return fallo("Todavía figura como estudiante: no tiene un título para validar.");
  if (!detalle?.documentos?.credencial) return fallo("Todavía no subió el título.");

  await tx.update(docentes).set({ tituloVerificado: true, verificacionRevisadaEn: new Date() }).where(eq(docentes.id, d.id));
  await avisar(tx, d.usuarioId, {
    tipo: "verificacion",
    titulo: AVISO_DE,
    texto: "verificó tu título o credencial. Las instituciones ya lo ven en tu perfil.",
    enlace: ENLACE_PERFIL,
  });
  return ok({ titulo: true });
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

/**
 * Reabre la revisión de un perfil rechazado: pasa a «Corrección pedida» con un mensaje para la persona (el que escribió el
 * equipo o `MENSAJE_REAPERTURA`). Desde ahí puede volver a subir su documentación desde Mi perfil y, al guardar, vuelve a la
 * cola. Solo sirve con la verificación rechazada: es la salida de un estado que de otro modo no tiene vuelta (la persona no
 * puede editar nada y, como su cuenta existe, tampoco registrarse de nuevo).
 */
export async function aplicarReapertura(tx: Ejecutor, docenteId: string, mensaje?: string): Promise<Resultado<Detalle>> {
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
  if (!d) return fallo(NO_ENCONTRADO);
  if (!d.onboardingCompleto) return fallo("Este profesional todavía no terminó el alta.");
  if (!puedeReabrirRevision(d.verificacion)) {
    return fallo(`Este perfil figura como «${VERIFICACION_BO[d.verificacion].etiqueta}»: solo se reabre uno rechazado. Actualizá la pantalla.`);
  }

  const texto = mensaje?.trim() || MENSAJE_REAPERTURA;
  await tx
    .update(docentes)
    .set({ verificacion: "correccion", verificacionNota: texto, verificacionRevisadaEn: new Date() })
    .where(eq(docentes.id, d.id));
  await avisar(tx, d.usuarioId, {
    tipo: "verificacion",
    titulo: AVISO_DE,
    texto: `reabrió tu revisión: ${texto}`,
    enlace: "/docente/perfil#documentacion",
  });
  await encolarParaUsuarios(tx, d.usuarioId ? [d.usuarioId] : [], "M12", { nombre: d.nombre, motivo: texto });
  return ok({ estadoAnterior: d.verificacion, mensaje: texto });
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
    .select({ id: docentes.id, usuarioId: docentes.usuarioId, nombre: docentes.nombre, suspendido: docentes.suspendido })
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
  // Como la suspensión (M15): con la cuenta suspendida no se ve la campanita, así que el mail avisa que ya puede volver a entrar.
  await encolarParaUsuarios(tx, d.usuarioId ? [d.usuarioId] : [], "M16", { nombre: d.nombre, institucion: null });
  return ok(nota ? { nota } : {});
}
