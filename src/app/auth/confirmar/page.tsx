import type { Metadata } from "next";
import Link from "next/link";
import { confirmarEnlace } from "@/app/actions/auth";
import { BotonConfirmarEnlace } from "@/components/onboarding/boton-confirmar-enlace";
import { TituloPaso } from "@/components/onboarding/elementos";
import { MarcoAcceso } from "@/components/onboarding/marco-acceso";
import { BotonLink } from "@/components/ui/button";
import { esTipoDeConfirmacion, type TipoDeConfirmacion } from "@/lib/acceso";

export const metadata: Metadata = {
  title: "Confirmá tu enlace",
  // La dirección lleva el token del mail: que no se indexe ni viaje como referencia a otros sitios.
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

const TEXTOS: Record<TipoDeConfirmacion, { titulo: string; bajada: string; boton: string }> = {
  signup: {
    titulo: "Confirmá tu cuenta",
    bajada: "Tocá el botón para terminar de confirmar tu email y seguir con el alta.",
    boton: "Confirmar mi cuenta",
  },
  recovery: {
    titulo: "Elegí tu contraseña nueva",
    bajada: "Tocá el botón para seguir y elegir una contraseña nueva.",
    boton: "Elegir mi contraseña",
  },
};

/**
 * Destino de los enlaces de los mails de confirmación de registro y de recuperación de contraseña. Solo muestra un botón: el token
 * se verifica cuando la persona lo toca (`confirmarEnlace`), no al abrir la dirección. Así los antivirus y los "vínculos seguros" de
 * los programas de mail, que abren los enlaces para revisarlos, no gastan el enlace antes de que llegue a quien lo recibió.
 */
export default async function PaginaConfirmar({ searchParams }: { searchParams: Promise<{ type?: string; token_hash?: string }> }) {
  const { type, token_hash: tokenHash } = await searchParams;

  if (!tokenHash || !esTipoDeConfirmacion(type)) {
    return (
      <MarcoAcceso volverHref="/ingresar" volverTexto="‹ Volver a ingresar">
        <TituloPaso titulo="El enlace no es válido" bajada="Abrí el enlace desde el mail tal como te llegó, o pedí uno nuevo." />
        <BotonLink href="/ingresar" bloque className="min-h-12 text-base">
          Ir a ingresar
        </BotonLink>
      </MarcoAcceso>
    );
  }

  const textos = TEXTOS[type];
  return (
    <MarcoAcceso volverHref="/ingresar" volverTexto="‹ Volver a ingresar">
      <TituloPaso titulo={textos.titulo} bajada={textos.bajada} />
      <form action={confirmarEnlace} className="flex flex-col gap-4">
        <input type="hidden" name="type" value={type} />
        <input type="hidden" name="token_hash" value={tokenHash} />
        <BotonConfirmarEnlace>{textos.boton}</BotonConfirmarEnlace>
      </form>
      <p className="mt-[22px] mb-0 text-[13px] text-apagado">
        ¿No pediste esto?{" "}
        <Link href="/" className="font-semibold text-navy-700 hover:text-naranja">
          Ignorá el mail y volvé al inicio.
        </Link>
      </p>
    </MarcoAcceso>
  );
}
