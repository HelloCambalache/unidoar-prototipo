import { imagenDeCompartir } from "@/lib/og-compartir";
import { archivoDeImagen, PUBLICOS, publicoDeArchivo } from "@/lib/seo";

/*
 * Las imágenes que se ven al compartir un enlace de UNIDOAR (WhatsApp, redes, mail): /og/docentes.png, /og/instituciones.png y /og/general.png.
 * Cada página declara la de su público en sus metadatos (`metadatosDePagina`, src/lib/seo.ts). Se generan una vez, en el build.
 *
 * Es una ruta propia y no un `opengraph-image.tsx` por carpeta porque Next solo mira el de la MISMA carpeta de la página: una página que arma
 * su propio `openGraph` (todas las públicas) pierde el de una carpeta de arriba y se quedaba sin imagen. La extensión .png además la deja
 * afuera del proxy (no necesita sesión ni cookies).
 */

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return PUBLICOS.map((publico) => ({ archivo: archivoDeImagen(publico) }));
}

export async function GET(_pedido: Request, { params }: { params: Promise<{ archivo: string }> }) {
  const publico = publicoDeArchivo((await params).archivo);
  if (!publico) return new Response("No existe", { status: 404 });
  return imagenDeCompartir(publico);
}
