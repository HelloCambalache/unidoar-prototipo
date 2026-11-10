import "server-only";
import { resumenDeError } from "@/lib/errores";
import { obtenerCuentaDeCobroMp } from "@/lib/mercadopago-cliente";
import {
  esCuentaDePrueba,
  esTokenDePrueba,
  mercadoPagoDisponibleEnModo,
  pruebaSoloParaEjemplo,
  tokenDeMercadoPago,
  type ModoDeCobro,
} from "@/lib/mercadopago-config";

/*
 * ¿Los cobros son reales? (la regla de quién ve Mercado Pago con un token de prueba cambió el 2026-11-10: ver `pruebaSoloParaEjemplo`). Con un token de PRUEBA cargado en producción, una institución real podría suscribirse y ningún cobro entraría a
 * ningún lado, sin ninguna señal (lo advirtió Kumo, que pasó por eso): no da errores, nadie se queja y se descubre al cierre del mes. Por eso
 * el modo se sabe, se muestra al equipo y se usa para no ofrecerle el débito a una institución real mientras el token sea de prueba.
 */

const MINUTOS_DE_VIGENCIA = 10;
const MINUTOS_SI_NO_SE_PUDO = 1;
let recordado: { token: string; modo: ModoDeCobro; hasta: number } | null = null;

/**
 * El modo en que está Mercado Pago: "prueba" si el token empieza con `TEST-` o si la cuenta dueña del token (`GET /users/me`) es un usuario de
 * prueba (cubre el token de una aplicación creada dentro de una cuenta de prueba), "produccion" si no, y "desconocido" si no se pudo
 * averiguar. Devuelve null si no hay token. Se recuerda 10 minutos (1 si falló la consulta) para no preguntarle a Mercado Pago en cada pantalla.
 */
export async function modoDeMercadoPago(): Promise<ModoDeCobro | null> {
  const token = tokenDeMercadoPago();
  if (!token) return null;
  if (esTokenDePrueba(token)) return "prueba";
  if (recordado && recordado.token === token && recordado.hasta > Date.now()) return recordado.modo;

  let modo: ModoDeCobro;
  let minutos = MINUTOS_DE_VIGENCIA;
  try {
    modo = esCuentaDePrueba(await obtenerCuentaDeCobroMp()) ? "prueba" : "produccion";
  } catch (e) {
    modo = "desconocido";
    minutos = MINUTOS_SI_NO_SE_PUDO;
    console.error("[mercadopago] no se pudo averiguar de quién es el token", resumenDeError(e));
  }
  recordado = { token, modo, hasta: Date.now() + minutos * 60_000 };
  return modo;
}

/**
 * ¿Se le ofrece el débito automático a esta institución? Sin token, no. Con un token de PRUEBA, a las de ejemplo y, desde el 2026-11-10 (decisión
 * de Flor: «estamos probando»), también a las reales, salvo que se prenda la protección `MP_PRUEBA_SOLO_EJEMPLO=1` (ver `pruebaSoloParaEjemplo`: ahí
 * una real no puede suscribirse a un cobro que no es real). Si no se pudo saber el modo, se ofrece: no hay señal de prueba.
 */
export async function debitoDisponiblePara(institucion: { esDemo: boolean }): Promise<boolean> {
  return mercadoPagoDisponibleEnModo(await modoDeMercadoPago(), institucion.esDemo, pruebaSoloParaEjemplo());
}

/**
 * ¿Mercado Pago está cobrando de verdad (token de producción)? Para los textos de la parte pública, que no saben quién los mira: solo dicen que se
 * paga con Mercado Pago cuando es cierto. Con un token de prueba, sin token o si no se pudo saber, siguen diciendo lo de siempre.
 */
export async function mercadoPagoEnProduccion(): Promise<boolean> {
  return (await modoDeMercadoPago()) === "produccion";
}

/**
 * ¿Se le ofrece pagar por Mercado Pago (el semestre por adelantado)? La misma regla que el débito automático: sin token no, y con un token de
 * PRUEBA solo a las instituciones de ejemplo (un pago real no puede entrar a una cuenta de prueba).
 */
export const pagoPorMercadoPagoDisponiblePara = debitoDisponiblePara;
