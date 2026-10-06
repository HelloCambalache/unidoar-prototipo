import { NextResponse, type NextRequest } from "next/server";
import { rutaInternaSegura } from "@/lib/acceso";
import { crearClienteServidor } from "@/lib/supabase/server";
import { supabaseConfigurado } from "@/lib/supabase/env";

/**
 * Destino de los enlaces que manda Supabase (confirmación de mail, recuperación de contraseña, Google).
 * Intercambia el `code` (PKCE) por la sesión —que queda en cookies— y sigue a `next`, que solo puede
 * ser una ruta interna. Cualquier falla lleva a /ingresar con un aviso.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const configurada = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  const reenviado = request.headers.get("x-forwarded-host");
  const base =
    configurada ?? (reenviado ? `${request.headers.get("x-forwarded-proto") ?? "https"}://${reenviado}` : origin);

  const falla = (codigo: "enlace" | "oauth") => NextResponse.redirect(`${base}/ingresar?error=${codigo}`);

  if (searchParams.get("error") || searchParams.get("error_code")) {
    return falla(searchParams.get("error_code") === "access_denied" ? "oauth" : "enlace");
  }

  const code = searchParams.get("code");
  if (!code || !supabaseConfigurado()) return falla("enlace");

  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return falla("enlace");

  return NextResponse.redirect(`${base}${rutaInternaSegura(searchParams.get("next"), "/inicio")}`);
}
