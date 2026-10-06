import { z } from "zod";
import { TIPOS_INSTITUCION } from "@/lib/catalogo";

/* Filtros del catálogo de instituciones (panel del docente y sitio público). Viven en la URL. */

/** Un valor inválido en la URL se ignora en vez de romper la página. */
const filtrosInstitucionesSchema = z.object({
  q: z.string().trim().max(80).optional().catch(undefined),
  tipo: z.enum(TIPOS_INSTITUCION).optional().catch(undefined),
  zona: z.string().trim().max(80).optional().catch(undefined),
  favoritas: z.literal("1").optional().catch(undefined),
  vista: z.enum(["lista", "mapa"]).optional().catch(undefined),
});
export type FiltrosInstitucionesUrl = z.infer<typeof filtrosInstitucionesSchema>;

export function leerFiltrosInstituciones(
  params: Record<string, string | string[] | undefined>,
): FiltrosInstitucionesUrl {
  const plano = Object.fromEntries(Object.entries(params).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
  return filtrosInstitucionesSchema.parse(plano);
}
