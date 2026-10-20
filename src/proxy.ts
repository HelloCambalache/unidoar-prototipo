import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseClavePublica, supabaseUrl } from "@/lib/supabase/env";
import { opcionesDeCookieDeSesion } from "@/lib/supabase/cookies";
import { cabecerasDeCsp, modoDeCsp, nuevoNonce, politicaDeContenido } from "@/lib/csp";

/**
 * Pantallas con cuenta. El rol (docente / institución / admin) se valida en cada
 * layout del servidor; acá solo se exige estar logueado.
 *
 * El paso 1 de cada onboarding es el registro, así que queda público.
 */
const PRIVADAS = [/^\/docente(\/|$)/, /^\/institucion(\/|$)/, /^\/backoffice(\/|$)/, /^\/onboarding(\/|$)/, /^\/app(\/|$)/];
const REGISTRO = /^\/onboarding\/(docente|institucion)\/1\/?$/;

/**
 * La política de contenido de este pedido, con su nonce (ver src/lib/csp.ts). Solo en producción (en desarrollo el panel de vista previa y
 * el recargado en caliente usan scripts que una política así bloquearía) y solo para páginas: las rutas de API devuelven datos, no HTML.
 */
function politicaDelPedido(pathname: string, supabase: string | undefined) {
  if (process.env.NODE_ENV !== "production" || pathname.startsWith("/api/")) return null;
  const nonce = nuevoNonce();
  return { nonce, ...cabecerasDeCsp(modoDeCsp(), politicaDeContenido(nonce, { supabaseUrl: supabase })) };
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const esPrivada = PRIVADAS.some((r) => r.test(pathname)) && !REGISTRO.test(pathname);

  const url = supabaseUrl();
  const clave = supabaseClavePublica();
  const csp = politicaDelPedido(pathname, url);
  // La respuesta "sigue adelante": con la política, el nonce viaja en la cabecera del pedido (Next lo pone en sus scripts) y la política en
  // la de la respuesta. Se arma de nuevo cada vez que cambian las cookies, así el pedido lleva las cookies ya renovadas.
  const seguir = () => {
    if (!csp) return NextResponse.next({ request });
    // Ninguna política que venga en el pedido: Next saca el nonce de la primera que encuentra (ver src/lib/csp.ts).
    const cabeceras = new Headers(request.headers);
    cabeceras.delete("content-security-policy");
    cabeceras.delete("content-security-policy-report-only");
    cabeceras.set("x-nonce", csp.nonce);
    for (const [nombre, valor] of csp.delPedido) cabeceras.set(nombre, valor);
    const r = NextResponse.next({ request: { headers: cabeceras } });
    for (const [nombre, valor] of csp.deLaRespuesta) r.headers.set(nombre, valor);
    return r;
  };
  let response = seguir();

  // Sin Supabase configurado no hay forma de saber quién es: las áreas privadas no se abren.
  if (!url || !clave) {
    return esPrivada ? redirigirAIngreso(request, pathname + search) : response;
  }

  const supabase = createServerClient(url, clave, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (lista) => {
        for (const { name, value } of lista) request.cookies.set(name, value);
        response = seguir();
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
