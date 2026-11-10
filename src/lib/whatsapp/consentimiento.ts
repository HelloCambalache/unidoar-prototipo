import { claveDeNumero, numeroParaWhatsapp } from "./telefono";

/*
 * Consentimiento para recibir avisos por WhatsApp. Sin base ni red.
 *
 * Nadie recibe un aviso por WhatsApp sin haberlo pedido: la casilla viene apagada y el consentimiento queda atado a UN número (el que la persona
 * escribió al activarlo). Si cambia el número, hay que activarlo de nuevo con el nuevo; si lo retira (desde Mi cuenta o respondiendo BAJA), no sale
 * nada más. Un número que figura en el perfil o en el alta NO cuenta como consentimiento: es el número de contacto, no un permiso.
 */

/** Versión del texto de la casilla: queda anotada con el consentimiento (como la de los términos) por si el texto cambia. */
export const VERSION_DEL_CONSENTIMIENTO = "2026-11";

export const TEXTO_DE_LA_CASILLA = "Quiero recibir avisos de UNIDOAR por WhatsApp en este número.";

export const AYUDA_DEL_CONSENTIMIENTO =
  "Te escribimos solo por lo que pasa con tus búsquedas y postulaciones (entrevistas, preselecciones, ofertas, postulantes nuevos). No mandamos promociones. Podés dejar de recibirlos cuando quieras, desde acá o respondiendo BAJA al mensaje.";

export const ERROR_DE_NUMERO = "No reconocemos ese número. Escribí tu celular con la característica, por ejemplo 11 5473-5876.";

export type NumeroDeAvisos = { ok: true; numero: string; clave: string } | { ok: false; error: string };

/** Valida el celular que escribió la persona para recibir avisos y lo deja en formato internacional (`numero`) y con su clave de comparación. */
export function validarNumeroDeAvisos(texto: string | null | undefined): NumeroDeAvisos {
  const numero = numeroParaWhatsapp(texto);
  const clave = claveDeNumero(numero);
  if (!numero || !clave) return { ok: false, error: ERROR_DE_NUMERO };
  return { ok: true, numero, clave };
}

/**
 * ¿Un aviso para este número puede salir? Solo si hay un consentimiento activo (sin baja) y es para el mismo número que la persona dio. Si el
 * consentimiento es de otro número (lo cambió después de que se anotó el aviso), no sale.
 */
export function puedeRecibirAvisos(consentimiento: { bajaEn: Date | null; clave: string } | null | undefined, paraNumero: string): boolean {
  if (!consentimiento || consentimiento.bajaEn) return false;
  const destino = claveDeNumero(paraNumero);
  return destino !== null && destino === consentimiento.clave;
}
