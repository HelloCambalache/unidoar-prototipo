import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { leerCobro } from "@/lib/debito-automatico";
import { resumenDeError } from "@/lib/errores";
import { esAvisoQueUsamos, mercadoPagoActivo, secretoDelWebhook } from "@/lib/mercadopago-config";
import { comprobarAviso, ErrorDeMercadoPago, obtenerCobroMp, obtenerPagoMp } from "@/lib/mercadopago-cliente";
import { leerPagoMp } from "@/lib/pago-semestre";
import { avisarAAdmins } from "@/lib/queries/avisos";
import { aplicarPagoDeSemestre } from "@/lib/queries/pago-semestre";
import { aplicarCobro } from "@/lib/queries/suscripcion";
import { procesarSuscripcionDeMp } from "@/lib/queries/suscripcion-estado";

// Se evalúa en cada pedido: es un aviso de Mercado Pago, nunca algo cacheable.
export const dynamic = "force-dynamic";

const SIN_CACHE = { "Cache-Control": "no-store" };
const TAMANO_MAXIMO = 20_000;
/** Un número de recurso de Mercado Pago: letras, números, guion y guion bajo. Nada más viaja a su API. */
const ID_VALIDO = /^[0-9A-Za-z_-]{1,64}$/;

type CuerpoDeAviso = { type?: unknown; data?: { id?: unknown } };

/**
 * Los avisos de Mercado Pago (se carga esta dirección en su panel: Tus integraciones → Webhooks, con los avisos
 * `subscription_preapproval`, `subscription_authorized_payment` y `payment`: este último es el del pago único del semestre por adelantado).
 * Reglas, aprendidas también de Biomea (que ya cobra en producción):
 *
 * - **El aviso no decide nada.** Solo dice "pasó algo con el recurso N": se le pregunta a Mercado Pago (con nuestro token) qué es ese
 *   recurso y se actúa sobre su respuesta. Un aviso falso con un número real solo hace que leamos el estado real; con un número inventado,
 *   Mercado Pago contesta que no existe y no pasa nada. Por eso la firma (`MP_WEBHOOK_SECRET`, si está cargada) se comprueba y se anota si
 *   no coincide, pero **no bloquea**: bloquear hacía perder avisos verdaderos cuando la clave estaba mal cargada (la de pruebas y la de
 *   producción son distintas) y un cobro sin anotar es peor que un aviso falso inofensivo. Como la firma ya no respalda el número del
 *   recurso, se valida su forma antes de usarlo.
 * - **200 solo si quedó procesado** (o si no hay nada que hacer: un tipo que no usamos, un recurso que Mercado Pago ya no conoce, como el
 *   de "simular notificación" del panel). Si algo falla de nuestro lado (la base, Mercado Pago caído, un token mal cargado) responde 500:
 *   Mercado Pago reintenta cada 15 minutos hasta que salga. Aplicar un aviso es idempotente, así que reintentar es seguro.
 * - **Mercado Pago no siempre avisa cuando un cobro "en proceso" se acredita**: lo recupera la revisión diaria del cron de facturas
 *   (`reconciliarSuscripciones`), no este endpoint.
 */
export async function POST(request: Request) {
  if (!mercadoPagoActivo()) return NextResponse.json({ ok: false, error: "apagado" }, { status: 503, headers: SIN_CACHE });

  const url = new URL(request.url);
  const idDeLaDireccion = url.searchParams.get("data.id") ?? url.searchParams.get("id");

  if (secretoDelWebhook()) {
    const firma = comprobarAviso({
      firma: request.headers.get("x-signature"),
      idDelPedido: request.headers.get("x-request-id"),
      idDelRecurso: url.searchParams.get("data.id"),
    });
    if (!firma.valido) console.warn("[mercadopago] firma no validada (se procesa igual; se vuelve a consultar el recurso):", firma.motivo);
  }

  let cuerpo: CuerpoDeAviso | null = null;
  try {
    const texto = await request.text();
    if (texto.length > TAMANO_MAXIMO) return NextResponse.json({ ok: false }, { status: 413, headers: SIN_CACHE });
    cuerpo = texto ? (JSON.parse(texto) as CuerpoDeAviso) : null;
  } catch {
    cuerpo = null;
  }
  const tipo = cuerpo?.type ?? url.searchParams.get("type") ?? url.searchParams.get("topic");
  const idDelRecurso = String(idDeLaDireccion ?? cuerpo?.data?.id ?? "");
  if (!ID_VALIDO.test(idDelRecurso) || !esAvisoQueUsamos(tipo)) {
    return NextResponse.json({ ok: true, ignorado: true }, { headers: SIN_CACHE });
  }

  try {
    if (tipo === "subscription_preapproval") {
      // Qué se hace con cada resultado (duplicada, sin atribuir, reemplazada) está en `procesarSuscripcionDeMp`, igual para los tres caminos.
      const procesada = await procesarSuscripcionDeMp(idDelRecurso);
      const resultado = procesada?.resultado ?? "sin-cambios";
      console.info("[mercadopago] suscripción", { id: idDelRecurso, estado: procesada?.suscripcion.estado, resultado });
      return NextResponse.json({ ok: true, resultado }, { headers: SIN_CACHE });
    }

    if (tipo === "payment") {
      // Un pago único: el semestre por adelantado. También llegan los pagos de las suscripciones (y cualquier otro de la cuenta): no son de ningún
      // link nuestro (`external_reference` distinto) y `aplicarPagoDeSemestre` los deja pasar sin tocar nada.
      const pago = leerPagoMp(await obtenerPagoMp(idDelRecurso));
      if (!pago) return NextResponse.json({ ok: true, ignorado: true }, { headers: SIN_CACHE });
      const resultado = await aplicarPagoDeSemestre(pago);
      if (resultado === "registrado" || resultado === "revisar" || resultado === "devuelto") {
        // Plan y facturación de la institución y la ficha de cobros del equipo muestran otra cosa ahora.
        revalidatePath("/institucion/plan");
        revalidatePath("/backoffice/cobros");
      }
      console.info("[mercadopago] pago", { id: pago.id, estado: pago.estado, aplicado: resultado });
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
