import { MANUAL_EQUIPO } from "./equipo";
import { MANUAL_INSTITUCIONES } from "./instituciones";
import { MANUAL_PROFESIONALES } from "./profesionales";
import { PERFILES_PUBLICOS, type ManualDeAyuda, type PerfilDeAyuda } from "./tipos";

export * from "./buscar";
export * from "./tipos";

export const MANUALES: Record<PerfilDeAyuda, ManualDeAyuda> = {
  profesionales: MANUAL_PROFESIONALES,
  instituciones: MANUAL_INSTITUCIONES,
  equipo: MANUAL_EQUIPO,
};

/** Los manuales que se ven sin cuenta (el del equipo, no). */
export const MANUALES_PUBLICOS: ManualDeAyuda[] = PERFILES_PUBLICOS.map((p) => MANUALES[p]);
