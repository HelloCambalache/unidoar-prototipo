import { NextResponse, type NextRequest } from "next/server";
import { rutaInternaSegura } from "@/lib/acceso";
import { baseDelSitio } from "@/lib/auth-enlaces";
import { COOKIE_RECUPERACION, esRutaDeRecuperacion, VIDA_RECUPERACION_SEGUNDOS } from "@/lib/recuperacion";
import { crearClienteServidor } from "@/lib/supabase/server";
import { supabaseConfigurado } from "@/lib/supabase/env";

/**
 * Destino de los enlaces que manda Supabase (confirmación de mail, recuperación de contraseña, Google).
 * Intercambia el `code` (PKCE) por la sesión —que queda en cookies— y sigue a `next`, que solo puede
 * ser una ruta interna. Cualquier falla lleva a /ingresar con un aviso.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const base = baseDelSitio(request);

  const falla = (codigo: "enlace" | "oauth") => NextResponse.redirect(`${base}/ingresar?error=${codigo}`);

  if (searchParams.get("error") || searchParams.get("error_code")) {
    return falla(searchParams.get("error_code") === "access_denied" ? "oauth" : "enlace");
  }

  const code = searchParams.get("code");
  if (!code || !supabaseConfigurado()) return falla("enlace");

  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return falla("enlace");

  const destino = rutaInternaSegura(searchParams.get("next"), "/inicio");
  const respuesta = NextResponse.redirect(`${base}${destino}`);
  // Los mails de recuperación viejos (con el enlace de Supabase) también dejan elegir la contraseña nueva.
  if (esRutaDeRecuperacion(destino)) {
    respuesta.cookies.set(COOKIE_RECUPERACION, "1", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: VIDA_RECUPERACION_SEGUNDOS,
    });
  }
  return respuesta;
}
