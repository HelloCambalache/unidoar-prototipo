import "server-only";
import { headers } from "next/headers";

/** De dónde sale el origen que va en los enlaces de los mails: la URL configurada o el host de la request. */
export async function origenSitio() {
  const configurada = process.env.NEXT_PUBLIC_SITE_URL;
  if (configurada) return configurada.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const protocolo = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${protocolo}://${host}`;
}

/** Enlace de /auth/callback al que vuelve la persona desde un mail de Supabase (`siguiente`: ruta interna a la que sigue). */
export const urlDeCallback = (origen: string, siguiente: string) =>
  `${origen}/auth/callback?next=${encodeURIComponent(siguiente)}`;
