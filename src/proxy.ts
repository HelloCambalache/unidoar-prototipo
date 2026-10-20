import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseClavePublica, supabaseUrl } from "@/lib/supabase/env";
import { opcionesDeCookieDeSesion } from "@/lib/supabase/cookies";

/**
 * Pantallas con cuenta. El rol (docente / institución / admin) se valida en cada
 * layout del servidor; acá solo se exige estar logueado.
 *
 * El paso 1 de cada onboarding es el registro, así que queda público.
 */
const PRIVADAS = [/^\/docente(\/|$)/, /^\/institucion(\/|$)/, /^\/backoffice(\/|$)/, /^\/onboarding(\/|$)/, /^\/app(\/|$)/];
const REGISTRO = /^\/onboarding\/(docente|institucion)\/1\/?$/;

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const esPrivada = PRIVADAS.some((r) => r.test(pathname)) && !REGISTRO.test(pathname);

  const url = supabaseUrl();
  const clave = supabaseClavePublica();
  let response = NextResponse.next({ request });

  // Sin Supabase configurado no hay forma de saber quién es: las áreas privadas no se abren.
  if (!url || !clave) {
    return esPrivada ? redirigirAIngreso(request, pathname + search) : response;
  }

  const supabase = createServerClient(url, clave, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (lista) => {
        for (const { name, value } of lista) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of lista) response.cookies.set(name, value, opcionesDeCookieDeSesion(options));
      },
    },
  });

  // getClaims valida el JWT y renueva el token vencido (escribe las cookies de arriba).
  const { data } = await supabase.auth.getClaims();
  const haySesion = Boolean(data?.claims?.sub);

  if (esPrivada && !haySesion) return redirigirAIngreso(request, pathname + search);
  return response;
}

function redirigirAIngreso(request: NextRequest, destino: string) {
  const ir = request.nextUrl.clone();
  ir.pathname = "/ingresar";
  ir.search = "";
  ir.searchParams.set("next", destino);
  return NextResponse.redirect(ir);
}

export const config = {
  matcher: [
    // Saltea internos de Next y archivos estáticos.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
