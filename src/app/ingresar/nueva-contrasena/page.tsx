import type { Metadata } from "next";
import Link from "next/link";
import { BotonLink } from "@/components/ui/button";
import { FormularioNuevaContrasena } from "@/components/onboarding/formularios-clave";
import { MarcoAcceso } from "@/components/onboarding/marco-acceso";
import { TituloPaso } from "@/components/onboarding/elementos";
import { sesionActual } from "@/lib/auth";

export const metadata: Metadata = { title: "Elegí tu contraseña nueva" };

/** A esta pantalla se llega desde el enlace del mail de recuperación: /auth/callback ya dejó la sesión abierta. */
export default async function PaginaNuevaContrasena() {
  const haySesion = Boolean(await sesionActual());

  return (
    <MarcoAcceso volverHref="/ingresar" volverTexto="‹ Volver a ingresar">
      {haySesion ? (
        <FormularioNuevaContrasena />
      ) : (
        <>
          <TituloPaso
            titulo="El enlace venció"
            bajada="Los enlaces para cambiar la contraseña sirven una sola vez y por poco tiempo. Pedí uno nuevo y abrilo en este mismo navegador."
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
