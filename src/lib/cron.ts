import "server-only";
import { timingSafeEqual } from "node:crypto";

/** Vercel Cron manda `Authorization: Bearer <CRON_SECRET>`. Sin el secreto configurado no se acepta nada. */
export function cronAutorizado(request: Request) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || secreto.length < 16) return false;
  const recibido = Buffer.from(request.headers.get("authorization") ?? "");
  const esperado = Buffer.from(`Bearer ${secreto}`);
  return recibido.length === esperado.length && timingSafeEqual(recibido, esperado);
}
