import type { MetadataRoute } from "next";
import { urlAbsoluta, urlDelSitio } from "@/lib/indexacion";
import { resumenDeError } from "@/lib/errores";
import { direccionesDeLaBase } from "@/lib/queries/sitemap";
import { rutasFijasDelSitemap } from "@/lib/sitemap";

// Se arma en cada pedido: las búsquedas abiertas cambian todo el día y en el build no hay que tocar la base.
export const dynamic = "force-dynamic";

/**
 * Las páginas públicas fijas más el perfil de cada institución y cada búsqueda abierta. Si la base no responde, sale igual con las fijas: un
 * sitemap incompleto por un rato es mejor que un error que un buscador recuerde.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = urlDelSitio();
  const fijas: MetadataRoute.Sitemap = rutasFijasDelSitemap().map((ruta) => ({ url: urlAbsoluta(ruta, base) }));

  try {
    const { instituciones, ofertas } = await direccionesDeLaBase();
    const deLaBase: MetadataRoute.Sitemap = [...instituciones, ...ofertas].map((e) => ({
      url: urlAbsoluta(e.ruta, base),
      ...(e.modificada ? { lastModified: e.modificada } : {}),
    }));
    return [...fijas, ...deLaBase];
  } catch (e) {
    console.error("sitemap: no se pudieron leer las instituciones y búsquedas", resumenDeError(e));
    return fijas;
  }
}
