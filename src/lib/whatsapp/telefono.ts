import { enlaceWhatsapp } from "@/lib/pipeline";

/*
 * Teléfonos para los avisos por WhatsApp. Sin base ni red: los usan el formulario de Mi cuenta, la cola y el webhook.
 *
 * Un número se guarda y se manda en formato internacional sin el «+»: para un celular argentino es 54 9 + característica + número
 * («5491154735876»). Lo que llega de WhatsApp (el `from` de un mensaje) puede venir con o sin el 9, así que para comparar dos números se usa
 * una «clave»: los últimos 10 dígitos (característica + número), que es lo mismo escrito de cualquier forma.
 */

/** «11 5473-5876», «011 15 5473-5876» o «+54 9 11 5473-5876» → «5491154735876». Null si no se reconoce un celular argentino. */
export function numeroParaWhatsapp(texto: string | null | undefined): string | null {
  const enlace = enlaceWhatsapp(texto);
  return enlace ? enlace.slice(enlace.lastIndexOf("/") + 1) : null;
}

/**
 * Los 10 dígitos (característica + número) de un número argentino escrito como llegue («5491154735876», «541154735876», «1154735876»).
 * Sirve para saber si dos números son el mismo. Null si no tiene la forma de un número argentino.
 */
export function claveDeNumero(numero: string | null | undefined): string | null {
  let n = (numero ?? "").replace(/\D/g, "");
  if (n.startsWith("549") && n.length === 13) n = n.slice(3);
  else if (n.startsWith("54") && n.length === 12) n = n.slice(2);
  return n.length === 10 ? n : null;
}

/** «5491154735876» → «••• 5876»: lo que se muestra o se anota de un número sin dejarlo entero a la vista. */
export function numeroEnmascarado(numero: string | null | undefined): string {
  const digitos = (numero ?? "").replace(/\D/g, "");
  return digitos.length >= 4 ? `••• ${digitos.slice(-4)}` : "•••";
}
