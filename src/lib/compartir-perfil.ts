/*
 * "Compartir mi perfil": el profesional prende un enlace público a una página con su perfil (sin teléfono, email ni documentos).
 * Reglas puras (sin base ni Next) para poder probarlas: el token, la ruta, y el texto y los enlaces para compartir.
 */

/** Largo mínimo y máximo de un token válido: lo genera `nuevoTokenDePerfil` (24 caracteres), la ruta acepta ese rango. */
const FORMATO_TOKEN = /^[A-Za-z0-9_-]{20,64}$/;

/** ¿Tiene forma de token de perfil? Se mira antes de ir a la base, para no consultar con cualquier cosa que llegue por la URL. */
export const esTokenDePerfil = (valor: string) => FORMATO_TOKEN.test(valor);

/** Ruta pública del perfil compartido. */
export const rutaDePerfilCompartido = (token: string) => `/profesional/${token}`;

/** Dirección completa (con el origen del sitio) del perfil compartido. */
export const urlDePerfilCompartido = (origen: string, token: string) => `${origen.replace(/\/$/, "")}${rutaDePerfilCompartido(token)}`;

/** Mensaje que acompaña al enlace cuando se comparte por WhatsApp. */
export const textoParaCompartir = (url: string) => `Mirá mi perfil profesional en UNIDOAR: ${url}`;

/** Abre WhatsApp (app o web) con el mensaje ya escrito, para elegir a quién mandarlo. */
export const enlaceDeWhatsApp = (texto: string) => `https://wa.me/?text=${encodeURIComponent(texto)}`;
