"use client";

import { BotonEnvio } from "@/components/onboarding/boton-envio";
import { IconoGoogle } from "@/components/onboarding/elementos";

/**
 * "Continuar con Google" para usar DENTRO de un formulario que tenga `<input type="hidden" name="metodo" defaultValue="password">`:
 * lo envía con `metodo=google` y sin validar los demás campos.
 */
export function BotonGoogle({ deshabilitado }: { deshabilitado?: boolean }) {
  return (
    <BotonEnvio
      campo="metodo"
      valor="google"
      variante="secundario"
      bloque
      disabled={deshabilitado}
      className="min-h-12 text-[15px]"
    >
      <IconoGoogle />
      Continuar con Google
    </BotonEnvio>
  );
}
