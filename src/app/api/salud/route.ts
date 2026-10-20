import { NextResponse } from "next/server";
import { usuarioActual } from "@/lib/auth";
import { cronAutorizado } from "@/lib/cron";
import { revisarSalud, type Salud } from "@/lib/salud";

// Se evalúa en cada pedido: es un chequeo de lo que hay configurado ahora, no algo cacheable por el CDN.
export const dynamic = "force-dynamic";

/**
 * Cuánto se reutiliza el último resultado. El chequeo hace un `select 1` y este endpoint es público: sin esto, cualquiera podía tenerlo
 * pidiéndose en bucle y gastarle conexiones al pool compartido de la base. Vive en la memoria de cada instancia.
 */
const VIGENCIA_MS = 10_000;
let ultimo: { en: number; salud: Salud } | null = null;

/**
 * Chequeo de salud. Sin sesión de admin ni el secreto del cron (`Authorization: Bearer <CRON_SECRET>`) responde solo `{ ok }`: qué
 * variables de entorno hay, cómo se conecta la base y cómo salen los mails es información de infraestructura que no tiene por qué ver
 * cualquiera. Con cualquiera de las dos, el detalle completo (ver src/lib/salud.ts: nunca valores ni mensajes crudos).
 * 200 si todo está bien, 503 si no.
 */
export async function GET(request: Request) {
  if (!ultimo || Date.now() - ultimo.en > VIGENCIA_MS) ultimo = { en: Date.now(), salud: await revisarSalud() };
  const { salud } = ultimo;
  const conDetalle = cronAutorizado(request) || (await usuarioActual())?.rol === "admin";
  return NextResponse.json(conDetalle ? salud : { ok: salud.ok }, {
    status: salud.ok ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
