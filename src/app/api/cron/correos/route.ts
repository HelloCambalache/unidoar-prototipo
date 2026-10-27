import { NextResponse } from "next/server";
import { transaccion } from "@/db";
import { purgarCola, vaciarCola } from "@/lib/correo/cola";
import { modoCorreo } from "@/lib/correo/config";
import { cronAutorizado } from "@/lib/cron";
import { barrerFotosDeDniSueltas, limpiarSubidasDePaso } from "@/lib/queries/archivos";
import { encolarRecordatoriosDeFactura } from "@/lib/queries/recordatorios-factura";
import { resumenDeError } from "@/lib/errores";

// Se evalúa en cada pedido: manda mails, no es algo cacheable.
export const dynamic = "force-dynamic";
// Resend admite 2 pedidos por segundo: 60 mails por tanda caben en menos de un minuto.
export const maxDuration = 60;

const SIN_CACHE = { "Cache-Control": "no-store" };

/**
 * Tarea diaria de mails (se programa en vercel.json): anota los recordatorios de factura que tocan hoy (vence pronto,
 * vencida), reintenta lo que quedó pendiente en la cola y borra el historial de más de 90 días. Los demás mails salen
 * solos al guardarse cada cambio; esto es además la red de seguridad por si un envío falló. También barre las subidas de PDF grandes que
 * quedaron sin confirmar en las carpetas de paso (`limpiarSubidasDePaso`) y las fotos del DNI que quedaron sueltas en perfiles recién verificados
 * (`barrerFotosDeDniSueltas`): ninguna de las dos depende de los mails, se hacen aunque estén apagados.
 */
export async function GET(request: Request) {
  if (!cronAutorizado(request)) return NextResponse.json({ error: "No autorizado" }, { status: 401, headers: SIN_CACHE });

  // Las limpiezas de archivos no dependen de los mails (ni un error de ellas frena lo demás: nunca lanzan).
  const subidasBarridas = await limpiarSubidasDePaso();
  // Red de seguridad de la promesa de borrar las fotos del DNI dentro de las 24 horas de verificada la identidad.
  const fotosDeDniBarridas = await barrerFotosDeDniSueltas();

  const modo = modoCorreo();
  if (modo === "apagado") return NextResponse.json({ modo, subidasBarridas, fotosDeDniBarridas }, { headers: SIN_CACHE });

  try {
    const recordatorios = await transaccion((tx) => encolarRecordatoriosDeFactura(tx));
    const cola = await vaciarCola({ limite: 60 });
    const purgados = await purgarCola();
    console.info("Tarea de mails", { modo, recordatorios, ...cola, purgados, subidasBarridas, fotosDeDniBarridas });
    return NextResponse.json({ modo, recordatorios, ...cola, purgados, subidasBarridas, fotosDeDniBarridas }, { headers: SIN_CACHE });
  } catch (e) {
    console.error("Falló la tarea de mails", resumenDeError(e));
    return NextResponse.json({ error: "Falló la tarea de mails" }, { status: 500, headers: SIN_CACHE });
  }
}
