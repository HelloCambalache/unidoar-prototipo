import "server-only";
import type { Usuario } from "@/db/schema";
import { docenteActual, institucionActual } from "@/lib/auth";
import { crearTope } from "@/lib/tope";

/** Subidas por cuenta cada 10 minutos: de sobra para un alta o una vitrina con galería, corta un bucle que llena Storage. */
const permitirSubida = crearTope(60, 10 * 60 * 1000);

export type NegacionDeSubida = { error: string; status: number };

const SUSPENDIDA: NegacionDeSubida = { error: "Tu cuenta está suspendida: por ahora no podés subir archivos.", status: 403 };
const DEMASIADAS: NegacionDeSubida = {
  error: "Subiste muchos archivos en poco tiempo. Esperá unos minutos y probá de nuevo.",
  status: 429,
};

/** Las cuentas suspendidas no pueden entrar a la app: tampoco tienen por qué subirle archivos a Storage. */
async function estaSuspendida(usuario: Usuario): Promise<boolean> {
  if (usuario.rol === "docente") return Boolean((await docenteActual())?.suspendido);
  if (usuario.rol === "institucion") return Boolean((await institucionActual())?.suspendida);
  return false;
}

/** ¿Esta cuenta puede subir un archivo ahora? Cuenta suspendida, no; y cada cuenta tiene un tope de subidas por rato. Null = puede. */
export async function negarSubida(usuario: Usuario): Promise<NegacionDeSubida | null> {
  if (usuario.rol === "admin") return null;
  if (await estaSuspendida(usuario)) return SUSPENDIDA;
  return permitirSubida(usuario.id) ? null : DEMASIADAS;
}

/** Igual que `negarSubida` pero sin gastar un cupo: el segundo paso de un PDF grande ya se contó al firmar. */
export async function negarConfirmacion(usuario: Usuario): Promise<NegacionDeSubida | null> {
  if (usuario.rol === "admin") return null;
  return (await estaSuspendida(usuario)) ? SUSPENDIDA : null;
}

/**
 * Pedir una URL de subida directa (`/api/subir/firmar`) tiene un tope más corto que subir: una persona normal pide una o dos en un alta
 * (un CV y un título grandes), no decenas. Cuenta además contra el tope general de subidas.
 */
const permitirFirma = crearTope(10, 10 * 60 * 1000);

export async function negarFirma(usuario: Usuario): Promise<NegacionDeSubida | null> {
  const negada = await negarSubida(usuario);
  if (negada) return negada;
  if (usuario.rol === "admin") return null;
  return permitirFirma(usuario.id) ? null : DEMASIADAS;
}
