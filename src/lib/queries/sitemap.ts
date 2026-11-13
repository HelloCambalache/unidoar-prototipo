import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { busquedas, instituciones } from "@/db/schema";
import { getDb } from "@/db";
import { rutaDeInstitucion, rutaDeOferta } from "@/lib/compartir";
import { busquedaVigente, institucionVisible } from "@/lib/visibilidad";

/** Tope por lista: un sitemap admite hasta 50.000 direcciones y las páginas dinámicas no tienen que crecer sin límite. */
const TOPE = 5000;

export type EntradaDeSitemap = { ruta: string; modificada: Date | null };

/**
 * Lo que sale de la base para el sitemap: el perfil de cada institución que se ve en el catálogo público (verificada, o con búsquedas abiertas:
 * la misma regla de `catalogoInstituciones`) y cada búsqueda abierta de una institución visible (la misma regla de `/ofertas/<id>`: una cerrada,
 * pausada o vencida no se ofrece). Sin suspendidas ni dadas de baja; los ejemplos solo si no se ocultan (`institucionVisible`).
 */
export async function direccionesDeLaBase(): Promise<{ instituciones: EntradaDeSitemap[]; ofertas: EntradaDeSitemap[] }> {
  const db = getDb();
  const [verificadas, abiertas] = await Promise.all([
    db
      .select({ slug: instituciones.slug, modificada: instituciones.actualizadoEn })
      .from(instituciones)
      .where(and(institucionVisible, eq(instituciones.verificada, true)))
      .orderBy(instituciones.slug)
      .limit(TOPE),
    db
      .select({ id: busquedas.id, slug: instituciones.slug, modificada: busquedas.actualizadoEn })
      .from(busquedas)
      .innerJoin(instituciones, eq(instituciones.id, busquedas.institucionId))
      .where(and(institucionVisible, busquedaVigente))
      .orderBy(desc(busquedas.creadoEn))
      .limit(TOPE),
  ]);

  // Una institución sin verificar con búsquedas abiertas también figura en el catálogo: se suma por su slug.
  const porSlug = new Map<string, EntradaDeSitemap>();
  for (const v of verificadas) porSlug.set(v.slug, { ruta: rutaDeInstitucion(v.slug), modificada: v.modificada });
  for (const o of abiertas) if (!porSlug.has(o.slug)) porSlug.set(o.slug, { ruta: rutaDeInstitucion(o.slug), modificada: o.modificada });

  return {
    instituciones: [...porSlug.values()],
    ofertas: abiertas.map((o) => ({ ruta: rutaDeOferta(o.id), modificada: o.modificada })),
  };
}
