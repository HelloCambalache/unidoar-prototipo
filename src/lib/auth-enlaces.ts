import "server-only";
import type { NextRequest } from "next/server";

/**
 * Dirección del sitio para armar las redirecciones de los enlaces de Auth: la configurada (`NEXT_PUBLIC_SITE_URL`) o, si
 * no hay, la del pedido (detrás del proxy de Vercel, el host reenviado).
 */
export function baseDelSitio(request: NextRequest) {
  const configurada = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  const reenviado = request.headers.get("x-forwarded-host");
  return configurada ?? (reenviado ? `${request.headers.get("x-forwarded-proto") ?? "https"}://${reenviado}` : request.nextUrl.origin);
}
