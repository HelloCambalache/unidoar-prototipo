import { NextResponse } from "next/server";
import { hoyAR } from "@/lib/cobros";
import { resumenDeError } from "@/lib/errores";
import { retirarAvisosPorNumero } from "@/lib/queries/whatsapp";
import { encolarRespuesta, registrarEstadosDeEntrega } from "@/lib/whatsapp/cola";
import { modoWhatsapp, secretoDeLaApp, tokenDeVerificacionDelWebhook } from "@/lib/whatsapp/config";
import { claveDeNumero } from "@/lib/whatsapp/telefono";
import { firmaValida, leerWebhook, pideLaBaja, RESPUESTA_A_LA_BAJA, RESPUESTA_AUTOMATICA } from "@/lib/whatsapp/webhook";

// Se evalúa en cada pedido: es un aviso de Meta, nunca algo cacheable.
export const dynamic = "force-dynamic";

const SIN_CACHE = { "Cache-Control": "no-store" };
const TAMANO_MAXIMO = 100_000;

/**
 * Verificación del webhook: al cargar esta dirección en Meta (App → WhatsApp → Configuración → Webhook), Meta hace un GET con `hub.verify_token` (el texto
 * que se escribió en su panel, igual a `WHATSAPP_VERIFY_TOKEN`) y espera que se le devuelva `hub.challenge` tal cual.
 */
export async function GET(request: Request) {
  const esperado = tokenDeVerificacionDelWebhook();
  const url = new URL(request.url);
  if (!esperado) return new NextResponse("apagado", { status: 503, headers: SIN_CACHE });
  if (url.searchParams.get("hub.mode") === "subscribe" && url.searchParams.get("hub.verify_token") === esperado) {
    return new NextResponse(url.searchParams.get("hub.challenge") ?? "", { status: 200, headers: { ...SIN_CACHE, "Content-Type": "text/plain" } });
  }
  return new NextResponse("prohibido", { status: 403, headers: SIN_CACHE });
}

/**
 * Lo que manda Meta: el estado de cada aviso que mandamos (enviado, entregado, leído, fallido) y los mensajes que la gente le escribe al número.
 *
 * - **La firma se comprueba SIEMPRE y bloquea** (`X-Hub-Signature-256` con `WHATSAPP_APP_SECRET`). A diferencia de Mercado Pago (donde el aviso solo dice «mirá
 *   el recurso N» y se le pregunta a la API), acá el aviso trae los datos: un «BAJA» o un estado falso se aplicaría tal cual. Sin la clave cargada responde
 *   503 y sin firma válida, 401.
 * - **200 solo si quedó procesado**; si falla algo nuestro (la base), 500 y Meta reintenta. Todo lo que se hace es idempotente.
 * - **Quien escribe «BAJA» deja de recibir avisos** (por número: ver `retirarAvisosPorNumero`) y se le confirma. Cualquier otro mensaje recibe, una vez por día, la
 *   respuesta automática de que este número no atiende consultas (dentro de las 24 horas de su mensaje se puede contestar con texto libre, sin plantilla).
 */
export async function POST(request: Request) {
  const secreto = secretoDeLaApp();
  if (!secreto || modoWhatsapp() === "apagado") return NextResponse.json({ ok: false, error: "apagado" }, { status: 503, headers: SIN_CACHE });

  const texto = await request.text();
  if (texto.length > TAMANO_MAXIMO) return NextResponse.json({ ok: false }, { status: 413, headers: SIN_CACHE });
  if (!firmaValida(texto, request.headers.get("x-hub-signature-256"), secreto)) {
    console.warn("[whatsapp] aviso con firma inválida: se descarta");
    return NextResponse.json({ ok: false }, { status: 401, headers: SIN_CACHE });
  }

  let cuerpo: unknown;
  try {
    cuerpo = JSON.parse(texto);
  } catch {
    return NextResponse.json({ ok: false }, { status: 400, headers: SIN_CACHE });
  }

  try {
    const { estados, mensajes } = leerWebhook(cuerpo);
    const tocados = await registrarEstadosDeEntrega(estados);

    for (const m of mensajes) {
      if (pideLaBaja(m.texto)) {
        const cuentas = await retirarAvisosPorNumero(m.de);
        console.info("[whatsapp] baja por mensaje", { cuentas });
        await encolarRespuesta(m.de, RESPUESTA_A_LA_BAJA, `BAJA:${m.id}`);
      } else {
        // Una respuesta automática por número y por día: no hay forma de que dos personas se «charlen» con un bot.
        await encolarRespuesta(m.de, RESPUESTA_AUTOMATICA, `AUTO:${claveDeNumero(m.de) ?? m.de}:${hoyAR()}`);
      }
    }
    return NextResponse.json({ ok: true, estados: tocados, mensajes: mensajes.length }, { headers: SIN_CACHE });
  } catch (e) {
    console.error("Falló el procesamiento del webhook de WhatsApp", resumenDeError(e));
    return NextResponse.json({ ok: false }, { status: 500, headers: SIN_CACHE });
  }
}
