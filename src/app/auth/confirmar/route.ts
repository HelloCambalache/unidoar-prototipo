import { NextResponse, type NextRequest } from "next/server";
import { destinoTrasConfirmar, esTipoDeConfirmacion } from "@/lib/acceso";
import { baseDelSitio } from "@/lib/auth-enlaces";
import { supabaseConfigurado } from "@/lib/supabase/env";
import { crearClienteServidor } from "@/lib/supabase/server";

/**
 * Destino de los mails de confirmación de registro y de recuperación de contraseña. El enlace del mail trae el `token_hash`
 * y acá lo verifica el servidor (`verifyOtp`): no depende de que se abra en el mismo navegador donde se pidió, así que anda
 * igual desde el celular que desde la computadora. La sesión queda abierta en el dispositivo que abrió el enlace.
 * (Los mails viejos, con el enlace de Supabase, siguen entrando por /auth/callback, que sí exige el mismo navegador.)
 */
export async function GET(request: NextRequest) {
  const base = baseDelSitio(request);
  const falla = () => NextResponse.redirect(`${base}/ingresar?error=enlace`);

  const tipo = request.nextUrl.searchParams.get("type");
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  if (!tokenHash || !esTipoDeConfirmacion(tipo) || !supabaseConfigurado()) return falla();

  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.verifyOtp({ type: tipo, token_hash: tokenHash });
  if (error) return falla();

  return NextResponse.redirect(`${base}${destinoTrasConfirmar(tipo)}`);
}
