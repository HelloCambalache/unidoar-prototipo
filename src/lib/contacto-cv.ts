import { nombreVisibleDeArchivo } from "@/lib/examen-preocupacional";
import { esPathPrivadoPropio } from "@/lib/subidas";

/*
 * CV adjunto a un contacto propio de la institución (Profesionales → «Cargar perfil» / «Editar»). Un PDF por contacto, en el bucket
 * privado: se abre solo con `/api/cv/contacto/<id>` (comprueba que el contacto sea de la institución de quien lo abre y redirige a una
 * URL firmada de un minuto). Sin acceso a base ni a Storage: lo usan el formulario, la acción y la ruta.
 */

/** Carpeta del bucket privado donde se guardan (`<usuarioId>/cvcontactos/<uuid>.pdf`). */
export const CARPETA_CV_CONTACTO = "cvcontactos";

/**
 * Cuántos contactos de una institución pueden tener un CV adjunto. Cada uno puede pesar hasta lo que admite un PDF: el tope evita que una
 * cuenta use Storage como depósito (el de contactos, 2.000, es por filas).
 */
export const MAX_CVS_POR_INSTITUCION = 500;

/** ¿Entra un CV más, si ya hay `conCv` contactos con uno? */
export const cabeOtroCv = (conCv: number) => conCv < MAX_CVS_POR_INSTITUCION;

/** Lo que hay guardado en el contacto. */
export type CvGuardado = { path: string; nombre: string } | null;

/** Lo que pide el formulario: dejar el CV como está, quitarlo o poner uno recién subido. */
export type CambioDeCv = { tipo: "igual" } | { tipo: "quitar" } | { tipo: "nuevo"; path: string; nombre: string };

const ERROR_DE_CV = "No pudimos validar el CV. Subilo de nuevo.";

/**
 * Lee el cambio de CV que llegó del navegador. El servidor no confía en el path: solo acepta uno que subió ESTA cuenta a la carpeta de
 * CV de contactos (un path de otra cuenta, de otra carpeta o con un `../` se rechaza). Sin el campo (un formulario viejo) no cambia nada.
 */
export function leerCambioDeCv(
  entrada: { accion: unknown; path: unknown; nombre: unknown },
  usuarioId: string,
): { ok: true; cambio: CambioDeCv } | { ok: false; error: string } {
  const accion = entrada.accion == null || entrada.accion === "" ? "igual" : entrada.accion;
  if (accion === "igual") return { ok: true, cambio: { tipo: "igual" } };
  if (accion === "quitar") return { ok: true, cambio: { tipo: "quitar" } };
  if (accion !== "nuevo") return { ok: false, error: ERROR_DE_CV };
  const path = typeof entrada.path === "string" ? entrada.path : "";
  if (!esPathPrivadoPropio(path, usuarioId, CARPETA_CV_CONTACTO) || !path.endsWith(".pdf")) return { ok: false, error: ERROR_DE_CV };
  return { ok: true, cambio: { tipo: "nuevo", path, nombre: nombreVisibleDeArchivo(typeof entrada.nombre === "string" ? entrada.nombre : null, path) } };
}

/** El CV que queda en el contacto después del cambio. */
export function aplicarCambioDeCv(actual: CvGuardado, cambio: CambioDeCv): CvGuardado {
  if (cambio.tipo === "igual") return actual;
  if (cambio.tipo === "quitar") return null;
  return { path: cambio.path, nombre: cambio.nombre };
}

/** Lo que muestra la pantalla de un contacto: el nombre del archivo (nunca el path, que lleva el id de la cuenta que lo subió). */
export const nombreDeCvParaMostrar = (path: string | null, nombre: string | null): string | null => (path ? (nombre?.trim() || "CV.pdf") : null);

/** Dirección que abre el CV de un contacto (comprueba la cuenta y redirige a una URL firmada). */
export const rutaDeCvDeContacto = (contactoId: string) => `/api/cv/contacto/${contactoId}`;
