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

export const DEMASIADOS_PEDIDOS ="Hiciste muchos pedidos seguidos. Esperá un rato y probá de nuevo.";
