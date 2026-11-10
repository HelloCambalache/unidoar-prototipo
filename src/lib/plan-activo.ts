import { DIAS_DE_GRACIA, MENSAJE_DE_MORA, QUE_SE_LIMITA, type Mora } from "@/lib/mora";
import { pesos } from "@/lib/planes";
import { textoDeSemestre, type resumenDeSemestre } from "@/lib/forma-de-pago";
import { fraseDelCartelSinPago, pasosParaActivar, pasosParaLevantarLaMora, type FormaDeCobro } from "@/lib/pago-manual";

/*
 * «Plan activo»: cuándo una institución puede publicar búsquedas, invitar a postularse y publicar cursos, y qué se le muestra cuando no puede
 * (pedido del cliente, 2026-10-27: «falta popup de pago para cuando no tiene plan activo»). Reglas y textos puros, sin base ni Next: los usan las
 * acciones, el popup, los carteles y las pruebas.
 *
 * Un plan NO está activo en dos casos:
 *  - **mora**: la cuenta tiene una factura vencida hace más de `DIAS_DE_GRACIA` días (ver src/lib/mora.ts);
 *  - **sin pago**: la cuenta es nueva, con un abono (mensual o semestral), y el equipo todavía no registró su primer pago. Frena hasta que pague.
 *
 * Quedan afuera de «sin pago»: las cuentas de ejemplo, la búsqueda puntual (se rige por el saldo de búsquedas pagadas) y los planes sin un precio
 * con el que facturar (Multisede sin convenio: el equipo lo acuerda a mano). Lo que se frena es lo mismo en los dos casos (`QUE_SE_LIMITA`);
 * todo lo demás sigue funcionando.
 */

/** Código con el que una acción avisa a la pantalla que tiene que mostrar el popup de pago (`fallo(error, undefined, CODIGO_PLAN_INACTIVO)`). */
export const CODIGO_PLAN_INACTIVO = "plan-inactivo";

export type MotivoDePlanInactivo = "mora" | "sin-pago";

export type EntradaDePlan = {
  /** Es una institución de ejemplo: nunca se frena. */
  esDemo: boolean;
  /** El plan se paga por búsqueda (sin abono): publicar depende de su saldo, no de una factura. */
  esPuntual: boolean;
  /** Hay un precio con el que facturar (un plan por sede sin convenio a medida no lo tiene). */
  precioDefinido: boolean;
  /** Cuántas facturas pagas tiene (un semestre al contado y un débito automático cuentan igual). */
  facturasPagas: number;
  mora: Mora;
};

/** Por qué el plan no está activo, o null si lo está. La mora manda sobre «sin pago»: es lo más urgente y trae su propio texto. */
export function motivoDePlanInactivo(e: EntradaDePlan): MotivoDePlanInactivo | null {
  if (e.esDemo) return null;
  if (e.mora.limitada) return "mora";
  if (e.esPuntual || !e.precioDefinido) return null;
  return e.facturasPagas === 0 ? "sin-pago" : null;
}

const TEXTO_SIN_PAGO = `Tu plan todavía no está activo: hasta que registremos tu primer pago no podés ${QUE_SE_LIMITA}. Mirá cómo pagar en Plan y facturación o escribinos desde Contacto.`;

/** Lo que se le responde a quien intenta publicar, invitar o crear un curso con el plan inactivo. */
export function errorDePlanInactivo(motivo: MotivoDePlanInactivo): string {
  return motivo === "mora" ? MENSAJE_DE_MORA : TEXTO_SIN_PAGO;
}

/** Lo que hace falta para armar el popup: el plan, lo que cuesta y por qué se frenó. Se calcula solo cuando el plan no está activo. */
export type DatosDelPopup = {
  motivo: MotivoDePlanInactivo;
  planNombre: string;
  /** Lo que paga por mes con sus sedes y su precio acordado; null si el plan no tiene un precio mensual (no debería pasar con un plan inactivo). */
  mensual: number | null;
  /** El semestre por adelantado, si puede pagarlo así (`puedePagarSemestre`). */
  semestre: ReturnType<typeof resumenDeSemestre> | null;
  /** Cómo paga: con Mercado Pago, con Mercado Pago o por transferencia o efectivo (si el equipo la habilitó) o como siempre (`src/lib/pago-manual.ts`). */
  forma: FormaDeCobro;
  /** Enlace de WhatsApp del equipo, o null si no hay. */
  whatsapp: string | null;
};

export type ContenidoDelPopup = {
  titulo: string;
  bajada: string;
  /** El plan y su precio; `precio` y `semestre` son null si no se sabe (popup genérico). */
  plan: { nombre: string; precio: string | null; semestre: string | null } | null;
  /** Cómo pagar, en orden. */
  pasos: string[];
};

// Sin saber cómo paga (el servidor frenó algo antes de que la pantalla lo supiera): neutro, vale para cualquiera.
const PASOS_GENERICOS = [
  "Mirá cómo pagar en Plan y facturación o escribinos por WhatsApp o desde Contacto.",
  "Apenas se acredite el pago, se habilita todo: no tenés que hacer nada más.",
];

/**
 * El texto del popup según el motivo. Sin motivo (el servidor frenó una acción que la pantalla todavía creía permitida: la pantalla se recarga y
 * enseguida pasa a mostrar el popup completo) queda uno genérico, con el mensaje que respondió el servidor.
 */
export function contenidoDelPopup(
  motivo: MotivoDePlanInactivo | null,
  datos: Pick<DatosDelPopup, "planNombre" | "mensual" | "semestre" | "forma"> | null,
  mensajeDelServidor?: string,
): ContenidoDelPopup {
  if (motivo === null) {
    return {
      titulo: "Tu plan no está activo",
      bajada: mensajeDelServidor ?? `Hasta que el plan esté activo no podés ${QUE_SE_LIMITA}.`,
      plan: null,
      pasos: PASOS_GENERICOS,
    };
  }
  const plan = datos
    ? {
        nombre: datos.planNombre,
        precio: datos.mensual !== null ? `${pesos(datos.mensual)} por mes` : null,
        semestre: datos.semestre ? `Si preferís pagar por semestre: ${textoDeSemestre(datos.semestre)}` : null,
      }
    : null;
  if (motivo === "mora") {
    return {
      titulo: "Tu cuenta está limitada por una factura vencida",
      bajada: `Pasaron más de ${DIAS_DE_GRACIA} días del vencimiento: hasta que se acredite el pago no podés ${QUE_SE_LIMITA}. Lo demás de tu cuenta sigue funcionando.`,
      plan,
      pasos: pasosParaLevantarLaMora(datos?.forma ?? "manual"),
    };
  }
  return {
    titulo: "Activá tu plan para publicar",
    bajada: `Tu plan todavía no está activo: hasta que registremos tu primer pago no podés ${QUE_SE_LIMITA}. Mientras tanto podés completar tu perfil y recorrer la plataforma.`,
    plan,
    pasos: pasosParaActivar(datos?.forma ?? "manual"),
  };
}

/** El cartel que ve la institución con el plan sin pago (la mora tiene el suyo: `cartelDeMora`). */
export function cartelDePlanSinPago(forma: FormaDeCobro = "manual"): { titulo: string; texto: string } {
  return { titulo: "Tu plan todavía no está activo", texto: fraseDelCartelSinPago(forma, QUE_SE_LIMITA) };
}
