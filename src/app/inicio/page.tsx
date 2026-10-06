import { redirect } from "next/navigation";
import { PRIMER_PASO_PROTEGIDO } from "@/lib/acceso";
import { usuarioActual } from "@/lib/auth";
import { RUTA_INICIO } from "@/lib/catalogo";
import { datosDeSesion } from "@/lib/sesion";

/**
 * Puerta de entrada después de iniciar sesión: manda a cada rol a su área.
 * Sin sesión → /ingresar. Con sesión pero sin fila local (no terminó el primer paso del alta):
 * si el registro dejó el rol como pista sigue por ahí, y si no, a elegir el rol en /registro.
 */
export default async function PaginaInicio() {
  const sesion = await datosDeSesion();
  if (!sesion) redirect("/ingresar");

  const usuario = await usuarioActual();
  if (usuario) redirect(RUTA_INICIO[usuario.rol]);

  if (sesion.rolPista) redirect(PRIMER_PASO_PROTEGIDO[sesion.rolPista]);
  redirect("/registro");
}
