import { NextResponse } from "next/server";
import { revisarSalud } from "@/lib/salud";

// Se evalúa en cada pedido: es un chequeo de lo que hay configurado ahora, no algo cacheable.
export const dynamic = "force-dynamic";

/**
 * Chequeo de salud público: qué variables de entorno están presentes y si la base conecta.
 * No expone valores ni mensajes crudos (ver src/lib/salud.ts). 200 si todo está bien, 503 si no.
 */
export async function GET() {
  const salud = await revisarSalud();
  return NextResponse.json(salud, {
    status: salud.ok ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
