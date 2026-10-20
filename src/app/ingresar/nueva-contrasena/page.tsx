import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { BotonLink } from "@/components/ui/button";
import { FormularioNuevaContrasena } from "@/components/onboarding/formularios-clave";
import { MarcoAcceso } from "@/components/onboarding/marco-acceso";
import { TituloPaso } from "@/components/onboarding/elementos";
import { sesionActual } from "@/lib/auth";
import { COOKIE_RECUPERACION, recuperacionVigente } from "@/lib/recuperacion";

export const metadata: Metadata = { title: "Elegí tu contraseña nueva" };

/** A esta pantalla se llega desde el enlace del mail de recuperación: /auth/callback ya dejó la sesión abierta. */
export default async function PaginaNuevaContrasena() {
  // Solo se puede elegir la contraseña nueva llegando por el enlace del mail: con una sesión abierta a secas no alcanza.
  // El permiso va firmado y atado a esta cuenta: una cookie fabricada a mano no alcanza.
  const sesion = await sesionActual();
  const haySesion = Boolean(sesion) && recuperacionVigente((await cookies()).get(COOKIE_RECUPERACION)?.value, sesion!.id);

  return (
    <MarcoAcceso volverHref="/ingresar" volverTexto="‹ Volver a ingresar">
      {haySesion ? (
        <FormularioNuevaContrasena />
      ) : (
        <>
          <TituloPaso
            titulo="El enlace venció"
            bajada="Los enlaces para cambiar la contraseña sirven una sola vez y por poco tiempo. Pedí uno nuevo y abrilo desde el mail, cuando te llegue."
          />
          <BotonLink href="/ingresar/recuperar" bloque className="min-h-12 text-base">
            Pedir un enlace nuevo
          </BotonLink>
          <p className="mt-[22px] mb-0 text-[13px] text-apagado">
            <Link href="/ingresar" className="font-semibold text-navy-700 hover:text-naranja">
              ← Volver a ingresar
            </Link>
          </p>
        </>
      )}
    </MarcoAcceso>
  );
}
