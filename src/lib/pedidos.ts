import { crearTope } from "@/lib/tope";

/**
 * Pedidos al equipo de UNIDOAR por cuenta y por hora (pedir la baja, retirarla, pedir un cambio de plan, cancelarlo). Cada uno anota una
 * auditoría, avisa a todos los admin y manda un mail interno: sin un tope, "pedir y retirar" en un bucle llenaba la casilla del equipo.
 * Vive en la memoria de cada instancia: frena un bucle, no es exacto con varias instancias.
 */
export const permitirPedidoAlEquipo = crearTope(6, 60 * 60 * 1000);

/**
 * Activar el débito automático crea una suscripción en Mercado Pago (una llamada externa por intento): como mucho 5 por hora y por
 * cuenta. Con las pruebas de cada institución alcanza de sobra; frena un bucle.
 */
export const permitirActivarDebito = crearTope(5, 60 * 60 * 1000);

/**
 * Armar el link de pago del semestre crea una preferencia en Mercado Pago (una llamada externa por intento; tocar el botón de nuevo reutiliza el
 * link vigente, así que esto solo frena un bucle): como mucho 8 por hora y por cuenta.
 */
export const permitirLinkDeSemestre = crearTope(8, 60 * 60 * 1000);

/**
 * Al volver de pagar, la pantalla pregunta hasta unas 8 veces (cada pocos segundos) si ya se acreditó el pago del semestre; cada pregunta consulta a
 * Mercado Pago. Como mucho 40 cada 10 minutos por cuenta.
 */
export const permitirConfirmarSemestre = crearTope(40, 10 * 60 * 1000);

/**
 * Códigos de referido que una cuenta puede probar a mano en el alta por hora: el campo dice si un código existe o no, así que sin un tope
 * serviría para ir adivinándolos. Con 8 letras y números nadie los adivina, pero el tope lo deja explícito; alcanza de sobra para quien se
 * equivoca de tipeo. En la memoria de cada instancia: frena un bucle, no es exacto con varias instancias.
 */
export const permitirProbarCodigoDeReferido = crearTope(8, 60 * 60 * 1000);

export const DEMASIADOS_PEDIDOS ="Hiciste muchos pedidos seguidos. Esperá un rato y probá de nuevo.";
