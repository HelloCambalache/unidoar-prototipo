import { redirect } from "next/navigation";
import { docenteDeUsuario, usuarioParaAlta } from "@/lib/alta";
import { RUTA_INICIO } from "@/lib/catalogo";
import { rutaPasoPendienteDocente } from "@/lib/onboarding";

/**
 * El prototipo registra esta ruta pero no tiene pantalla (el alta termina en el paso 4). Se conserva como
 * alias: manda al paso que corresponda o, si el alta ya terminó, al dashboard.
 */
export default async function PasoDocente5() {
  const usuario = await usuarioParaAlta("docente");
  const docente = await docenteDeUsuario(usuario.id);
  if (docente?.onboardingCompleto) redirect(RUTA_INICIO.docente);
  redirect(rutaPasoPendienteDocente(docente));
}
