import type { MetadataRoute } from "next";
import { RUTAS_PROHIBIDAS_A_ROBOTS, urlAbsoluta, urlDelSitio } from "@/lib/indexacion";

/**
 * Lo que le decimos a los buscadores: pueden recorrer todo el sitio salvo las funciones internas. Lo que no debe figurar en un resultado
 * (áreas con cuenta, ingreso, invitaciones) sale con `noindex` desde el proxy, no se prohíbe acá: ver `src/lib/indexacion.ts`.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: RUTAS_PROHIBIDAS_A_ROBOTS },
    sitemap: urlAbsoluta("/sitemap.xml", urlDelSitio()),
  };
}
