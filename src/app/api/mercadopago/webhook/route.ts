import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { leerCobro } from "@/lib/debito-automatico";
import { resumenDeError } from "@/lib/errores";
import { esAvisoQueUsamos, mercadoPagoActivo } from "@/lib/mercadopago-config";
import {
  cancelarSuscripcionMp,
  comprobarAviso,
  ErrorDeMercadoPago,
  obtenerCobroMp,
  obtenerSuscripcionMp,
} from "@/lib/mercadopago-cliente";
import { avisarAAdmins } from "@/lib/queries/avisos";
import { aplicarCobro, aplicarEstadoDeSuscripcion } from "@/lib/queries/suscripcion";

// Se evalúa en cada pedido: es un aviso de Mercado Pago, nunca algo cacheable.
export const dynamic = "force-dynamic";

const SIN_CACHE = { "Cache-Control": "no-store" };
const TAMANO_MAXIMO = 20_000;

/**
 * Los avisos de Mercado Pago (se carga esta dirección en su panel: Tus integraciones → Webhooks, con los avisos
 * `subscription_preapproval` y `subscription_authorized_payment`). Reglas:
 *
 * - **La firma se comprueba primero** (`x-signature` + clave secreta de la aplicación, con el SDK): sin una firma válida no se toca nada
 *   y se responde 401. Solo se confía en el número del recurso que va dentro de lo firmado (`data.id` de la dirección), nunca en el
 *   cuerpo, que no está firmado.
 * - **El aviso no trae los datos**: solo dice "pasó algo con el recurso N". Se le pregunta a Mercado Pago (con nuestro token) qué es
 *   ese recurso, así nada de lo que llegue en el pedido decide un monto ni un estado.
 * - **200 solo si quedó procesado** (o si no hay nada que hacer: un tipo que no usamos, un recurso que Mercado Pago ya no conoce, como
 *   el de "simular notificación" del panel). Si algo falla de nuestro lado (la base, Mercado Pago caído, un token mal cargado) responde
 *   500: Mercado Pago reintenta cada 15 minutos hasta que salga. Aplicar un aviso es idempotente, así que reintentar es seguro.
 */
export async function POST(request: Request) {
  if (!mercadoPagoActivo()) return NextResponse.json({ ok: false, error: "apagado" }, { status: 503, headers: SIN_CACHE });

  const url = new URL(request.url);
  const idDelRecurso = url.searchParams.get("data.id");
  const firma = comprobarAviso({
    firma: request.headers.get("x-signature"),
    idDelPedido: request.headers.get("x-request-id"),
    idDelRecurso,
  });
  if (!firma.valido) {
    console.warn("[mercadopago] aviso rechazado:", firma.motivo);
    return NextResponse.json({ ok: false }, { status: 401, headers: SIN_CACHE });
  }

  let cuerpo: { type?: unknown } | null = null;
  try {
    const texto = await request.text();
    if (texto.length > TAMANO_MAXIMO) return NextResponse.json({ ok: false }, { status: 413, headers: SIN_CACHE });
    cuerpo = texto ? (JSON.parse(texto) as { type?: unknown }) : null;
  } catch {
    cuerpo = null;
  }
  const tipo = cuerpo?.type ?? url.searchParams.get("type") ?? url.searchParams.get("topic");
  if (!idDelRecurso || !esAvisoQueUsamos(tipo)) {
    return NextResponse.json({ ok: true, ignorado: true }, { headers: SIN_CACHE });
  }

  try {
    if (tipo === "subscription_preapproval") {
      const suscripcion = await obtenerSuscripcionMp(idDelRecurso);
      const resultado = await aplicarEstadoDeSuscripcion(suscripcion);
      if (resultado === "desconocida" && suscripcion.estado === "authorized") {
        // Una suscripción autorizada que no es la que tenemos anotada (p. ej. un doble clic que creó dos): no puede quedar cobrando sin que
        // la veamos. Se cancela y se le avisa al equipo.
        await cancelarSuscripcionMp(suscripcion.id);
        await avisarAAdmins(getDb(), {
          titulo: "Suscripción de Mercado Pago sin registrar",
          texto: `Mercado Pago avisó de una suscripción autorizada que no estaba anotada (${suscripcion.id}). Se canceló para que no cobre sin registrarse.`,
          enlace: "/backoffice/cobros",
        });
      }
      console.info("[mercadopago] suscripción", { id: suscripcion.id, estado: suscripcion.estado, resultado });
      return NextResponse.json({ ok: true, resultado }, { headers: SIN_CACHE });
    }

    // subscription_authorized_payment: un cobro de la suscripción.
    const cobro = leerCobro(await obtenerCobroMp(idDelRecurso));
    if (!cobro) return NextResponse.json({ ok: true, ignorado: true }, { headers: SIN_CACHE });
    const resultado = await aplicarCobro(cobro);
    if (resultado === "sin-suscripcion" && cobro.resultado === "aprobado") {
      // Se cobró algo de una suscripción que no conocemos: alguien tiene que mirarlo.
      await avisarAAdmins(getDb(), {
        titulo: "Cobro de Mercado Pago sin suscripción",
        texto: `Mercado Pago cobró ${cobro.monto ?? ""} de la suscripción ${cobro.suscripcionId} y no la tenemos anotada (cobro ${cobro.id}).`.replace(/\s+/g, " "),
        enlace: "/backoffice/cobros",
      });
    }
    console.info("[mercadopago] cobro", { id: cobro.id, resultado: cobro.resultado, aplicado: resultado });
    return NextResponse.json({ ok: true, resultado }, { headers: SIN_CACHE });
  } catch (e) {
    // Un recurso que Mercado Pago no conoce (el de "simular notificación") no se reintenta nunca: no hay nada que hacer.
    if (e instanceof ErrorDeMercadoPago && e.tipo === "no-existe") {
      console.warn("[mercadopago] aviso de un recurso que Mercado Pago no conoce:", tipo);
      return NextResponse.json({ ok: true, ignorado: true }, { headers: SIN_CACHE });
    }
    console.error("[mercadopago] no se pudo procesar el aviso", tipo, resumenDeError(e));
    return NextResponse.json({ ok: false }, { status: 500, headers: SIN_CACHE });
  }
}
