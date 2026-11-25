import { etiquetaDeCategorias, type ConCategorias } from "@/lib/categorias-docente";
import { rutaPasoDocente, rutaPasoPendienteDocente } from "@/lib/onboarding";

/*
 * Cuándo el alta de un profesional se da por completa (código puro, sin base: sirve en los dos pasos que la cierran y se prueba solo).
 *
 * Hasta el 2026-11-25 el alta se cerraba recién en el último paso, «Documentación», aunque subir documentos es opcional: quien dejaba la
 * pestaña ahí, con todos sus datos cargados, quedaba afuera del buscador de las instituciones. Desde entonces se cierra al terminar
 * «Niveles y horarios» (el último paso con datos obligatorios) y la documentación pasa a ser un paso aparte y opcional: el perfil figura
 * «Sin verificar» hasta que el equipo revise lo que se suba.
 */

/** Lo que hace falta del perfil para poder cerrar el alta. */
export type DatosParaCerrarElAlta = { telefono: string | null; niveles: string[]; disponibilidad: string[] };

/**
 * A qué paso hay que volver para poder cerrar el alta, o null si ya se puede: hace falta el teléfono, los niveles y los horarios (ver
 * `rutaPasoPendienteDocente`) y el DNI, que es lo que el equipo necesita para verificar a la persona («Guardar borrador» o «Guardar y salir»
 * en «Tu perfil» lo dejan pasar sin él).
 */
export function pasoQueFaltaParaCerrarElAlta(datos: DatosParaCerrarElAlta, dni: string | null | undefined): string | null {
  const pendiente = rutaPasoPendienteDocente(datos);
  if (pendiente !== rutaPasoDocente("4")) return pendiente;
  if (!dni) return `${rutaPasoDocente("3")}?falta=dni`;
  return null;
}

/** El subtítulo del perfil si la persona no escribió uno: «Docente · Lengua, Historia». */
export function subtituloDeAlta(perfil: ConCategorias & { asignaturas: string[]; subtitulo: string | null }): string {
  if (perfil.subtitulo) return perfil.subtitulo;
  const asignaturas = perfil.asignaturas.slice(0, 2).join(", ");
  const categorias = etiquetaDeCategorias(perfil);
  return asignaturas ? `${categorias} · ${asignaturas}` : categorias;
}

/**
 * Si un perfil con el alta ya completa puede abrir el paso «Documentación» del alta. Solo mientras esté pendiente de revisión: con la
 * verificación hecha, rechazada o con una corrección pedida (y subir algo la devuelve a la cola), los documentos se tocan desde Mi perfil,
 * que respeta esas reglas. Una cuenta suspendida tampoco.
 */
export function puedeAbrirLaDocumentacionDelAlta(perfil: { onboardingCompleto: boolean; verificacion: string; suspendido: boolean }): boolean {
  if (!perfil.onboardingCompleto) return true;
  return perfil.verificacion === "pendiente" && !perfil.suspendido;
}
